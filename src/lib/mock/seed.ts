/**
 * Seed Mock Data — สร้างโดย "เล่นซ้ำ" workflow machine จริงทุกขั้นตอน
 * จึงได้ตั๋ว/สถานะ/log/ผลประเมิน ที่สอดคล้องกันเสมอ (ไม่ใช่ข้อมูลที่แต่งขึ้นมาลอยๆ)
 * วันที่ทั้งหมดอิงจาก "ตอนนี้" ทำให้ตัวกรองเดือน/ไตรมาสใน Dashboard มีข้อมูลเสมอ
 */
import type {
  CloseResult, JobCategory, Role, Survey, Ticket, TicketService,
} from '@/types';
import * as W from '@/lib/workflow/machine';
import { WORK_STATUS_FALLBACK } from '@/lib/constants';
import { nextTicketNo } from '@/lib/utils/ticketNo';
import { applyTransition, emptyDb, newTicketRecord, type MockDB } from './db';
import { MOCK_CATALOG } from './categories';
import { MOCK_REQUESTERS, MOCK_USERS } from './users';

/* PRNG แบบกำหนดผลลัพธ์ได้ (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Step =
  | { t: 'mgr'; ok: boolean; comment?: string }
  | { t: 'ico_draft' }
  | { t: 'ico_send' }
  | { t: 'ico_direct' }
  | { t: 'itl_save' }
  | { t: 'itl_ok'; comment?: string }
  | { t: 'itl_back'; comment: string }
  | { t: 'itm_ok'; comment?: string }
  | { t: 'itm_cancel'; comment: string }
  | { t: 'itm_back_ico'; comment: string }
  | { t: 'itm_back_itl'; comment: string }
  | { t: 'close' }
  | { t: 'survey'; scores?: [number, number, number, number, number]; comment?: string; resolved?: boolean }
  | { t: 'comment'; role: Role; text: string; internal?: boolean; mention?: Role }
  | { t: 'ws'; code: string; note?: string; role: Role };

interface Spec {
  /** อายุของคำขอ (วัน) นับจากปัจจุบัน */
  ageDays: number;
  requesterIdx?: number;
  cat?: JobCategory;
  urgent?: boolean;
  issue?: string;
  asset?: string;
  steps: Step[];
  /** ช่วงเวลารวมของขั้นตอน (วัน) — ค่าเริ่มต้นสุ่ม 1-6 วัน แต่ไม่เกินอายุ */
  spanDays?: number;
  cost?: number;
}

const ICO = MOCK_USERS.filter((u) => u.role === 'ICO');
const ITL = MOCK_USERS.find((u) => u.role === 'ITL')!;
const ITM = MOCK_USERS.find((u) => u.role === 'ITM')!;
const SEED_ORIGIN = '';

const CTX = (d: Date): W.Ctx => ({ now: d, origin: SEED_ORIGIN });

function hexToken(r: () => number): string {
  let s = '';
  for (let i = 0; i < 48; i++) s += Math.floor(r() * 16).toString(16);
  return s;
}

