/**
 * Workflow machine — ลอจิกเปลี่ยนสถานะตั๋ว (pure functions, ไม่แตะ DB/UI)
 * ย้ายมาจาก approve.js / admin-ico.js / admin-itl.js / admin-itm.js / survey.js ของระบบเดิม 1:1
 *
 *   OPEN ──(หัวหน้าอนุมัติ)──▶ ICO_WORK ──(ICO ส่งต่อ / ส่งตรง ITL)──▶ ITL_WAIT
 *     │                           ▲  ▲                                   │ ITL อนุมัติ
 *     └─(ไม่อนุมัติ)─▶ REJECTED    │  └─ ITL ตีกลับ / ITM ตีกลับ ICO ◀────┤
 *                                 │                                      ▼
 *                       ITM ตีกลับ ITL ◀──────────────────────────── ITM_WAIT ──(ITM ยกเลิก)──▶ CANCELLED
 *                                                                       │ ITM อนุมัติ
 *                                                                       ▼
 *                                                   ICO_FINAL ──(ICO ปิดงาน)──▶ DONE ──▶ Survey
 *
 * ทุกฟังก์ชันคืน `Transition` (patch + log + automation event) ให้ชั้น service นำไปเขียนลง repository
 * ถ้าผิดกติกาจะ throw WorkflowError พร้อมข้อความภาษาไทยเหมือนระบบเดิม
 */
import type {
  AutomationEvent, CloseResult, JobCategory, NewLog, Priority, Role, Survey, Ticket, TicketLog,
  TicketService, TicketStatus, WorkStatusMaster,
} from '@/types';

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export interface Ctx {
  now: Date;
  /** origin ของเว็บ เช่น http://localhost:3000 ใช้สร้างลิงก์ในอีเมลจำลอง */
  origin: string;
}

export interface Transition {
  ticketPatch?: Partial<Ticket>;
  servicePatch?: Partial<TicketService>;
  logs: NewLog[];
  event?: AutomationEvent;
}

const iso = (c: Ctx) => c.now.toISOString();
const clean = (s?: string | null) => (s ?? '').trim();
const orNull = (s?: string | null) => clean(s) || null;

/* ───────── helpers: สถานะที่ ICO ทำงานได้ / ผู้จัดการตัดสินได้ ───────── */
export const ICO_CAN_WORK: TicketStatus[] = ['OPEN', 'MGR_WAIT', 'ICO_WORK'];
export const MANAGER_CAN_DECIDE: TicketStatus[] = ['OPEN', 'MGR_WAIT', 'ICO_WORK'];

export function approveLink(t: Pick<Ticket, 'approve_token'>, ctx: Ctx) {
  return `${ctx.origin}/approve/${t.approve_token ?? ''}`;
}
export function surveyLink(t: Pick<Ticket, 'survey_token'>, ctx: Ctx) {
  return `${ctx.origin}/survey/${t.survey_token ?? ''}`;
}
export function trackLink(t: Pick<Ticket, 'track_token'>, ctx: Ctx) {
  return `${ctx.origin}/track/${t.track_token ?? ''}`;
}

function baseEvent(
  t: Ticket, ctx: Ctx, event: AutomationEvent['event'], action: string, newStatus: TicketStatus | undefined,
  extra: Record<string, unknown> = {},
): AutomationEvent {
  return {
    event, action, new_status: newStatus, ticket_no: t.ticket_no, timestamp: iso(ctx),
    payload: {
      event, action, new_status: newStatus, ticket_no: t.ticket_no,
      requester_name: t.requester_name || '', requester_email: t.requester_email || '',
      manager_email: t.manager_email || '', department: t.department || '', location: t.location || '',
      asset_id: t.asset_id || '', issue_detail: t.issue_detail || '', request_date: t.request_date || '',
      required_date: t.required_date || '', timestamp: iso(ctx), ...extra,
    },
  };
}

