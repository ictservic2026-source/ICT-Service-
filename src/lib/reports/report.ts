/**
 * Report builder (pure) — ย้ายจาก report-export.js: ตัวกรอง + 4 ชีต (สรุป Ticket / รายละเอียดงาน / ผลประเมิน / Log)
 * ต่างจากเดิม 1 จุด (บันทึกใน RECOMMENDATIONS): ความสำคัญ (priority) อ่านจาก ticket_services เพราะ tickets ไม่มีคอลัมน์นี้
 */
import type { Priority, Survey, Ticket, TicketLog, TicketService, TicketStatus } from '@/types';
import type { Snapshot } from '@/lib/services/repository';
import { STATUS_META, STATUS_ORDER } from '@/lib/constants';
import { fmtDateTime } from '@/lib/utils/format';

export type Period = 'all' | 'month' | 'year' | 'range';
export interface ReportFilter {
  period: Period; month: string; year: string; from: string; to: string;
  statuses: TicketStatus[]; department: string; priority: '' | Priority; includeLog: boolean;
}
export const ALL_STATUSES = STATUS_ORDER;
export const PENDING_STATUSES = STATUS_ORDER.filter((s) => STATUS_META[s].pending);

export function defaultReportFilter(now = new Date()): ReportFilter {
  return {
    period: 'month', month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, year: String(now.getFullYear()),
    from: '', to: '', statuses: [...ALL_STATUSES], department: '', priority: '', includeLog: false,
  };
}

export function dateBounds(f: ReportFilter): { from: Date | null; to: Date | null } {
  if (f.period === 'month' && f.month) {
    const [y, m] = f.month.split('-').map(Number);
    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59) };
  }
  if (f.period === 'year' && f.year) return { from: new Date(+f.year, 0, 1), to: new Date(+f.year, 11, 31, 23, 59, 59) };
  if (f.period === 'range') return { from: f.from ? new Date(f.from + 'T00:00:00') : null, to: f.to ? new Date(f.to + 'T23:59:59') : null };
  return { from: null, to: null };
}

export interface ReportResult {
  filter: ReportFilter; tickets: Ticket[]; services: TicketService[]; surveys: Survey[]; logs: TicketLog[];
  serviceMap: Map<string, TicketService>; surveyMap: Map<string, Survey>;
}

export function runReport(snap: Snapshot, f: ReportFilter): ReportResult {
  const { from, to } = dateBounds(f);
  const svcMap = new Map(snap.services.map((s) => [s.ticket_no, s]));
  const tickets = snap.tickets.filter((t) => {
    const d = new Date(t.request_date);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (!f.statuses.includes(t.status)) return false;
    if (f.department && t.department !== f.department) return false;
    if (f.priority && svcMap.get(t.ticket_no)?.priority !== f.priority) return false;
    return true;
  }).sort((a, b) => b.request_date.localeCompare(a.request_date) || b.ticket_no.localeCompare(a.ticket_no));
  const set = new Set(tickets.map((t) => t.ticket_no));
  const surveyMap = new Map<string, Survey>();
  const surveys = snap.surveys.filter((s) => set.has(s.ticket_no)).sort((a, b) => a.ticket_no.localeCompare(b.ticket_no) || a.created_at.localeCompare(b.created_at));
  surveys.forEach((s) => surveyMap.set(s.ticket_no, s));
  return {
    filter: f, tickets, services: snap.services.filter((s) => set.has(s.ticket_no)), surveys,
    logs: f.includeLog ? snap.logs.filter((l) => set.has(l.ticket_no)).sort((a, b) => a.id - b.id) : [],
    serviceMap: new Map([...svcMap].filter(([k]) => set.has(k))), surveyMap,
  };
}

export function summarize(r: ReportResult) {
  const byStatus: Record<string, number> = {};
  let cost = 0;
  r.tickets.forEach((t) => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    cost += Number(r.serviceMap.get(t.ticket_no)?.repair_cost) || 0;
  });
  return { total: r.tickets.length, cost, byStatus };
}

const arr = (v: string[] | null | undefined) => v ?? [];

/** กันสูตร Excel injection (=,+,-,@ นำหน้า) ในข้อความที่ผู้ใช้กรอก — Recommendation เพิ่มจากของเดิม */
export const safeCell = (v: unknown) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);
const clean = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, safeCell(v)]));

export function ticketRows(r: ReportResult) {
  return r.tickets.map((t) => {
    const s = r.serviceMap.get(t.ticket_no), sv = r.surveyMap.get(t.ticket_no);
    return clean({
      'เลขที่ Ticket': t.ticket_no, 'วันที่แจ้ง': fmtDateTime(t.request_date), 'วันที่ต้องการ': t.required_date || '',
      'ผู้แจ้ง': t.requester_name, 'อีเมลผู้แจ้ง': t.requester_email, 'แผนก': t.department, 'สถานที่': t.location,
      'รหัสทรัพย์สิน': t.asset_id || '', 'รายละเอียดปัญหา': t.issue_detail, 'สถานะ': STATUS_META[t.status]?.label ?? t.status,
      'ความสำคัญ': s?.priority ?? '', 'หัวหน้างานผู้อนุมัติ': t.mgr_name || '', 'ผลอนุมัติหัวหน้างาน': t.mgr_status || '',
      'ความเห็นหัวหน้างาน': t.mgr_comment || '', 'ผู้ปฏิบัติงาน (ICO/ITL)': s?.staff_name || '', 'หมวดงาน': s?.job_category || '',
      'ค่าใช้จ่าย (บาท)': s?.repair_cost ?? '', 'ชั่วโมงทำงาน': s?.work_hours ?? '', 'วันที่ปิดงาน': t.closed_at ? fmtDateTime(t.closed_at) : '',
      'คะแนนประเมินความพึงพอใจ (เต็ม 100)': sv?.score_total ?? '',
      'จำนวนไฟล์แนบ (รูป)': arr(t.issue_img_url).length, 'จำนวนไฟล์แนบ (เอกสาร)': arr(t.attachment_url).length,
      'ลิงก์ไฟล์รูปภาพ': arr(t.issue_img_url).join(' | '), 'ลิงก์ไฟล์เอกสารแนบ': arr(t.attachment_url).join(' | '),
      'ลิงก์ไฟล์แนบงานซ่อม': arr(s?.attachment_urls).join(' | '),
    });
  });
}
/** วันที่ DD-MM-YY ปี ค.ศ. 2 หลัก ตามเวลาไทย เช่น 22-10-26 */
export function dmyTH(v?: string | null): string {
  if (!v) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00+07:00` : v);
  if (isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${get('day')}-${get('month')}-${get('year').slice(-2)}`;
}