function buildOne(db: MockDB, spec: Spec, idx: number, now: Date, r: () => number): void {
  const req = MOCK_REQUESTERS[(spec.requesterIdx ?? Math.floor(r() * MOCK_REQUESTERS.length)) % MOCK_REQUESTERS.length];
  const cat: JobCategory = spec.cat ?? (['Hardware', 'Hardware', 'Software', 'Software', 'Network', 'Other'] as JobCategory[])[Math.floor(r() * 6)];
  const cat_ = MOCK_CATALOG[cat];
  const start = new Date(now.getTime() - spec.ageDays * 86400000);
  const span = Math.min(spec.ageDays * 0.9, spec.spanDays ?? 1 + r() * 5) * 86400000;
  const n = Math.max(spec.steps.length, 1);

  const no = nextTicketNo(db.tickets.map((t) => t.ticket_no), start);
  const issue = spec.issue ?? cat_.issues[Math.floor(r() * cat_.issues.length)];
  const required = new Date(start.getTime() + (2 + Math.floor(r() * 5)) * 86400000).toISOString().slice(0, 10);
  const ticket = newTicketRecord(
    {
      requester_name: req.name, department: req.department, location: req.location, required_date: required,
      asset_id: spec.asset ?? (r() < 0.45 ? `ICT-${String(100 + Math.floor(r() * 899))}` : null),
      issue_detail: issue, requester_email: req.email, manager_email: req.managerEmail,
    },
    no, start, { approve: hexToken(r), survey: hexToken(r), track: hexToken(r) },
  );
  db.tickets.push(ticket);

  const ico = ICO[idx % ICO.length];
  const cost = spec.cost ?? cat_.costs[Math.floor(r() * cat_.costs.length)];
  const action = cat_.actions[Math.floor(r() * cat_.actions.length)];
  const insp = cat_.inspections[Math.floor(r() * cat_.inspections.length)];
  const part = cat_.parts[Math.floor(r() * cat_.parts.length)];

  const workFor = (staff: string, at: Date, done: boolean): W.WorkInput => ({
    staff_name: staff, received_date: at.toISOString().slice(0, 10), job_category: cat,
    priority: spec.urgent ? 'URGENT' : 'NORMAL', inspection_detail: insp, action_detail: action,
    spare_parts_detail: part, repair_cost: cost || null, finish_date: done ? at.toISOString().slice(0, 10) : null,
    recommendations: r() < 0.3 ? 'แนะนำให้ตรวจเช็คตามรอบ PM ทุก 6 เดือน' : null, additional_notes: null,
    work_hours: Math.round((0.5 + r() * 5) * 2) / 2,
  });

  spec.steps.forEach((step, i) => {
    const at = new Date(start.getTime() + (span * (i + 1)) / (n + 1));
    const ctx = CTX(at);
    const t = db.tickets.find((x) => x.ticket_no === no)!;
    const svc: TicketService | null = db.services.find((s) => s.ticket_no === no) || null;
    switch (step.t) {
      case 'mgr':
        applyTransition(db, no, W.managerDecision(t, {
          action: step.ok ? 'APPROVED' : 'REJECTED', name: `หัวหน้า${req.department}`,
          comment: step.comment ?? (step.ok ? '' : 'งบประมาณไม่เพียงพอ ขอเลื่อนไปไตรมาสหน้า'),
        }, ctx), at);
        break;
      case 'ico_draft':
        applyTransition(db, no, W.icoSaveWork(t, svc, workFor(ico.display_name, at, false), false, ctx), at);
        break;
      case 'ico_send':
        applyTransition(db, no, W.icoSaveWork(t, svc, workFor(ico.display_name, at, true), true, ctx), at);
        break;
      case 'ico_direct':
        applyTransition(db, no, W.icoDirectForward(t, svc, ico.display_name, ctx), at);
        break;
      case 'itl_save':
        applyTransition(db, no, W.itlSaveWork(t, svc, workFor(ITL.display_name, at, true), undefined, ctx), at);
        break;
      case 'itl_ok':
        applyTransition(db, no, W.itlDecision(t, svc, 'ITL_APPROVE', step.comment, ITL.display_name, WORK_STATUS_FALLBACK, ctx), at);
        break;
      case 'itl_back':
        applyTransition(db, no, W.itlDecision(t, svc, 'BACK_TO_ICO', step.comment, ITL.display_name, WORK_STATUS_FALLBACK, ctx), at);
        break;
      case 'itm_ok':
        applyTransition(db, no, W.itmDecision(t, svc, 'ITM_APPROVE', step.comment, ITM.display_name, ctx), at);
        break;
      case 'itm_cancel':
        applyTransition(db, no, W.itmDecision(t, svc, 'CANCELLED', step.comment, ITM.display_name, ctx), at);
        break;
      case 'itm_back_ico':
        applyTransition(db, no, W.itmDecision(t, svc, 'BACK_TO_ICO', step.comment, ITM.display_name, ctx), at);
        break;
      case 'itm_back_itl':
        applyTransition(db, no, W.itmDecision(t, svc, 'BACK_TO_ITL', step.comment, ITM.display_name, ctx), at);
        break;
      case 'close': {
        const direct = svc?.work_owner === 'ITL';
        applyTransition(db, no, W.icoClose(t, svc, {
          staff: ico.display_name, summary: direct ? '' : `${action} — ใช้งานได้ปกติ`,
          result: ['RESOLVED', 'RESOLVED', 'RESOLVED', 'PARTIAL', 'REPLACED'][Math.floor(r() * 5)] as CloseResult,
          finish_date: at.toISOString().slice(0, 10),
        }, ctx), at);
        break;
      }
      case 'survey': {
        const base = (m: number) => Math.max(0, Math.min(m, Math.round(m * (0.82 + r() * 0.18))));
        const scores = step.scores ?? ([base(30), base(30), base(20), base(10), base(10)] as [number, number, number, number, number]);
        const existing = db.surveys.find((s) => s.ticket_no === no) || null;
        const res = W.surveySubmit(t, existing, {
          scores, chk_resolved: step.resolved ?? true, chk_explained: true, comment: step.comment,
          signerName: req.name,
        }, ctx);
        const row: Survey = { ...res.survey, id: `sv-${db.surveys.length + 1}`, created_at: at.toISOString() };
        db.surveys.push(row);
        Object.assign(t, res.ticketPatch);
        break;
      }
      case 'comment':
        applyTransition(db, no, W.addComment(t, step.role,
          step.role === 'ICO' ? ico.display_name : step.role === 'ITL' ? ITL.display_name : ITM.display_name,
          step.text, !!step.internal, step.mention ?? null), at);
        break;
      case 'ws':
        applyTransition(db, no, W.updateWorkStatus(t, svc, step.code, step.note, step.role,
          step.role === 'ICO' ? ico.display_name : ITL.display_name, null, WORK_STATUS_FALLBACK, ctx), at);
        break;
    }
  });
}

