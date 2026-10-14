/**
 * มุมมองตั๋วสำหรับลิงก์สาธารณะ (approve / survey / track) — ต้องตรงกับ public.get_public_ticket()
 * ใน supabase/migrations/001_secure_public_access.sql ทุกจุด เพราะ MockRepository ใช้ฟังก์ชันนี้แทน SQL
 *
 * หลักการ: ผู้ถือลิงก์ได้เห็นเฉพาะสิ่งที่ลิงก์นั้นต้องใช้ — ไม่ได้ token ของลิงก์อื่นที่ไม่เกี่ยว,
 * ไม่เห็นความเห็นภายในของ ICO/ITL/ITM, ไม่เห็นค่าใช้จ่าย และไม่เห็นบันทึกภายในทีม
 */
import type { Survey, Ticket, TicketLog, TicketService } from '@/types';
import type { PublicTicketView, TokenKind } from './repository';

export function toPublicTicket(t: Ticket, kind: TokenKind | 'create'): Ticket {
  return {
    ...t,
    approve_token: kind === 'approve' || kind === 'create' ? t.approve_token : null,
    survey_token: kind === 'survey' || kind === 'track' || kind === 'create' ? t.survey_token : null,
    // approve ได้ track_token ด้วย: อีเมลแจ้งผู้แจ้งหลังหัวหน้าอนุมัติแนบลิงก์ติดตามสถานะ
    track_token: kind === 'approve' || kind === 'track' || kind === 'create' ? t.track_token : null,
    ico_comment: null, itl_comment: null, itm_comment: null, ico_sig_url: null, itl_sig_url: null,
  };
}

export function toPublicView(
  kind: TokenKind, t: Ticket, svc: TicketService | null, logs: TicketLog[], surveys: Survey[],
): PublicTicketView {
  const latest = [...surveys].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    ticket: toPublicTicket(t, kind),
    service: kind === 'approve' || !svc ? null : {
      staff_name: svc.staff_name, action_detail: svc.action_detail, finish_date: svc.finish_date, work_owner: svc.work_owner,
    },
    logs: kind !== 'track' ? [] : logs
      .filter((l) => l.status !== 'INTERNAL_NOTE' && l.status !== 'COMMENT')
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
      .map((l) => ({ ...l, mentioned_role: null, comment: l.step_name === 'WORK_STATUS' ? null : l.comment })),
    survey: latest ? { score_total: latest.score_total, created_at: latest.created_at } : null,
  };
}