/* ═══════════════ 1) ผู้แจ้งส่งคำขอ (index.js → submitForm) ═══════════════ */
export function requestSubmitted(t: Ticket, ctx: Ctx): Transition {
  return {
    logs: [],
    event: baseEvent(t, ctx, 'OPEN', 'NEW_REQUEST', 'OPEN', {
      issue_img_url: (t.issue_img_url || []).join(','),
      attachment_url: (t.attachment_url || []).join(','),
      approve_link: approveLink(t, ctx),
      track_link: trackLink(t, ctx),
    }),
  };
}

/* ═══════════════ 2) หัวหน้างานอนุมัติ/ไม่อนุมัติ (approve.js → doAction) ═══════════════ */
export interface ManagerInput {
  action: 'APPROVED' | 'REJECTED';
  comment?: string;
  /** ชื่อที่พิมพ์ (โหมดพิมพ์ชื่อ) */
  name?: string | null;
  /** URL รูปลายเซ็น (โหมดวาด) */
  signatureUrl?: string | null;
}
/** ตรวจกติกาการตัดสินของหัวหน้างาน — แยกออกมาเพื่อเรียกก่อนอัปโหลดลายเซ็น */
export function checkManagerDecision(
  t: Ticket, input: { action: ManagerInput['action']; comment?: string; name?: string | null; hasSignature: boolean },
): void {
  if (input.action === 'REJECTED' && !clean(input.comment)) throw new WorkflowError('กรุณาระบุเหตุผลที่ไม่อนุมัติ');
  if (!clean(input.name) && !input.hasSignature) throw new WorkflowError('กรุณาพิมพ์ชื่อหรือวาดลายเซ็นก่อนยืนยัน');
  // ตัดสินได้ครั้งเดียว: ICO รับงานก่อนหัวหน้าอนุมัติได้ (OPEN → ICO_WORK) จึงดูสถานะอย่างเดียวไม่พอ
  if (t.mgr_status || !MANAGER_CAN_DECIDE.includes(t.status)) {
    throw new WorkflowError('ใบงานนี้ถูกดำเนินการไปแล้ว หรือไม่ได้อยู่ในสถานะรออนุมัติ');
  }
}

export function managerDecision(t: Ticket, input: ManagerInput, ctx: Ctx): Transition {
  checkManagerDecision(t, { ...input, hasSignature: !!input.signatureUrl });
  const comment = clean(input.comment);
  const newStatus: TicketStatus = input.action === 'APPROVED' ? 'ICO_WORK' : 'REJECTED';
  const now = iso(ctx);
  const ticketPatch: Partial<Ticket> = {
    status: newStatus,
    mgr_status: input.action,
    mgr_name: orNull(input.name),
    mgr_signature_url: input.signatureUrl || null,
    mgr_approved_at: now,
  };
  if (comment) ticketPatch.mgr_comment = comment;
  return {
    ticketPatch,
    logs: [{
      ticket_no: t.ticket_no, step_name: 'MANAGER_APPROVE', status: input.action,
      action_by: clean(input.name) || 'วาดลายเซ็น', comment: comment || null,
    }],
    event: baseEvent(t, ctx, 'MANAGER_APPROVE', input.action, newStatus, {
      mgr_name: clean(input.name), mgr_comment: comment, mgr_approved_at: now,
    }),
  };
}

/* ═══════════════ 3) ICO บันทึกงาน / ส่งต่อ ITL (admin-ico.js → saveService) ═══════════════ */
export interface WorkInput {
  staff_name: string;
  received_date?: string | null;
  job_category?: JobCategory | '' | null;
  priority?: Priority;
  inspection_detail?: string | null;
  action_detail?: string | null;
  spare_parts_detail?: string | null;
  repair_cost?: number | null;
  finish_date?: string | null;
  recommendations?: string | null;
  additional_notes?: string | null;
  attachment_urls?: string[] | null;
  work_hours?: number | null;
}