const FULL: Step[] = [{ t: 'mgr', ok: true }, { t: 'ico_send' }, { t: 'itl_ok' }, { t: 'itm_ok' }, { t: 'close' }];
const FULL_DIRECT: Step[] = [{ t: 'mgr', ok: true }, { t: 'ico_direct' }, { t: 'itl_save' }, { t: 'itl_ok' }, { t: 'itm_ok' }, { t: 'close' }];

/** ตั๋วสถานการณ์ — ทุกสถานะ/เส้นทางของ workflow มีตัวอย่างให้กดทดสอบ */
function scenarios(): Spec[] {
  return [
    { ageDays: 0.3, requesterIdx: 3, cat: 'Hardware', issue: 'เครื่องพิมพ์ในไลน์ผลิตกระดาษติดบ่อย พิมพ์ฉลากไม่ได้', steps: [], urgent: true },
    { ageDays: 1.4, requesterIdx: 1, cat: 'Software', issue: 'โปรแกรมบัญชีเปิดไม่ขึ้น ขึ้นข้อความ License expired', steps: [] },
    { ageDays: 6, requesterIdx: 5, cat: 'Hardware', issue: 'ขอเปลี่ยนจอมอนิเตอร์เป็นจอใหญ่ 27 นิ้ว', steps: [{ t: 'mgr', ok: false, comment: 'งบประมาณไม่เพียงพอ ขอเลื่อนไปไตรมาสหน้า' }] },
    { ageDays: 2, requesterIdx: 0, cat: 'Network', issue: 'อินเทอร์เน็ตห้อง HR ช้ามาก เข้าระบบ ERP ไม่ได้', steps: [{ t: 'mgr', ok: true }] },
    { ageDays: 3, requesterIdx: 2, cat: 'Hardware', issue: 'โน้ตบุ๊กห้องแล็บเปิดไม่ติด ไฟไม่เข้า', steps: [{ t: 'mgr', ok: true }, { t: 'ico_draft' }, { t: 'ws', code: 'WS_DIAG', role: 'ICO', note: 'กำลังตรวจสอบบอร์ดและอะแดปเตอร์' }, { t: 'comment', role: 'ICO', text: 'ขอข้อมูล Serial Number จากผู้ใช้เพิ่มเติม', mention: 'ITL' }] },
    { ageDays: 5, requesterIdx: 6, cat: 'Hardware', issue: 'พัดลมเครื่อง CNC Controller เสียงดัง เครื่องรีสตาร์ทเอง', steps: [{ t: 'mgr', ok: true }, { t: 'ico_send' }, { t: 'itl_back', comment: 'ข้อมูลอะไหล่ไม่ครบ กรุณาแนบใบเสนอราคาและรหัสอะไหล่' }], cost: 3200 },
    { ageDays: 8, requesterIdx: 3, cat: 'Hardware', urgent: true, issue: 'UPS ห้อง Server ส่งเสียงเตือน แบตเตอรี่เสื่อม', steps: [{ t: 'mgr', ok: true }, { t: 'ico_send' }, { t: 'itl_ok' }, { t: 'itm_back_ico', comment: 'ค่าใช้จ่ายสูงเกินไป ขอเปรียบเทียบราคาอย่างน้อย 3 ราย' }], cost: 9800 },
    { ageDays: 4, requesterIdx: 7, cat: 'Software', issue: 'ต้องการติดตั้ง AutoCAD บนเครื่องใหม่ 2 เครื่อง', steps: [{ t: 'mgr', ok: true }, { t: 'ico_send' }, { t: 'comment', role: 'ICO', text: 'ขอให้ ITL ตรวจสอบ License ก่อนอนุมัติ', internal: true, mention: 'ITL' }] },
    { ageDays: 2, requesterIdx: 8, cat: 'Network', issue: 'ขอเดินสาย LAN เพิ่ม 4 จุดสำหรับพนักงานใหม่', steps: [{ t: 'mgr', ok: true }, { t: 'ico_direct' }] },
    { ageDays: 7, requesterIdx: 9, cat: 'Network', issue: 'Wi-Fi ห้องประชุมใหญ่หลุดบ่อยระหว่างประชุมออนไลน์', steps: [{ t: 'mgr', ok: true }, { t: 'ico_send' }, { t: 'itl_ok' }, { t: 'itm_back_itl', comment: 'ขอผลการวัดสัญญาณ (Site Survey) แนบเพิ่มเติม' }] },
    { ageDays: 3.5, requesterIdx: 4, cat: 'Hardware', issue: 'เครื่องสแกนบาร์โค้ดคลังสินค้าอ่านไม่ได้ ต้องเปลี่ยนตัวใหม่', steps: [{ t: 'mgr', ok: true }, { t: 'ico_send' }, { t: 'itl_ok' }], cost: 4200 },
    { ageDays: 5.5, requesterIdx: 10, cat: 'Network', issue: 'ย้ายจุดเชื่อมต่อเครือข่ายไลน์ Packing ไปโซนใหม่', steps: [{ t: 'mgr', ok: true }, { t: 'ico_direct' }, { t: 'itl_save' }, { t: 'ws', code: 'WS_PART', role: 'ITL', note: 'รอสาย Fiber และ Switch จากผู้ขาย' }, { t: 'itl_ok' }], cost: 15800 },
    { ageDays: 6.5, requesterIdx: 0, cat: 'Hardware', issue: 'เปลี่ยน RAM โน้ตบุ๊กฝ่าย HR ให้เป็น 16GB', steps: [{ t: 'mgr', ok: true }, { t: 'ico_send' }, { t: 'itl_ok' }, { t: 'itm_ok', comment: 'อนุมัติตามงบประมาณปี' }] },
    { ageDays: 9, requesterIdx: 11, cat: 'Network', issue: 'ย้ายตู้ Rack ห้อง GA และจัดสายใหม่', steps: [{ t: 'mgr', ok: true }, { t: 'ico_direct' }, { t: 'itl_save' }, { t: 'itl_ok' }, { t: 'itm_ok' }], cost: 2500 },
    { ageDays: 10, requesterIdx: 1, cat: 'Software', steps: FULL },
    { ageDays: 4.5, requesterIdx: 2, cat: 'Hardware', steps: FULL },
    { ageDays: 12, requesterIdx: 6, cat: 'Hardware', steps: [...FULL, { t: 'survey', scores: [22, 20, 14, 8, 6], comment: 'แก้ไขได้ แต่รอนานกว่าที่แจ้งไว้ อยากให้ติดต่อกลับเร็วกว่านี้', resolved: true }] },
    { ageDays: 13, requesterIdx: 5, cat: 'Software', steps: [...FULL, { t: 'survey', scores: [30, 30, 20, 10, 10], comment: 'ขอบคุณทีม ICT ครับ ทำงานรวดเร็วมาก' }] },
    { ageDays: 15, requesterIdx: 4, cat: 'Hardware', steps: [{ t: 'mgr', ok: true }, { t: 'ico_send' }, { t: 'itl_ok' }, { t: 'itm_cancel', comment: 'ผู้ใช้แจ้งยกเลิกคำขอ เนื่องจากย้ายแผนก' }] },
  ];
}

