/**
 * Use-case layer — จุดเดียวที่ UI เรียกเพื่อ "ทำงาน" (ส่งคำขอ, อนุมัติ, บันทึกงาน, ปิดงาน, ประเมิน ฯลฯ)
 * ประกอบ 3 ส่วน:  workflow machine (กติกา)  →  Repository (บันทึกลง Mock/Supabase)  →  AutomationService (Email/Notify)
 * UI ไม่ต้องรู้ว่าข้างหลังเป็น Mock หรือ Supabase หรือ n8n
 */
import type {
  AutomationReceipt, NewTicketInput, Role, Survey, Ticket, TicketService, WorkStatusMaster,
} from '@/types';
import { WORK_STATUS_FALLBACK } from '@/lib/constants';
import { cleanRequest, validateFile, validateRequest } from '@/lib/validation';
import * as W from '@/lib/workflow/machine';
import type { AutomationService } from '@/lib/automation';
import type { Repository, TokenKind } from './repository';

export interface ActionResult {
  ticket: Ticket;
  service?: TicketService | null;
  receipt: AutomationReceipt | null;
}

export class TicketActions {
  wsMaster: WorkStatusMaster[] = WORK_STATUS_FALLBACK;
  constructor(
    private repo: Repository,
    private automation: AutomationService,
    private origin: () => string = () => (typeof window !== 'undefined' ? window.location.origin : ''),
  ) {}

  private ctx(): W.Ctx {
    return { now: new Date(), origin: this.origin() };
  }

  private async fire(tr: W.Transition, ticket: Ticket): Promise<AutomationReceipt | null> {
    if (!tr.event) return null;
    try {
      return await this.automation.dispatch(tr.event, ticket, this.origin());
    } catch (e) {
      // fire-and-forget แบบเดิม: automation ล้มเหลวต้องไม่ทำให้ workflow หลักล้ม
      console.warn('[automation]', e);
      return null;
    }
  }

  private async load(no: string) {
    const [ticket, svc] = await Promise.all([this.repo.getTicket(no), this.repo.getService(no)]);
    if (!ticket) throw new W.WorkflowError('ไม่พบข้อมูลคำขอ');
    return { ticket, svc };
  }

  private async run(
    no: string, build: (t: Ticket, svc: TicketService | null) => W.Transition, guard?: Ticket['status'][],
  ): Promise<ActionResult> {
    const { ticket, svc } = await this.load(no);
    const tr = build(ticket, svc);
    const res = await this.repo.commit(no, tr, guard);
    const receipt = await this.fire(tr, res.ticket);
    return { ticket: res.ticket, service: res.service, receipt };
  }

  private async uploadAll(files: File[] | undefined, folder: string): Promise<string[]> {
    if (!files?.length) return [];
    for (const f of files) {
      const err = validateFile(f);
      if (err) throw new W.WorkflowError(err);
    }
    return Promise.all(files.map((f) => this.repo.uploadFile(f, folder)));
  }

  /* ───────── ผู้แจ้ง ───────── */
  async submitRequest(
    input: NewTicketInput, files?: { images?: File[]; docs?: File[] },
  ): Promise<ActionResult> {
    const errs = validateRequest(input);
    const first = Object.values(errs)[0];
    if (first) throw new W.WorkflowError(first);
    const [imgs, docs] = await Promise.all([
      this.uploadAll(files?.images, 'images'),
      this.uploadAll(files?.docs, 'attachments'),
    ]);
    const ticket = await this.repo.createTicket({
      ...cleanRequest(input), issue_img_url: imgs.length ? imgs : null, attachment_url: docs.length ? docs : null,
    });
    const tr = W.requestSubmitted(ticket, this.ctx());
    return { ticket, receipt: await this.fire(tr, ticket) };
  }

  /** ข้อมูลสำหรับหน้า approve / survey / track (เห็นเฉพาะสิ่งที่ลิงก์นั้นต้องใช้) */
  async getPublic(kind: TokenKind, token: string) {
    return this.repo.getPublicTicket(kind, token);
  }

