import type {
  CommentRead, NewTicketInput, Survey, Ticket, TicketLog, TicketService,
} from '@/types';
import { WORK_STATUS_FALLBACK } from '@/lib/constants';
import { applyTransition, newTicketRecord, type MockDB } from '@/lib/mock/db';
import { buildSeed } from '@/lib/mock/seed';
import { cleanRequest, validateRequest } from '@/lib/validation';
import { makeToken } from '@/lib/utils/token';
import { nextTicketNo } from '@/lib/utils/ticketNo';
import { MANAGER_CAN_DECIDE, type Transition } from '@/lib/workflow/machine';
import { toPublicTicket, toPublicView } from './publicView';
import type { NewSurvey, PublicTicketView, Repository, Snapshot, TokenKind } from './repository';

const KEY = 'ict-mock-db-v1';
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** แนบชื่อไฟล์ไว้ท้าย URL (#name=) เพื่อให้แสดงชื่อเดิมได้แม้เป็น data:/blob: URL */
export function withName(url: string, name: string) {
  return `${url}#name=${encodeURIComponent(name)}`;
}

/**
 * MockRepository — เก็บข้อมูลจำลองใน localStorage ของเบราว์เซอร์
 * (ฐานข้อมูลเริ่มต้นสร้างจาก buildSeed โดยเล่น workflow จริง) — ไม่มีการติดต่อเครือข่ายใดๆ
 */
export class MockRepository implements Repository {
  readonly kind = 'mock' as const;
  private db: MockDB;
  constructor(private opts: { latencyMs?: number; now?: () => Date; persist?: boolean } = {}) {
    this.db = this.load();
  }

  private now() { return this.opts.now ? this.opts.now() : new Date(); }
  private async lag() {
    const ms = this.opts.latencyMs ?? 0;
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }
  private load(): MockDB {
    if (this.opts.persist !== false && hasStorage()) {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as MockDB;
          if (parsed && Array.isArray(parsed.tickets) && parsed.tickets.length) return parsed;
        }
      } catch { /* ignore */ }
    }
    const fresh = buildSeed(this.now());
    this.save(fresh);
    return fresh;
  }
  private save(db: MockDB = this.db) {
    if (this.opts.persist === false || !hasStorage()) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      // เต็มโควต้า (เช่น แนบไฟล์ใหญ่) — ข้อมูลยังอยู่ในหน่วยความจำ แต่จะไม่คงอยู่หลังรีเฟรช
      console.warn('[mock] localStorage full — เปลี่ยนแปลงล่าสุดอาจไม่ถูกบันทึกถาวร');
    }
  }

  async snapshot(): Promise<Snapshot> {
    await this.lag();
    return clone({
      tickets: this.db.tickets, services: this.db.services, logs: this.db.logs, surveys: this.db.surveys,
      reads: this.db.reads, workStatus: WORK_STATUS_FALLBACK,
    });
  }

  async getTicket(no: string) {
    await this.lag();
    const t = this.db.tickets.find((x) => x.ticket_no === no);
    return t ? clone(t) : null;
  }

  private byToken(kind: TokenKind, token: string): Ticket | undefined {
    if (!token) return undefined;
    const field = `${kind}_token` as const;
    return this.db.tickets.find((x) => x[field] === token);
  }

  async getPublicTicket(kind: TokenKind, token: string): Promise<PublicTicketView | null> {
    await this.lag();
    const t = this.byToken(kind, token);
    if (!t) return null;
    const no = t.ticket_no;
    return clone(toPublicView(
      kind, t, this.db.services.find((s) => s.ticket_no === no) ?? null,
      this.db.logs.filter((l) => l.ticket_no === no), this.db.surveys.filter((s) => s.ticket_no === no),
    ));
  }

  async managerDecide(token: string, tr: Transition): Promise<Ticket> {
    await this.lag();
    const t = this.byToken('approve', token);
    if (!t) throw new Error('ลิงก์ไม่ถูกต้องหรือหมดอายุ');
    // เหมือน manager_decide(): ตัดสินได้ครั้งเดียว
    if (t.mgr_status) throw new Error('ใบงานนี้ถูกดำเนินการไปแล้ว หรือไม่ได้อยู่ในสถานะรออนุมัติ');
    const res = applyTransition(this.db, t.ticket_no, tr, this.now(), MANAGER_CAN_DECIDE);
    this.save();
    return clone(toPublicTicket(res.ticket, 'approve'));
  }

  async createTicket(input: NewTicketInput): Promise<Ticket> {
    await this.lag();
    const errs = validateRequest(input);
    if (Object.keys(errs).length) throw new Error(Object.values(errs)[0]);
    const clean = cleanRequest(input);
    const now = this.now();
    const no = nextTicketNo(this.db.tickets.map((t) => t.ticket_no), now);
    const t = newTicketRecord(clean, no, now, { approve: makeToken(), survey: makeToken(), track: makeToken() });
    this.db.tickets.unshift(t);
    this.save();
    return clone(toPublicTicket(t, 'create'));
  }

  async getService(no: string): Promise<TicketService | null> {
    await this.lag();
    const s = this.db.services.find((x) => x.ticket_no === no);
    return s ? clone(s) : null;
  }

  async listLogs(no: string): Promise<TicketLog[]> {
    await this.lag();
    return clone(this.db.logs.filter((l) => l.ticket_no === no).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id));
  }

  async getSurvey(no: string): Promise<Survey | null> {
    await this.lag();
    const s = this.db.surveys.filter((x) => x.ticket_no === no).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return s ? clone(s) : null;
  }

  async getReads(logIds: number[]): Promise<CommentRead[]> {
    const set = new Set(logIds);
    return clone(this.db.reads.filter((r) => set.has(r.log_id)));
  }

  async getMyReadLogIds(userId: string): Promise<number[]> {
    return this.db.reads.filter((r) => r.user_id === userId).map((r) => r.log_id);
  }

  async markRead(reads: Omit<CommentRead, 'read_at'>[]): Promise<void> {
    const at = this.now().toISOString();
    let changed = false;
    for (const r of reads) {
      if (!this.db.reads.some((x) => x.log_id === r.log_id && x.user_id === r.user_id)) {
        this.db.reads.push({ ...r, read_at: at });
        changed = true;
      }
    }
    if (changed) this.save();
  }

  async commit(no: string, tr: Transition, guard?: Ticket['status'][]) {
    await this.lag();
    // applyTransition ตรวจ guard ก่อนแก้ข้อมูล — ถ้าไม่ผ่านจะ throw โดยไม่เปลี่ยนอะไร
    const res = applyTransition(this.db, no, tr, this.now(), guard);
    this.save();
    return clone(res);
  }

  async submitSurvey(token: string, s: NewSurvey, ticketPatch: Partial<Ticket>): Promise<Survey> {
    await this.lag();
    const t = this.byToken('survey', token);
    if (!t || t.ticket_no !== s.ticket_no) throw new Error('ลิงก์ไม่ถูกต้องหรือหมดอายุ');
    if (t.status !== 'DONE' && t.status !== 'ICO_FINAL') throw new Error('งานนี้ยังไม่ได้ปิด จึงยังประเมินไม่ได้');
    if (this.db.surveys.some((x) => x.ticket_no === s.ticket_no)) throw new Error('คุณส่งแบบประเมินแล้ว ขอบคุณ!');
    const row: Survey = { ...s, id: `sv-${Date.now().toString(36)}-${this.db.surveys.length + 1}`, created_at: this.now().toISOString() };
    this.db.surveys.push(row);
    Object.assign(t, ticketPatch);
    this.save();
    return clone(row);
  }

  async uploadFile(file: File, folder: string): Promise<string> {
    await this.lag();
    // Mock: ไม่อัปโหลดจริง — ไฟล์ขนาดเล็กเก็บเป็น data URL (คงอยู่หลังรีเฟรช) ไฟล์ใหญ่ใช้ blob URL (หายเมื่อปิดแท็บ)
    void folder;
    const asData = file.size <= 350 * 1024;
    const url = asData
      ? await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error(`อัปโหลดไม่สำเร็จ: ${file.name}`));
          fr.readAsDataURL(file);
        })
      : URL.createObjectURL(file);
    return withName(url, file.name);
  }

  async resetDemo(): Promise<void> {
    this.db = buildSeed(this.now());
    this.save();
    try { if (hasStorage()) localStorage.removeItem('ict-mock-outbox-v1'); } catch { /* ignore */ }
  }
}