/** ตั๋วย้อนหลัง 11 เดือน สำหรับกราฟ/สถิติ */
function historical(r: () => number): Spec[] {
  const out: Spec[] = [];
  for (let m = 1; m <= 11; m++) {
    const count = 5 + Math.floor(r() * 6);
    for (let i = 0; i < count; i++) {
      const ageDays = m * 30 + (r() * 24 - 12);
      const roll = r();
      let steps: Step[];
      if (roll < 0.05) steps = [{ t: 'mgr', ok: false }];
      else if (roll < 0.09) steps = [{ t: 'mgr', ok: true }, { t: 'ico_send' }, { t: 'itl_ok' }, { t: 'itm_cancel', comment: 'ผู้ใช้ยกเลิกคำขอ' }];
      else {
        const direct = r() < 0.2;
        steps = (direct ? FULL_DIRECT : FULL).slice();
        // ตัวอย่างงานที่เคยถูก ITL ตีกลับครั้งหนึ่งก่อนผ่าน (เฉพาะงาน ICO ปกติ)
        if (!direct && r() < 0.25) steps.splice(2, 0, { t: 'itl_back', comment: 'กรุณาแนบรายละเอียดอะไหล่เพิ่มเติม' }, { t: 'ico_send' });
        if (r() < 0.82) steps.push({ t: 'survey' });
      }
      out.push({ ageDays, urgent: r() < 0.12, steps, spanDays: 2 + r() * 8 });
    }
  }
  return out;
}

export function buildSeed(now: Date = new Date(), seed = 20260701): MockDB {
  const r = rng(seed);
  const db = emptyDb();
  const specs = [...historical(r), ...scenarios()];
  // สร้างเรียงตามเวลา เพื่อให้เลขตั๋วรายเดือนเรียงถูกต้อง
  specs.sort((a, b) => b.ageDays - a.ageDays);
  specs.forEach((s, i) => buildOne(db, s, i, now, r));
  return db;
}