  /* ───────── หัวหน้างาน (Secure Token) ───────── */
  async managerDecide(
    token: string,
    input: { action: 'APPROVED' | 'REJECTED'; comment?: string; name?: string; signature?: Blob | null },
  ): Promise<ActionResult> {
    const view = await this.repo.getPublicTicket('approve', token);
    if (!view) throw new W.WorkflowError('ลิงก์ไม่ถูกต้องหรือหมดอายุ');
    // ตรวจกติกาก่อนอัปโหลดลายเซ็น — ไม่ทิ้งไฟล์ค้างใน Storage เมื่อใบงานถูกตัดสินไปแล้ว
    W.checkManagerDecision(view.ticket, { ...input, hasSignature: !!input.signature });
    let signatureUrl: string | null = null;
    if (input.signature) {
      const f = new File([input.signature], `${view.ticket.ticket_no}-mgr-${Date.now()}.png`, { type: 'image/png' });
      signatureUrl = await this.repo.uploadFile(f, 'signatures');
    }
    const tr = W.managerDecision(view.ticket, { ...input, signatureUrl, name: input.name ?? null }, this.ctx());
    const ticket = await this.repo.managerDecide(token, tr);
    return { ticket, receipt: await this.fire(tr, ticket) };
  }

  /* ───────── ICO ───────── */
  async icoSave(no: string, input: W.WorkInput, send: boolean, files?: File[]): Promise<ActionResult> {
    const urls = await this.uploadAll(files, `services/${no}`);
    return this.run(no, (t, svc) => W.icoSaveWork(t, svc, {
      ...input, attachment_urls: [...(svc?.attachment_urls || []), ...urls],
    }, send, this.ctx()), W.ICO_CAN_WORK);
  }
  async icoDirect(no: string, by: string): Promise<ActionResult> {
    return this.run(no, (t, svc) => W.icoDirectForward(t, svc, by, this.ctx()), W.ICO_CAN_WORK);
  }
  async icoClose(no: string, input: W.CloseInput): Promise<ActionResult> {
    return this.run(no, (t, svc) => W.icoClose(t, svc, input, this.ctx()), ['ICO_FINAL']);
  }

  /* ───────── ITL ───────── */
  async itlSave(no: string, input: W.WorkInput, comment: string | undefined, files?: File[]): Promise<ActionResult> {
    const urls = await this.uploadAll(files, `itl-services/${no}`);
    return this.run(no, (t, svc) => W.itlSaveWork(t, svc, {
      ...input, attachment_urls: urls.length ? [...(svc?.attachment_urls || []), ...urls] : null,
    }, comment, this.ctx()), ['ITL_WAIT']);
  }
  async itlDecide(no: string, action: W.ItlAction, comment: string | undefined, by: string): Promise<ActionResult> {
    return this.run(no, (t, svc) => W.itlDecision(t, svc, action, comment, by, this.wsMaster, this.ctx()), ['ITL_WAIT']);
  }

  /* ───────── ITM ───────── */
  async itmDecide(no: string, action: W.ItmAction, comment: string | undefined, by: string): Promise<ActionResult> {
    return this.run(no, (t, svc) => W.itmDecision(t, svc, action, comment, by, this.ctx()), ['ITM_WAIT']);
  }

  /* ───────── ใช้ร่วมกัน ───────── */
  async comment(no: string, role: Role, by: string, text: string, internal: boolean, mention: Role | '' | null): Promise<ActionResult> {
    return this.run(no, (t) => W.addComment(t, role, by, text, internal, mention));
  }
  async setWorkStatus(no: string, code: string, text: string | undefined, role: Role, by: string, mention: Role | '' | null): Promise<ActionResult> {
    return this.run(no, (t, svc) => W.updateWorkStatus(t, svc, code, text, role, by, mention, this.wsMaster, this.ctx()));
  }

  /* ───────── ผู้ใช้บริการประเมิน (Secure Token) ───────── */
  async submitSurvey(token: string, input: W.SurveyInput): Promise<{ survey: Survey; receipt: AutomationReceipt | null }> {
    const view = await this.repo.getPublicTicket('survey', token);
    if (!view) throw new W.WorkflowError('ลิงก์ไม่ถูกต้องหรือหมดอายุ');
    const res = W.surveySubmit(view.ticket, view.survey, input, this.ctx());
    const survey = await this.repo.submitSurvey(token, res.survey, res.ticketPatch);
    const receipt = await this.fire({ logs: [], event: res.event }, { ...view.ticket, ...res.ticketPatch });
    return { survey, receipt };
  }
}