function workPatch(i: WorkInput, owner: 'ICO' | 'ITL', ctx: Ctx): Partial<TicketService> {
  return {
    work_owner: owner,
    staff_name: clean(i.staff_name) || null,
    received_date: i.received_date || null,
    job_category: (i.job_category as JobCategory) || null,
    priority: i.priority ?? 'NORMAL',
    inspection_detail: orNull(i.inspection_detail),
    action_detail: orNull(i.action_detail),
    spare_parts_detail: orNull(i.spare_parts_detail),
    repair_cost: i.repair_cost ?? null,
    finish_date: i.finish_date || null,
    recommendations: orNull(i.recommendations),
    additional_notes: orNull(i.additional_notes),
    attachment_urls: i.attachment_urls && i.attachment_urls.length ? i.attachment_urls : null,
    work_hours: i.work_hours ?? null,
    updated_at: iso(ctx),
  };
}

export function icoSaveWork(t: Ticket, svc: TicketService | null, input: WorkInput, send: boolean, ctx: Ctx): Transition {
  if (svc?.work_owner === 'ITL') throw new WorkflowError('งานนี้เป็นงาน Direct ITL — ICO ไม่ต้องบันทึกรายละเอียดงาน');
  if (!ICO_CAN_WORK.includes(t.status)) throw new WorkflowError('ตั๋วนี้ไม่ได้อยู่ในขั้นตอนที่ ICO บันทึกงานได้');
  if (!clean(input.staff_name) || !clean(input.action_detail)) throw new WorkflowError('กรุณาระบุชื่อเจ้าหน้าที่และการให้บริการ');

  const now = iso(ctx);
  const servicePatch = workPatch(input, 'ICO', ctx);
  const newStatus: TicketStatus = send ? 'ITL_WAIT' : ['OPEN', 'MGR_WAIT'].includes(t.status) ? 'ICO_WORK' : t.status;
  const ticketPatch: Partial<Ticket> = send
    ? { status: newStatus, ico_submitted_at: now }
    : { status: newStatus, ico_received_at: t.ico_received_at ?? now };
  const logComment = send ? 'ICO บันทึกงานและส่งต่อ ITL' : 'ICO บันทึกร่าง';
  return {
    ticketPatch,
    servicePatch,
    logs: [{
      ticket_no: t.ticket_no, step_name: 'ICT_ACTION', status: send ? 'APPROVED' : 'DRAFT',
      action_by: clean(input.staff_name), comment: logComment,
    }],
    event: baseEvent(t, ctx, send ? 'ICT_ACTION' : 'ICO_DRAFT', send ? 'SUBMITTED' : 'DRAFT', newStatus, {
      staff_name: clean(input.staff_name), job_category: input.job_category || '',
      inspection_detail: input.inspection_detail || '', action_detail: input.action_detail || '',
      spare_parts: input.spare_parts_detail || '', repair_cost: input.repair_cost || 0,
      finish_date: input.finish_date || '', priority: input.priority ?? 'NORMAL',
    }),
  };
}

/* ═══════════════ 4) ICO ส่งตรงให้ ITL (admin-ico.js → forwardDirectToITL) ═══════════════ */
export function icoDirectForward(t: Ticket, svc: TicketService | null, by: string, ctx: Ctx): Transition {
  if (svc) throw new WorkflowError('งานนี้มีรายละเอียดงานอยู่แล้ว จึงไม่สามารถเปลี่ยนเป็นงาน Direct ITL ได้');
  if (!ICO_CAN_WORK.includes(t.status)) throw new WorkflowError('ตั๋วนี้ไม่ได้อยู่ในขั้นตอนที่ ICO ส่งต่อได้');
  const who = clean(by) || 'ICO';
  return {
    servicePatch: { work_owner: 'ITL', updated_at: iso(ctx) },
    ticketPatch: { status: 'ITL_WAIT', ico_submitted_at: iso(ctx) },
    logs: [{
      ticket_no: t.ticket_no, step_name: 'ICO_CHECK', status: 'DIRECT_FORWARD_ITL', action_by: who,
      comment: 'ICO ส่งต่องานให้ ITL ดำเนินการโดยตรง (ไม่ผ่านการบันทึกงานของ ICO)',
    }],
    event: baseEvent(t, ctx, 'DIRECT_FORWARD_ITL', 'SUBMITTED', 'ITL_WAIT', { forwarded_by: who }),
  };
}

