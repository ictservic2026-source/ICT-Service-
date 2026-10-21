/* ════════════════════════════════════════════════════════════════
   Domain types — ตรงตามโครงสร้างตารางเดิมใน Supabase
   (tickets, ticket_services, tickets_log, ticket_survey, work_status_master,
    comment_reads, profiles) — ดู docs/INVENTORY.md
   ════════════════════════════════════════════════════════════════ */

export type Role = 'ICO' | 'ITL' | 'ITM';

/** tickets.status — ค่าที่ระบบเดิมเขียนลง DB จริง (+ MGR_WAIT ที่โค้ดเดิมเช็คไว้แบบ defensive) */
export type TicketStatus =
  | 'OPEN'
  | 'MGR_WAIT'
  | 'ICO_WORK'
  | 'ITL_WAIT'
  | 'ITM_WAIT'
  | 'ICO_FINAL'
  | 'DONE'
  | 'REJECTED'
  | 'CANCELLED';

export type Priority = 'NORMAL' | 'URGENT';
export type WorkOwner = 'ICO' | 'ITL';
export type JobCategory = 'Hardware' | 'Software' | 'Network' | 'Other';

export type LogStep =
  | 'MANAGER_APPROVE'
  | 'ICO_CHECK'
  | 'ICT_ACTION'
  | 'ITL_WORK'
  | 'ITL_APPROVE'
  | 'IT_MGR_APPROVE'
  | 'WORK_STATUS';

export type LogStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'DIRECT_FORWARD_ITL'
  | 'DONE'
  | 'COMMENT'
  | 'INTERNAL_NOTE'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'BACK_TO_ITL'
  | 'BACK_TO_ICO'
  | 'WORK_STATUS';

export interface Ticket {
  ticket_no: string; // ICT-YYMM-N
  request_date: string; // ISO timestamp
  required_date: string | null; // yyyy-mm-dd
  requester_name: string;
  department: string;
  location: string;
  asset_id: string | null;
  issue_detail: string;
  requester_email: string;
  manager_email: string;
  issue_img_url: string[] | null;
  attachment_url: string[] | null;
  status: TicketStatus;

  // หัวหน้างาน
  mgr_name: string | null;
  mgr_signature_url: string | null;
  mgr_status: 'APPROVED' | 'REJECTED' | null;
  mgr_comment: string | null;
  mgr_approved_at: string | null;

  // ICO
  ico_name: string | null;
  ico_comment: string | null;
  ico_assigned_at: string | null;
  ico_sig_url: string | null;
  ico_received_at: string | null;
  ico_submitted_at: string | null;

  // ITL
  itl_name: string | null;
  itl_comment: string | null;
  itl_status: 'ITL_APPROVE' | 'BACK_TO_ICO' | null;
  itl_sig_url: string | null;
  itl_approved_at: string | null;

  // IT Manager (ชุดที่ใช้งานจริง: itm_*)
  itm_status: 'ITM_APPROVE' | 'CANCELLED' | 'BACK_TO_ITL' | 'BACK_TO_ICO' | null;
  itm_name: string | null;
  itm_comment: string | null;
  itm_approved_at: string | null;

  closed_at: string | null;
  survey_score: number | null;

  /** Secure random tokens สำหรับลิงก์สาธารณะ (RECOMMENDATION — ดู docs/RECOMMENDATIONS.md ข้อ R1) */
  approve_token?: string | null;
  survey_token?: string | null;
  track_token?: string | null;
}

/** ticket_services — 1 แถวต่อ 1 ตั๋ว; work_owner แยกงาน ICO / Direct ITL */
export interface TicketService {
  ticket_no: string;
  work_owner: WorkOwner;
  staff_name: string | null;
  /** รหัสทรัพย์สินที่เจ้าหน้าที่ยืนยัน (migration 003) — tickets.asset_id คือค่าที่ผู้แจ้งกรอก */
  asset_id?: string | null;
  received_date: string | null;
  job_category: JobCategory | null;
  priority: Priority | null;
  inspection_detail: string | null;
  action_detail: string | null;
  spare_parts_detail: string | null;
  repair_cost: number | null;
  finish_date: string | null;
  recommendations: string | null;
  additional_notes: string | null;
  attachment_urls: string[] | null;
  work_hours: number | null;
  work_status: string | null;
  work_status_note: string | null;
  work_status_at: string | null;
  close_summary: string | null;
  close_result: CloseResult | null;
  updated_at: string | null;
}

