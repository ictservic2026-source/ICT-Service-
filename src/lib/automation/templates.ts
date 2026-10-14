/**
 * Templates ข้อความอัตโนมัติ — กำหนดว่าแต่ละ event "ควร" ส่งอะไรถึงใคร
 * ใช้ทั้งใน Mock (แสดงใน Outbox) และเป็นสเปกให้ workflow n8n จริงในอนาคต
 * (n8n ควรได้ payload เดิมของ Make.com webhook; ส่วนนี้คือตัวอย่างข้อความที่คาดหวัง)
 */
import type { AutomationEvent, AutomationMessage, Ticket } from '@/types';

export interface LinkCtx {
  origin: string;
}

const ICT_TEAM = 'ทีม ICT (ICO)';
const ITL_TEAM = 'ITL (หัวหน้า ICO)';
const ITM_TEAM = 'IT Manager';

const approveUrl = (t: Ticket, c: LinkCtx) => `${c.origin}/approve/${t.approve_token ?? ''}`;
const surveyUrl = (t: Ticket, c: LinkCtx) => `${c.origin}/survey/${t.survey_token ?? ''}`;
const trackUrl = (t: Ticket, c: LinkCtx) => `${c.origin}/track/${t.track_token ?? ''}`;

export function buildMessages(ev: AutomationEvent, t: Ticket, c: LinkCtx): AutomationMessage[] {
  const no = t.ticket_no;
  const comment = String(ev.payload.mgr_comment || ev.payload.itl_comment || ev.payload.itm_comment || '');
  const m: AutomationMessage[] = [];

  switch (ev.event) {
    case 'OPEN':
      m.push({
        channel: 'email', kind: 'APPROVAL_EMAIL', to: t.manager_email,
        subject: `[ICT] ขออนุมัติคำขอรับบริการ ${no}`,
        body: `${t.requester_name} (${t.department}) แจ้งปัญหา: "${t.issue_detail}"\nกรุณาตรวจสอบและอนุมัติผ่านลิงก์ด้านล่าง (ไม่ต้อง Login)`,
        links: [{ label: 'เปิดหน้าอนุมัติ', href: approveUrl(t, c) }], statusLabel: 'Approval Email Sent',
      });
      m.push({
        channel: 'email', kind: 'REQUESTER_CONFIRMATION', to: t.requester_email,
        subject: `[ICT] ได้รับคำขอ ${no} เรียบร้อยแล้ว`,
        body: 'ระบบได้ส่งคำขอของท่านให้หัวหน้างานอนุมัติแล้ว ท่านสามารถติดตามสถานะได้ตลอดเวลา',
        links: [{ label: 'ติดตามสถานะงาน', href: trackUrl(t, c) }], statusLabel: 'Email Sent',
      });
      m.push({
        channel: 'notification', kind: 'NOTIFY_ICT', to: ICT_TEAM, subject: `คำขอใหม่ ${no}`,
        body: `${t.requester_name} (${t.department}) — รอหัวหน้างานอนุมัติ`, statusLabel: 'Notification Sent',
      });
      break;
    case 'MANAGER_APPROVE':
      if (ev.action === 'APPROVED') {
        m.push({ channel: 'notification', kind: 'NOTIFY_ICT', to: ICT_TEAM, subject: `หัวหน้าอนุมัติแล้ว ${no}`, body: 'งานพร้อมให้ ICO รับดำเนินการ', statusLabel: 'Notification Sent' });
        m.push({ channel: 'email', kind: 'NOTIFY_REQUESTER', to: t.requester_email, subject: `[ICT] หัวหน้างานอนุมัติคำขอ ${no} แล้ว`, body: 'ทีม ICT กำลังรับเรื่องและจะดำเนินการต่อ', links: [{ label: 'ติดตามสถานะงาน', href: trackUrl(t, c) }], statusLabel: 'Email Sent' });
      } else {
        m.push({ channel: 'email', kind: 'NOTIFY_REQUESTER', to: t.requester_email, subject: `[ICT] คำขอ ${no} ไม่ได้รับการอนุมัติ`, body: `เหตุผล: ${comment || '-'}`, statusLabel: 'Email Sent' });
      }
      break;
    case 'ICT_ACTION':
      m.push({ channel: 'notification', kind: 'NOTIFY_SUPERVISOR', to: ITL_TEAM, subject: `มีงานรอตรวจสอบ ${no}`, body: 'ICO บันทึกงานและส่งต่อให้ ITL ตรวจสอบ', statusLabel: 'Notification Sent' });
      break;
    case 'DIRECT_FORWARD_ITL':
      m.push({ channel: 'notification', kind: 'NOTIFY_SUPERVISOR', to: ITL_TEAM, subject: `งาน Direct ITL ${no}`, body: 'ICO ส่งงานให้ ITL ดำเนินการโดยตรง — กรุณากรอกรายละเอียดงาน', statusLabel: 'Notification Sent' });
      break;
    case 'ITL_APPROVE':
      m.push({ channel: 'notification', kind: 'STATUS_CHANGE', to: ITM_TEAM, subject: `รออนุมัติขั้นสุดท้าย ${no}`, body: 'ITL ตรวจสอบและอนุมัติแล้ว', statusLabel: 'Notification Sent' });
      break;
    case 'IT_MGR_APPROVE':
      m.push({ channel: 'notification', kind: 'NOTIFY_ICT', to: ICT_TEAM, subject: `IT Manager อนุมัติ ${no}`, body: 'กรุณาปิดงานและส่งแบบประเมินให้ผู้แจ้ง', statusLabel: 'Notification Sent' });
      break;
    case 'REJECTED': {
      const toItl = ev.action === 'BACK_TO_ITL';
      m.push({ channel: 'notification', kind: 'STATUS_CHANGE', to: toItl ? ITL_TEAM : ICT_TEAM, subject: `งานถูกตีกลับ ${no}`, body: `เหตุผล: ${comment || '-'}`, statusLabel: 'Notification Sent' });
      break;
    }
    case 'CANCELLED':
      m.push({ channel: 'email', kind: 'NOTIFY_REQUESTER', to: t.requester_email, subject: `[ICT] งาน ${no} ถูกยกเลิก`, body: `เหตุผล: ${comment || '-'}`, statusLabel: 'Email Sent' });
      m.push({ channel: 'notification', kind: 'NOTIFY_ICT', to: ICT_TEAM, subject: `งานถูกยกเลิก ${no}`, body: `IT Manager ยกเลิก — ${comment || '-'}`, statusLabel: 'Notification Sent' });
      break;
    case 'DONE':
      m.push({ channel: 'email', kind: 'CLOSED_NOTICE', to: t.requester_email, subject: `[ICT] งาน ${no} ดำเนินการเสร็จสิ้น`, body: 'ทีม ICT ปิดงานเรียบร้อยแล้ว ขอความร่วมมือประเมินความพึงพอใจ', links: [{ label: 'ทำแบบประเมิน', href: surveyUrl(t, c) }], statusLabel: 'Evaluation Link Sent' });
      break;
    case 'SURVEY_SUBMITTED':
      m.push({ channel: 'notification', kind: 'NOTIFY_ICT', to: ICT_TEAM, subject: `ได้รับแบบประเมิน ${no}`, body: `คะแนนรวม ${ev.payload.score_total}/100`, statusLabel: 'Notification Sent' });
      break;
    default:
      break;
  }
  return m;
}