/* ═══════════════ 5) ITL บันทึกงาน Direct ITL (admin-itl.js → saveITLWork) ═══════════════ */
export function itlSaveWork(t: Ticket, svc: TicketService | null, input: WorkInput, comment: string | undefined, ctx: Ctx): Transition {
  if (svc?.work_owner !== 'ITL') throw new WorkflowError('บันทึกงาน ITL ได้เฉพาะงานที่ ICO ส่งตรงให้ ITL');
  if (!clean(input.staff_name)) throw new WorkflowError('กรุณาระบุชื่อ ITL ผู้ปฏิบัติงาน');
  const staff = clean(input.staff_name);
  const logs: NewLog[] = [{
    ticket_no: t.ticket_no, step_name: 'ITL_WORK', status: 'DRAFT', action_by: staff,
    comment: 'ITL บันทึกรายละเอียดงานที่ดำเนินการเอง',
  }];
  if (clean(comment)) {
    logs.push({ ticket_no: t.ticket_no, step_name: 'ITL_APPROVE', status: 'COMMENT', action_by: staff, comment: clean(comment) });
  }
  const patch = workPatch(input, 'ITL', ctx);
  // เหมือนต้นฉบับ: ไม่ทับ attachment_urls ถ้าไม่มีไฟล์ใหม่ และไม่แตะ additional_notes
  if (!patch.attachment_urls) delete patch.attachment_urls;
  delete patch.additional_notes;
  return { servicePatch: patch, logs };
}

/* ═══════════════ 6) ITL ตรวจสอบ: อนุมัติ / ตีกลับ ICO (admin-itl.js → doAction) ═══════════════ */
export type ItlAction = 'ITL_APPROVE' | 'BACK_TO_ICO';
export function itlDecision(
  t: Ticket, svc: TicketService | null, action: ItlAction, comment: string | undefined, by: string,
  wsMaster: WorkStatusMaster[], ctx: Ctx,
): Transition {
  if (t.status !== 'ITL_WAIT') throw new WorkflowError('รายการนี้ไม่ได้อยู่ในขั้นตอนรอตรวจสอบโดยหัวหน้า ICO');
  const cm = clean(comment);
  if (action === 'BACK_TO_ICO' && !cm) throw new WorkflowError('กรุณาระบุเหตุผลก่อนตีกลับ');
  if (!clean(by)) throw new WorkflowError('ไม่พบข้อมูลผู้ใช้งาน กรุณา Login ใหม่');
  const newStatus: TicketStatus = action === 'ITL_APPROVE' ? 'ITM_WAIT' : 'ICO_WORK';
  const ws = svc?.work_status ? wsMaster.find((w) => w.code === svc.work_status) : null;
  const suffix = ws ? ` (สถานะงานล่าสุด: ${ws.icon || ''} ${ws.name_th})`.replace('  ', ' ') : '';
  return {
    ticketPatch: {
      status: newStatus, itl_approved_at: iso(ctx), itl_name: clean(by),
      itl_status: action === 'ITL_APPROVE' ? 'ITL_APPROVE' : 'BACK_TO_ICO', itl_comment: cm || null,
    },
    logs: [{
      ticket_no: t.ticket_no, step_name: 'ITL_APPROVE', status: action === 'ITL_APPROVE' ? 'APPROVED' : 'BACK_TO_ICO',
      action_by: clean(by), comment: (cm + suffix).trim() || null,
    }],
    event: baseEvent(t, ctx, action === 'ITL_APPROVE' ? 'ITL_APPROVE' : 'REJECTED', action, newStatus, {
      itl_name: clean(by), itl_comment: cm, itl_approved_at: iso(ctx),
    }),
  };
}