export type CloseResult = 'RESOLVED' | 'PARTIAL' | 'REPLACED' | 'OUTSOURCE';

export interface TicketLog {
  id: number;
  ticket_no: string;
  step_name: LogStep | null;
  status: LogStatus;
  action_by: string | null;
  comment: string | null;
  mentioned_role: Role | null;
  created_at: string;
}

export type NewLog = Omit<TicketLog, 'id' | 'created_at' | 'mentioned_role'> & {
  mentioned_role?: Role | null;
};

export interface CommentRead {
  log_id: number;
  user_id: string;
  reader_name: string;
  reader_role: Role;
  read_at: string;
}

export interface Survey {
  id: string;
  ticket_no: string;
  score_q1: number;
  score_q2: number;
  score_q3: number;
  score_q4: number;
  score_q5: number;
  /** Generated column ใน DB เดิม = q1+..+q5 */
  score_total: number;
  chk_resolved: boolean;
  chk_explained: boolean;
  comment: string | null;
  submitted_by: string;
  signature_data: string | null;
  created_at: string;
}

export interface WorkStatusMaster {
  code: string;
  name_th: string;
  category: 'PROGRESS' | 'PROCUREMENT' | 'WAITING' | 'CLOSED';
  category_th: string;
  color: string;
  icon: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface Profile {
  id: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  email: string;
}

export interface NewTicketInput {
  requester_name: string;
  department: string;
  location: string;
  required_date: string;
  asset_id?: string | null;
  issue_detail: string;
  requester_email: string;
  manager_email: string;
  issue_img_url?: string[] | null;
  attachment_url?: string[] | null;
}

/* ───────── Automation ───────── */
export type AutomationEventName =
  | 'OPEN'
  | 'MANAGER_APPROVE'
  | 'ICO_DRAFT'
  | 'ICT_ACTION'
  | 'DIRECT_FORWARD_ITL'
  | 'ITL_APPROVE'
  | 'IT_MGR_APPROVE'
  | 'REJECTED'
  | 'CANCELLED'
  | 'DONE'
  | 'SURVEY_SUBMITTED';

/** payload เดิมที่ระบบส่งให้ Make.com/n8n webhook (คง field ตามต้นฉบับ) */
export interface AutomationEvent {
  event: AutomationEventName;
  action: string;
  new_status?: TicketStatus;
  ticket_no: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export type AutomationChannel = 'email' | 'notification';

export interface AutomationMessage {
  channel: AutomationChannel;
  kind:
    | 'APPROVAL_EMAIL'
    | 'REQUESTER_CONFIRMATION'
    | 'NOTIFY_SUPERVISOR'
    | 'NOTIFY_ICT'
    | 'NOTIFY_REQUESTER'
    | 'STATUS_CHANGE'
    | 'CLOSED_NOTICE'
    | 'EVALUATION_LINK';
  to: string;
  subject: string;
  body: string;
  /** ลิงก์ที่แนบในอีเมล (เช่น approve / survey / track) — ใช้กดทดสอบใน Outbox */
  links?: { label: string; href: string }[];
  /** ข้อความสถานะที่แสดงบน UI ตามสเปก เช่น "Email Sent" */
  statusLabel: string;
}

export interface AutomationReceipt {
  id: string;
  event: AutomationEventName;
  ticket_no: string;
  at: string;
  mode: 'mock' | 'n8n';
  messages: AutomationMessage[];
  workflowStatus: 'Workflow Completed' | 'Workflow Failed';
  error?: string;
}
