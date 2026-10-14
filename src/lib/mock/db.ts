import type { CommentRead, NewLog, NewTicketInput, Survey, Ticket, TicketLog, TicketService } from '@/types';
import type { Transition } from '@/lib/workflow/machine';

export interface MockDB {
  tickets: Ticket[];
  services: TicketService[];
  logs: TicketLog[];
  surveys: Survey[];
  reads: CommentRead[];
  lastLogId: number;
}

export const emptyDb = (): MockDB => ({ tickets: [], services: [], logs: [], surveys: [], reads: [], lastLogId: 0 });

export function newTicketRecord(
  input: NewTicketInput, ticket_no: string, now: Date, tokens: { approve: string; survey: string; track: string },
): Ticket {
  return {
    ticket_no, request_date: now.toISOString(), required_date: input.required_date || null,
    requester_name: input.requester_name, department: input.department, location: input.location,
    asset_id: input.asset_id ?? null, issue_detail: input.issue_detail, requester_email: input.requester_email,
    manager_email: input.manager_email, issue_img_url: input.issue_img_url?.length ? input.issue_img_url : null,
    attachment_url: input.attachment_url?.length ? input.attachment_url : null, status: 'OPEN',
    mgr_name: null, mgr_signature_url: null, mgr_status: null, mgr_comment: null, mgr_approved_at: null,
    ico_name: null, ico_comment: null, ico_assigned_at: null, ico_sig_url: null, ico_received_at: null, ico_submitted_at: null,
    itl_name: null, itl_comment: null, itl_status: null, itl_sig_url: null, itl_approved_at: null,
    itm_status: null, itm_name: null, itm_comment: null, itm_approved_at: null,
    closed_at: null, survey_score: null,
    approve_token: tokens.approve, survey_token: tokens.survey, track_token: tokens.track,
  };
}

export function blankService(ticket_no: string): TicketService {
  return {
    ticket_no, work_owner: 'ICO', staff_name: null, received_date: null, job_category: null, priority: null,
    inspection_detail: null, action_detail: null, spare_parts_detail: null, repair_cost: null, finish_date: null,
    recommendations: null, additional_notes: null, attachment_urls: null, work_hours: null, work_status: null,
    work_status_note: null, work_status_at: null, close_summary: null, close_result: null, updated_at: null,
  };
}

export function pushLogs(db: MockDB, logs: NewLog[], now: Date): TicketLog[] {
  return logs.map((l) => {
    const row: TicketLog = {
      id: ++db.lastLogId, ticket_no: l.ticket_no, step_name: l.step_name, status: l.status, action_by: l.action_by,
      comment: l.comment, mentioned_role: l.mentioned_role ?? null, created_at: now.toISOString(),
    };
    db.logs.push(row);
    return row;
  });
}

/** เขียน Transition ลง MockDB (ใช้ทั้งตอน seed และใน MockRepository.commit) */
export function applyTransition(db: MockDB, no: string, tr: Transition, now: Date, guard?: Ticket['status'][]) {
  const ticket = db.tickets.find((t) => t.ticket_no === no);
  if (!ticket) throw new Error('ไม่พบข้อมูลคำขอ');
  if (guard && !guard.includes(ticket.status)) {
    throw new Error('ใบงานนี้ถูกดำเนินการไปแล้ว หรือไม่ได้อยู่ในสถานะที่อนุญาต');
  }
  if (tr.ticketPatch) Object.assign(ticket, tr.ticketPatch);
  let svc = db.services.find((s) => s.ticket_no === no) || null;
  if (tr.servicePatch) {
    if (!svc) {
      svc = blankService(no);
      db.services.push(svc);
    }
    Object.assign(svc, tr.servicePatch);
  }
  const logs = pushLogs(db, tr.logs, now);
  return { ticket, service: svc, logs };
}