/* ═══════════════ 7) IT Manager พิจารณา (admin-itm.js → doAction) ═══════════════ */
export type ItmAction = 'ITM_APPROVE' | 'CANCELLED' | 'BACK_TO_ITL' | 'BACK_TO_ICO';
export function itmDecision(
  t: Ticket, svc: TicketService | null, action: ItmAction, comment: string | undefined, by: string, ctx: Ctx,
): Transition {
  if (t.status !== 'ITM_WAIT') throw new WorkflowError('รายการนี้ไม่ได้อยู่ในขั้นตอนรออนุมัติ ITM');
  if (svc?.work_owner === 'ITL' && action === 'BACK_TO_ICO') throw new WorkflowError('งาน Direct ITL ต้องตีกลับให้ ITL เท่านั้น');
  const cm = clean(comment);
  if (action !== 'ITM_APPROVE' && !cm) throw new WorkflowError('กรุณาระบุเหตุผล');
  if (!clean(by)) throw new WorkflowError('ไม่พบข้อมูลผู้ใช้งาน กรุณา Login ใหม่');
  const map: Record<ItmAction, TicketStatus> = {
    ITM_APPROVE: 'ICO_FINAL', CANCELLED: 'CANCELLED', BACK_TO_ITL: 'ITL_WAIT', BACK_TO_ICO: 'ICO_WORK',
  };
  const newStatus = map[action];
  const logStatus = action === 'ITM_APPROVE' ? 'APPROVED' : action;
  const evName = action === 'ITM_APPROVE' ? 'IT_MGR_APPROVE' : action === 'CANCELLED' ? 'CANCELLED' : 'REJECTED';
  return {
    ticketPatch: {
      status: newStatus, itm_approved_at: action === 'ITM_APPROVE' ? iso(ctx) : null,
      itm_name: clean(by), itm_status: action === 'ITM_APPROVE' ? 'ITM_APPROVE' : action, itm_comment: cm || null,
    },
    logs: [{
      ticket_no: t.ticket_no, step_name: 'IT_MGR_APPROVE', status: logStatus as NewLog['status'],
      action_by: clean(by), comment: cm || null,
    }],
    event: baseEvent(t, ctx, evName, action, newStatus, {
      itm_name: clean(by), itm_comment: cm,
      itm_approved_at: action === 'ITM_APPROVE' ? iso(ctx) : '',
      repair_cost: svc?.repair_cost || 0, action_detail: svc?.action_detail || '',
    }),
  };
}

/* ═══════════════ 8) ICO ปิดงาน (admin-ico.js → closeWork) ═══════════════ */
export interface CloseInput {
  staff: string;
  summary?: string;
  result?: CloseResult | '';
  finish_date?: string | null;
  /** ค่าฟอร์มงาน ICO ที่แก้ไขพร้อมกัน (ต้นฉบับเรียก saveServiceData ก่อนปิด) */
  work?: WorkInput;
}
export function icoClose(t: Ticket, svc: TicketService | null, input: CloseInput, ctx: Ctx): Transition {
  if (t.status !== 'ICO_FINAL') throw new WorkflowError('ปิดงานได้เฉพาะงานที่ IT Manager อนุมัติแล้ว (รอปิดงาน)');
  const direct = svc?.work_owner === 'ITL';
  const summary = clean(input.summary);
  if (!direct && !summary) throw new WorkflowError('กรุณากรอกสรุปผลการดำเนินงานก่อนปิด');
  const today = ctx.now.toISOString().slice(0, 10);
  const finish = input.finish_date || today;
  const staff = clean(input.staff) || 'ICO';
  let servicePatch: Partial<TicketService> | undefined;
  if (!direct) {
    servicePatch = {
      ...(input.work ? workPatch({ ...input.work, staff_name: input.work.staff_name || staff }, 'ICO', ctx) : {}),
      close_summary: summary, close_result: (input.result as CloseResult) || null, finish_date: finish,
      updated_at: iso(ctx),
    };
  }
  return {
    servicePatch,
    ticketPatch: { status: 'DONE', closed_at: iso(ctx) },
    logs: [{
      ticket_no: t.ticket_no, step_name: 'ICT_ACTION', status: 'DONE', action_by: staff,
      comment: direct ? 'ICO ปิดงาน Direct ITL หลัง ITM อนุมัติ' : `ปิดงาน — ${summary}`,
    }],
    event: baseEvent(t, ctx, 'DONE', 'CLOSED', 'DONE', {
      staff_name: staff, close_summary: direct ? '' : summary, close_result: input.result || '',
      finish_date: finish, repair_cost: svc?.repair_cost || 0, closed_at: iso(ctx),
      survey_link: surveyLink(t, ctx),
    }),
  };
}

