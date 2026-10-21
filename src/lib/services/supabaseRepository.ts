/**
 * SupabaseRepository — ใช้ตารางเดิมของระบบ HTML (tickets, ticket_services, tickets_log, ticket_survey,
 * work_status_master, comment_reads) + Storage bucket `ticket-files`
 *
 * ต้องรัน supabase/migrations/001_secure_public_access.sql ก่อนใช้งาน:
 *  - เจ้าหน้าที่ (ล็อกอิน) อ่าน/เขียนตารางตรงตาม RLS + trigger ตรวจสิทธิ์เปลี่ยนสถานะ
 *  - ผู้ใช้ไม่ล็อกอิน (ผู้แจ้ง/หัวหน้างาน/ผู้ประเมิน) ใช้ได้เฉพาะ RPC ที่ตรวจ token:
 *    create_ticket, get_public_ticket, manager_decide, submit_survey
 */
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { CommentRead, NewTicketInput, Survey, Ticket, TicketLog, TicketService, WorkStatusMaster } from '@/types';
import { WORK_STATUS_FALLBACK } from '@/lib/constants';
import { cleanRequest, validateRequest } from '@/lib/validation';
import type { Transition } from '@/lib/workflow/machine';
import { getSupabase, STORAGE_BUCKET } from '@/lib/supabase/client';
import { withName } from './mockRepository';
import type { NewSurvey, PublicTicketView, Repository, Snapshot, TokenKind } from './repository';

const PAGE = 1000;

function fail(err: { message: string } | null, ctx: string): never {
  throw new Error(`${ctx}: ${err?.message ?? 'unknown error'}`);
}

/** RPC สาธารณะ: 22023 = ข้อความตรวจสอบภาษาไทยจาก SQL แสดงให้ผู้ใช้ได้ตรง ๆ; อย่างอื่นไม่เปิดเผยรายละเอียดภายใน */
function rpcFail(err: PostgrestError, ctx: string): never {
  if (err.code === '22023') throw new Error(err.message);
  if (err.code === 'PGRST202' || err.code === '42883') {
    throw new Error('ระบบยังไม่พร้อมใช้งานลิงก์นี้ (ยังไม่ได้รัน supabase/migrations/001_secure_public_access.sql)');
  }
  console.error(`[supabase] ${ctx}`, err);
  throw new Error(`${ctx}ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง`);
}