/** Excel หน้าเดียว — 11 คอลัมน์ เรียงตามเลขที่งาน (คอลัมน์ 9 เว้นว่างไว้) */
export const CASE_TABLE_COLS: { h: string; w: number }[] = [
  { h: 'เลขที่งาน', w: 14 }, { h: 'วันที่แจ้ง', w: 11 }, { h: 'ชื่อผู้แจ้ง', w: 20 }, { h: 'แผนก', w: 14 },
  { h: 'วันที่ต้องการ', w: 12 }, { h: 'รายละเอียดงาน', w: 45 }, { h: 'การแก้ปัญหา', w: 45 }, { h: 'ค่าใช้จ่าย', w: 11 },
  { h: ' ', w: 12 }, { h: 'วันที่แล้วเสร็จ', w: 13 }, { h: 'คะแนนประเมิน', w: 12 },
];
export function caseTableRows(r: ReportResult): unknown[][] {
  return [...r.tickets].sort((a, b) => a.ticket_no.localeCompare(b.ticket_no, 'en', { numeric: true })).map((t) => {
    const s = r.serviceMap.get(t.ticket_no), sv = r.surveyMap.get(t.ticket_no);
    return [
      t.ticket_no, dmyTH(t.request_date), t.requester_name, t.department, dmyTH(t.required_date),
      t.issue_detail, s?.action_detail || '', s?.repair_cost ?? '', '',
      dmyTH(s?.finish_date || t.closed_at), sv?.score_total ?? '',
    ].map(safeCell);
  });
}

export function serviceRows(r: ReportResult) {
  return r.services.map((s) => clean({
    'เลขที่ Ticket': s.ticket_no, 'รหัสทรัพย์สิน (ยืนยันโดย IT)': s.asset_id || '', 'ผู้ปฏิบัติงาน': s.staff_name, 'วันที่รับงาน': s.received_date || '',
    'รายละเอียดการตรวจสอบ': s.inspection_detail || '', 'รายละเอียดการดำเนินการ': s.action_detail || '', 'อะไหล่ที่ใช้': s.spare_parts_detail || '',
    'ค่าใช้จ่าย': s.repair_cost ?? '', 'ชั่วโมงทำงาน': s.work_hours ?? '', 'วันที่เสร็จสิ้น': s.finish_date || '',
    'หมายเหตุเพิ่มเติม': s.additional_notes || '', 'ข้อเสนอแนะ': s.recommendations || '', 'สรุปผลปิดงาน': s.close_summary || '',
    'ผลปิดงาน': s.close_result || '', 'อัปเดตล่าสุด': s.updated_at ? fmtDateTime(s.updated_at) : '',
  }));
}
export function surveyRows(r: ReportResult) {
  return r.surveys.map((s) => clean({
    'เลขที่ Ticket': s.ticket_no, 'คะแนนข้อ 1 (เต็ม 30)': s.score_q1, 'คะแนนข้อ 2 (เต็ม 30)': s.score_q2, 'คะแนนข้อ 3 (เต็ม 20)': s.score_q3,
    'คะแนนข้อ 4 (เต็ม 10)': s.score_q4, 'คะแนนข้อ 5 (เต็ม 10)': s.score_q5, 'คะแนนรวม (เต็ม 100)': s.score_total,
    'แก้ไขปัญหาสมบูรณ์': s.chk_resolved ? 'ใช่' : 'ไม่ใช่', 'ได้รับคำอธิบาย': s.chk_explained ? 'ใช่' : 'ไม่ใช่',
    'ความคิดเห็น': s.comment || '', 'ผู้ประเมิน': s.submitted_by || '', 'วันที่ประเมิน': fmtDateTime(s.created_at),
  }));
}
export function logRows(r: ReportResult) {
  return r.logs.map((l) => clean({
    'เลขที่ Ticket': l.ticket_no, 'ขั้นตอน (step_name)': l.step_name || '', 'สถานะที่บันทึก': l.status || '',
    'ดำเนินการโดย': l.action_by || '', 'ความเห็น/หมายเหตุ': l.comment || '', 'วันเวลา': fmtDateTime(l.created_at),
  }));
}

export function periodLabel(f: ReportFilter) {
  return f.period === 'month' ? f.month || 'all' : f.period === 'year' ? f.year : f.period === 'range' ? `${f.from}_to_${f.to}` : 'all';
}
export function reportFileName(f: ReportFilter, now = new Date()) {
  return `ICT-Report_${periodLabel(f)}_${now.toISOString().slice(0, 10)}.xlsx`;
}