/* ═══════════════ 9) คอมเมนต์ / บันทึกภายในทีม + @mention ═══════════════ */
const STEP_BY_ROLE = { ICO: 'ICO_CHECK', ITL: 'ITL_APPROVE', ITM: 'IT_MGR_APPROVE' } as const;
export function addComment(
  t: Ticket, role: Role, by: string, text: string, internal: boolean, mention: Role | '' | null,
): Transition {
  const msg = clean(text);
  if (!msg) throw new WorkflowError('กรุณาพิมพ์ความเห็นก่อน');
  return {
    logs: [{
      ticket_no: t.ticket_no, step_name: STEP_BY_ROLE[role], status: internal ? 'INTERNAL_NOTE' : 'COMMENT',
      action_by: clean(by) || role, comment: msg, mentioned_role: mention || null,
    }],
  };
}

/* ═══════════════ 10) อัปเดตสถานะงานย่อย (ws-bar.js → wsQuickUpdate) ═══════════════ */
export function updateWorkStatus(
  t: Ticket, svc: TicketService | null, code: string, text: string | undefined, role: Role, by: string,
  mention: Role | '' | null, master: WorkStatusMaster[], ctx: Ctx,
): Transition {
  if (!svc) throw new WorkflowError('ตั๋วนี้ยังไม่มีข้อมูลงานให้อัปเดตสถานะ (ICO/ITL ต้องบันทึกงานก่อน 1 ครั้ง)');
  const w = master.find((x) => x.code === code);
  const label = w ? `${w.icon ? w.icon + ' ' : ''}${w.name_th}` : code;
  const prev = svc.work_status ? master.find((x) => x.code === svc.work_status) : null;
  const from = prev ? `${prev.name_th} → ` : '';
  const note = clean(text);
  return {
    servicePatch: { work_status: code, work_status_note: note || null, work_status_at: iso(ctx), updated_at: iso(ctx) },
    logs: [{
      ticket_no: t.ticket_no, step_name: 'WORK_STATUS', status: 'INTERNAL_NOTE', action_by: clean(by) || role,
      comment: `[${role}] สถานะงาน: ${from}${label}${note ? ' — ' + note : ''}`, mentioned_role: mention || null,
    }],
  };
}

/* ═══════════════ 11) ผู้แจ้งส่งแบบประเมิน (survey.js → submitSurvey) ═══════════════ */
export interface SurveyInput {
  scores: [number, number, number, number, number];
  chk_resolved: boolean;
  chk_explained: boolean;
  comment?: string;
  signerName?: string;
  signatureData?: string | null;
}
export const SURVEY_MAX = [30, 30, 20, 10, 10] as const;

export function surveyTotal(scores: readonly number[]): number {
  return scores.reduce((a, b) => a + b, 0);
}

