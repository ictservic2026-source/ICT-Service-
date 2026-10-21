import type {
  CommentRead, NewLog, NewTicketInput, Profile, Role, Survey, Ticket, TicketLog, TicketService, WorkStatusMaster,
} from '@/types';
import type { Transition } from '@/lib/workflow/machine';

export interface Snapshot {
  tickets: Ticket[];
  services: TicketService[];
  logs: TicketLog[];
  surveys: Survey[];
  reads: CommentRead[];
  workStatus: WorkStatusMaster[];
}

export type TokenKind = 'approve' | 'survey' | 'track';

/** ข้อมูลที่ผู้ถือลิงก์สาธารณะได้รับ (ดู publicView.ts / public.get_public_ticket) */
export interface PublicTicketView {
  ticket: Ticket;
  /** เฉพาะ survey / track */
  service: Pick<TicketService, 'staff_name' | 'action_detail' | 'finish_date' | 'work_owner'> | null;
  /** เฉพาะ track — ไม่รวม COMMENT / INTERNAL_NOTE */
  logs: TicketLog[];
  survey: Pick<Survey, 'score_total' | 'created_at'> | null;
}

export type NewSurvey = Omit<Survey, 'id' | 'created_at'>;

/**
 * Data-layer interface — UI / service ทุกตัวคุยกับ DB ผ่านตัวนี้เท่านั้น
 * มี 2 implementation: MockRepository (localStorage) และ SupabaseRepository (ตารางเดิม)
 * เปลี่ยนด้วย NEXT_PUBLIC_DATA_SOURCE=mock|supabase
 */
export interface Repository {
  readonly kind: 'mock' | 'supabase';

  /** โหลดข้อมูลทั้งหมดสำหรับหน้า staff (ICO/ITL/ITM/Dashboard/Report) */
  snapshot(): Promise<Snapshot>;

  getTicket(no: string): Promise<Ticket | null>;

  /* ── ผู้ใช้ไม่ล็อกอิน: ทุกเมธอดในกลุ่มนี้ทำงานผ่าน token เท่านั้น (Supabase → RPC security definer) ── */
  /** เปิดตั๋วด้วย Secure Token จากลิงก์สาธารณะ — null ถ้า token ไม่ตรง */
  getPublicTicket(kind: TokenKind, token: string): Promise<PublicTicketView | null>;
  /** ผู้แจ้งค้นงานของตัวเอง: คืน track token เมื่อเลขที่งานและอีเมลผู้แจ้งตรงกัน (ไม่ตรง/ไม่มี = null) */
  findTrackToken(ticketNo: string, email: string): Promise<string | null>;
  /** คืนตั๋วพร้อม approve/survey/track token (ให้ผู้แจ้งเท่านั้น) */
  createTicket(input: NewTicketInput): Promise<Ticket>;
  /** บันทึกผลของหัวหน้างาน (tr จาก machine.managerDecision) — ตัดสินได้ครั้งเดียว */
  managerDecide(token: string, tr: Transition): Promise<Ticket>;
  /** บันทึกแบบประเมิน — 1 ครั้งต่อ 1 งาน */
  submitSurvey(token: string, s: NewSurvey, ticketPatch: Partial<Ticket>): Promise<Survey>;

  getService(no: string): Promise<TicketService | null>;
  listLogs(no: string): Promise<TicketLog[]>;
  getSurvey(no: string): Promise<Survey | null>;
  getReads(logIds: number[]): Promise<CommentRead[]>;
  markRead(reads: Omit<CommentRead, 'read_at'>[]): Promise<void>;
  /** log_id ที่ผู้ใช้คนนี้อ่านแล้ว (ใช้คำนวณ badge กระดิ่ง) */
  getMyReadLogIds(userId: string): Promise<number[]>;

  /**
   * เขียน Transition (ticket patch + service upsert + logs) ลงฐานข้อมูลเป็นชุดเดียว
   * `guardStatuses` — กันการกดซ้ำ: อัปเดตเฉพาะเมื่อสถานะปัจจุบันอยู่ในรายการ (เหมือน `status=in.(...)` ของ approve.js เดิม)
   */
  commit(no: string, tr: Transition, guardStatuses?: Ticket['status'][]): Promise<{ ticket: Ticket; service: TicketService | null; logs: TicketLog[] }>;

  uploadFile(file: File, folder: string): Promise<string>;

  /** Mock เท่านั้น: ล้างข้อมูลกลับเป็น seed */
  resetDemo?(): Promise<void>;
}

export interface AuthService {
  readonly kind: 'mock' | 'supabase';
  getSession(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  /** ใช้ในหน้า reset-password (หลังกดลิงก์ในอีเมล) */
  updatePassword(newPassword: string): Promise<void>;
  /** มี session สำหรับกู้รหัสผ่านอยู่หรือไม่ (หน้า reset-password) */
  hasRecoverySession(): Promise<boolean>;
  /** รายชื่อบัญชีตัวอย่างสำหรับปุ่ม quick-login (mock เท่านั้น) */
  demoAccounts?(): Profile[];
}

export type RoleLite = Role;
export type { NewLog };