export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;
  constructor(sb?: SupabaseClient) { this.sb = sb ?? getSupabase(); }

  /** ดึงทั้งตารางแบบแบ่งหน้า (PostgREST จำกัด 1000 แถว/คำขอ) */
  private async all<T>(table: string, order: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb.from(table).select('*').order(order, { ascending: true }).range(from, from + PAGE - 1);
      if (error) fail(error, `โหลด ${table}`);
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  async snapshot(): Promise<Snapshot> {
    const [tickets, services, logs, surveys, ws] = await Promise.all([
      this.all<Ticket>('tickets', 'request_date'),
      this.all<TicketService>('ticket_services', 'ticket_no'),
      this.all<TicketLog>('tickets_log', 'id'),
      this.all<Survey>('ticket_survey', 'created_at'),
      this.sb.from('work_status_master').select('*').eq('is_active', true).order('sort_order'),
    ]);
    const workStatus = !ws.error && ws.data?.length ? (ws.data as WorkStatusMaster[]) : WORK_STATUS_FALLBACK;
    // tickets ใหม่ก่อน (เหมือนการแสดงผลเดิม)
    tickets.sort((a, b) => b.request_date.localeCompare(a.request_date));
    return { tickets, services, logs, surveys, reads: [], workStatus };
  }

  async getTicket(no: string) {
    const { data, error } = await this.sb.from('tickets').select('*').eq('ticket_no', no).maybeSingle();
    if (error) fail(error, 'โหลดคำขอ');
    return (data as Ticket) ?? null;
  }

  async getPublicTicket(kind: TokenKind, token: string): Promise<PublicTicketView | null> {
    const { data, error } = await this.sb.rpc('get_public_ticket', { kind, tok: token });
    if (error) rpcFail(error, 'เปิดลิงก์');
    return (data as PublicTicketView | null) ?? null;
  }

  async findTrackToken(ticketNo: string, email: string): Promise<string | null> {
    // migration 002: เลขที่งาน + อีเมลผู้แจ้ง → track token (ค้นผิด 5 ครั้งล็อก 15 นาที)
    const { data, error } = await this.sb.rpc('find_track_token', { p_ticket_no: ticketNo, p_email: email });
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') throw new Error('ระบบค้นหายังไม่พร้อม (ยังไม่ได้รัน supabase/migrations/002_track_lookup.sql)');
      rpcFail(error, 'ค้นหางาน');
    }
    return typeof data === 'string' && data ? data : null;
  }

  async createTicket(input: NewTicketInput): Promise<Ticket> {
    // ตรวจซ้ำฝั่ง DB อีกชั้นใน create_ticket() — เลขที่งานออกภายใต้ advisory lock จึงไม่ชนกัน
    const errs = validateRequest(input);
    if (Object.keys(errs).length) throw new Error(Object.values(errs)[0]);
    const c = cleanRequest(input);
    const { data, error } = await this.sb.rpc('create_ticket', { p: {
      requester_name: c.requester_name, department: c.department, location: c.location, required_date: c.required_date,
      asset_id: c.asset_id, issue_detail: c.issue_detail, requester_email: c.requester_email, manager_email: c.manager_email,
      issue_img_url: c.issue_img_url ?? [], attachment_url: c.attachment_url ?? [],
    } });
    if (error) rpcFail(error, 'บันทึกคำขอ');
    return data as Ticket;
  }

  async managerDecide(token: string, tr: Transition): Promise<Ticket> {
    const p = tr.ticketPatch ?? {};
    const { data, error } = await this.sb.rpc('manager_decide', {
      tok: token, decision: p.mgr_status, note: p.mgr_comment ?? null,
      signer_name: p.mgr_name ?? null, signature_url: p.mgr_signature_url ?? null,
    });
    if (error) rpcFail(error, 'บันทึกผลการอนุมัติ');
    return data as Ticket;
  }

  async submitSurvey(token: string, s: NewSurvey): Promise<Survey> {
    // score_total เป็น generated column และ tickets.survey_score ถูกตั้งใน submit_survey() เอง
    const { data, error } = await this.sb.rpc('submit_survey', {
      tok: token, scores: [s.score_q1, s.score_q2, s.score_q3, s.score_q4, s.score_q5],
      chk_resolved: s.chk_resolved, chk_explained: s.chk_explained, note: s.comment,
      submitted_by: s.submitted_by, signature_data: s.signature_data,
    });
    if (error) rpcFail(error, 'บันทึกแบบประเมิน');
    return data as Survey;
  }

  async getService(no: string) {
    const { data, error } = await this.sb.from('ticket_services').select('*').eq('ticket_no', no).maybeSingle();
    if (error) fail(error, 'โหลดงานบริการ');
    return (data as TicketService) ?? null;
  }

  async listLogs(no: string) {
    const { data, error } = await this.sb.from('tickets_log').select('*').eq('ticket_no', no).order('created_at', { ascending: true }).order('id', { ascending: true });
    if (error) fail(error, 'โหลดประวัติ');
    return (data ?? []) as TicketLog[];
  }

  async getSurvey(no: string) {
    const { data, error } = await this.sb.from('ticket_survey').select('*').eq('ticket_no', no).order('created_at', { ascending: false }).limit(1);
    if (error) fail(error, 'โหลดแบบประเมิน');
    return ((data ?? [])[0] as Survey) ?? null;
  }

  async getReads(logIds: number[]) {
    if (!logIds.length) return [];
    const { data, error } = await this.sb.from('comment_reads').select('*').in('log_id', logIds);
    if (error) return []; // ตารางอาจยังไม่มี — ไม่ให้หน้าล้ม (เหมือนต้นฉบับ)
    return (data ?? []) as CommentRead[];
  }

  async getMyReadLogIds(userId: string) {
    // แบ่งหน้า: PostgREST คืนได้สูงสุด 1000 แถว/คำขอ (ค่าเริ่มต้น max_rows) — ถ้าตัดทิ้ง ข้อความเก่าที่อ่านแล้วจะกลับมาเป็น "ยังไม่อ่าน"
    const ids: number[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.sb.from('comment_reads').select('log_id').eq('user_id', userId)
        .order('log_id', { ascending: true }).range(from, from + PAGE - 1);
      if (error) {
        if (error.code === '42P01') return []; // ไม่มีตาราง comment_reads — ปิดฟีเจอร์นี้เงียบ ๆ เหมือนต้นฉบับ
        fail(error, 'โหลดสถานะการอ่าน');
      }
      ids.push(...(data ?? []).map((r: { log_id: number }) => r.log_id));
      if (!data || data.length < PAGE) break;
    }
    return ids;
  }

  async markRead(reads: Omit<CommentRead, 'read_at'>[]) {
    if (!reads.length) return;
    // เดิมไม่ตรวจ error → ถ้าบันทึกไม่ได้ (สิทธิ์/ไม่มี unique key) ตัวเลขกระดิ่งจะค้างโดยไม่มีใครรู้
    const { error } = await this.sb.from('comment_reads').upsert(reads, { onConflict: 'log_id,user_id', ignoreDuplicates: true });
    if (error) fail(error, 'บันทึกสถานะอ่านแล้ว');
  }

  async commit(no: string, tr: Transition, guard?: Ticket['status'][]) {
    let ticket: Ticket | null = null;
    if (tr.ticketPatch && Object.keys(tr.ticketPatch).length) {
      let q = this.sb.from('tickets').update(tr.ticketPatch).eq('ticket_no', no);
      if (guard?.length) q = q.in('status', guard); // กันกดซ้ำ — เหมือน status=in.(...) ของ approve.js เดิม
      const { data, error } = await q.select('*');
      if (error) fail(error, 'อัปเดตคำขอ');
      if (!data?.length) throw new Error('ใบงานนี้ถูกดำเนินการไปแล้ว หรือไม่ได้อยู่ในสถานะที่อนุญาต');
      ticket = data[0] as Ticket;
    } else {
      ticket = await this.getTicket(no);
      if (guard && ticket && !guard.includes(ticket.status)) throw new Error('ใบงานนี้ถูกดำเนินการไปแล้ว หรือไม่ได้อยู่ในสถานะที่อนุญาต');
    }
    if (!ticket) throw new Error('ไม่พบข้อมูลคำขอ');

    let service: TicketService | null = null;
    if (tr.servicePatch) {
      const { data, error } = await this.sb.from('ticket_services').upsert({ ticket_no: no, ...tr.servicePatch }, { onConflict: 'ticket_no' }).select('*').single();
      if (error) fail(error, 'บันทึกงานบริการ');
      service = data as TicketService;
    } else {
      service = await this.getService(no);
    }

    let logs: TicketLog[] = [];
    if (tr.logs.length) {
      const { data, error } = await this.sb.from('tickets_log').insert(tr.logs).select('*');
      if (error) fail(error, 'บันทึกประวัติ');
      logs = (data ?? []) as TicketLog[];
    }
    return { ticket, service, logs };
  }

  async uploadFile(file: File, folder: string) {
    const safe = file.name.replace(/[^\w.\-]+/g, '_');
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { error } = await this.sb.storage.from(STORAGE_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) fail(error, `อัปโหลดไม่สำเร็จ ${file.name}`);
    const { data } = this.sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return withName(data.publicUrl, file.name);
  }
}