export function surveySubmit(
  t: Ticket, existing: Pick<Survey, 'score_total'> | null, input: SurveyInput, ctx: Ctx,
): { survey: Omit<Survey, 'id' | 'created_at'>; ticketPatch: Partial<Ticket>; event: AutomationEvent } {
  if (!['DONE', 'ICO_FINAL'].includes(t.status)) throw new WorkflowError('งานนี้ยังไม่ได้ปิด จึงยังประเมินไม่ได้');
  if (existing) throw new WorkflowError('คุณส่งแบบประเมินแล้ว ขอบคุณ!');
  input.scores.forEach((s, i) => {
    if (!Number.isFinite(s) || s < 0 || s > SURVEY_MAX[i]) throw new WorkflowError(`คะแนนข้อ ${i + 1} ไม่ถูกต้อง`);
  });
  const total = surveyTotal(input.scores);
  if (total === 0) throw new WorkflowError('กรุณาให้คะแนนอย่างน้อย 1 หัวข้อก่อน');
  const drawn = !!input.signatureData;
  const signer = drawn ? '[ลายเซ็น]' : clean(input.signerName);
  if (!signer) throw new WorkflowError(drawn ? 'กรุณาเซ็นชื่อในกล่องลายเซ็นก่อนส่ง' : 'กรุณาพิมพ์ชื่อ-นามสกุลผู้ประเมินก่อนส่ง');
  const [q1, q2, q3, q4, q5] = input.scores;
  return {
    survey: {
      ticket_no: t.ticket_no, score_q1: q1, score_q2: q2, score_q3: q3, score_q4: q4, score_q5: q5,
      score_total: total, chk_resolved: input.chk_resolved, chk_explained: input.chk_explained,
      comment: orNull(input.comment), submitted_by: signer, signature_data: input.signatureData || null,
    },
    ticketPatch: { survey_score: total },
    event: baseEvent(t, ctx, 'SURVEY_SUBMITTED', 'SUBMITTED', undefined, {
      score_total: total, score_q1: q1, score_q2: q2, score_q3: q3, score_q4: q4, score_q5: q5,
      chk_resolved: input.chk_resolved, chk_explained: input.chk_explained, submitted_by: signer,
      comment: clean(input.comment),
    }),
  };
}

/* ═══════════════ Queries ที่ใช้ซ้ำใน ICO / Dashboard ═══════════════ */

/** แถว log ล่าสุด (ไม่นับ COMMENT/INTERNAL_NOTE) ต่อ ticket — เหมือน loadBounceMap เดิม */
export function latestStepLog(logs: TicketLog[]): Record<string, TicketLog> {
  const sorted = [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  const map: Record<string, TicketLog> = {};
  for (const l of sorted) {
    if (l.status === 'COMMENT' || l.status === 'INTERNAL_NOTE') continue;
    if (l.ticket_no && !map[l.ticket_no]) map[l.ticket_no] = l;
  }
  return map;
}

/** "ถูกตีกลับ ยังไม่แก้ไข" = log ล่าสุดคือ BACK_TO_ICO และสถานะปัจจุบันยัง ICO_WORK */
export function isBounced(t: Ticket, latest: Record<string, TicketLog>): boolean {
  const l = latest[t.ticket_no];
  return !!(l && t.status === 'ICO_WORK' && l.status === 'BACK_TO_ICO');
}

/** ตีกลับให้ ITL (ITM → ITL) — Recommendation: เดิม dashboard ไม่ตรวจ (REVIEW-ISSUES #11) */
export function isBouncedToItl(t: Ticket, latest: Record<string, TicketLog>): boolean {
  const l = latest[t.ticket_no];
  return !!(l && t.status === 'ITL_WAIT' && l.status === 'BACK_TO_ITL');
}

/** สิทธิ์ของ action ตามบทบาทและสถานะ (ใช้ซ่อน/แสดงปุ่มใน UI) */
export function availableActions(t: Ticket, svc: TicketService | null) {
  const direct = svc?.work_owner === 'ITL';
  return {
    managerCanDecide: MANAGER_CAN_DECIDE.includes(t.status) && !t.mgr_status,
    icoCanWork: ICO_CAN_WORK.includes(t.status) && !direct,
    icoCanDirectForward: ICO_CAN_WORK.includes(t.status) && !svc,
    icoCanClose: t.status === 'ICO_FINAL',
    itlCanDecide: t.status === 'ITL_WAIT',
    itlCanSaveWork: t.status === 'ITL_WAIT' && direct,
    itmCanDecide: t.status === 'ITM_WAIT',
    itmCanBackToIco: t.status === 'ITM_WAIT' && !direct,
    isDirectItl: direct,
  };
}
