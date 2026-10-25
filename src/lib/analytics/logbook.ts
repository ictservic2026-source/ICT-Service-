/**
 * สมุดงาน ICT — คำนวณข้อมูลทั้งหน้าจาก DashData (pure functions, ไม่มี React)
 *
 * หลักการที่ตกลงกับผู้ใช้:
 *  - ไม่คิด SLA: นับ "อายุงาน" เป็นจำนวนวันนับจากวันที่แจ้งเท่านั้น ไม่มีเป้า/ไม่มีเกินกำหนด
 *  - ค่าใช้จ่ายรวมเป็นยอดเดียว ไม่แยก ICO / Direct ITL
 *  - วันที่ตัดตามเวลาไทย (Asia/Bangkok)
 */
import type { Survey, TicketStatus } from '@/types';
import type { DashData, DashTicket } from './dashboard';

export type StationKey = 'NEW' | 'ICO_WORK' | 'ITL_WAIT' | 'ITM_WAIT' | 'ICO_FINAL';

export interface Station { key: StationKey; label: string; who: string; statuses: TicketStatus[] }

/** 5 สถานีของงานที่ยังเปิดอยู่ (MGR_WAIT รวมกับคำขอใหม่ เพราะยังรอหัวหน้างาน) */
export const STATIONS: Station[] = [
  { key: 'NEW', label: 'คำขอใหม่', who: 'หัวหน้างาน', statuses: ['OPEN', 'MGR_WAIT'] },
  { key: 'ICO_WORK', label: 'ICO แก้ไข', who: 'ICO', statuses: ['ICO_WORK'] },
  { key: 'ITL_WAIT', label: 'ITL ตรวจ', who: 'ITL', statuses: ['ITL_WAIT'] },
  { key: 'ITM_WAIT', label: 'IT MGR อนุมัติ', who: 'IT Manager', statuses: ['ITM_WAIT'] },
  { key: 'ICO_FINAL', label: 'ปิดงาน', who: 'ICO', statuses: ['ICO_FINAL'] },
];

/** ขั้นต่อไป: ใครต้องทำอะไร */
export const NEXT_STEP: Record<TicketStatus, [string, string]> = {
  OPEN: ['รอหัวหน้างานอนุมัติ', 'อนุมัติแล้วงานจะเข้าคิว ICO'],
  MGR_WAIT: ['รอหัวหน้างานอนุมัติ', 'อนุมัติแล้วงานจะเข้าคิว ICO'],
  ICO_WORK: ['ICO กำลังแก้ไข', 'บันทึกผลและค่าใช้จ่าย แล้วส่ง ITL'],
  ITL_WAIT: ['รอ ITL ตรวจสอบ', 'ตรวจผลงานและค่าใช้จ่าย แล้วส่ง IT Manager'],
  ITM_WAIT: ['รอ IT Manager อนุมัติ', 'อนุมัติแล้วกลับไปให้ ICO ปิดงาน'],
  ICO_FINAL: ['รอ ICO ปิดงาน', 'อนุมัติครบแล้ว สรุปผลและปิดงาน'],
  DONE: ['งานเสร็จแล้ว', ''],
  REJECTED: ['หัวหน้างานไม่อนุมัติ', 'ไม่มีการดำเนินการต่อ'],
  CANCELLED: ['งานถูกยกเลิก', 'ไม่มีการดำเนินการต่อ'],
};

/** เส้นทาง 6 จุดในแผงรายละเอียด */
export const JOURNEY = ['คำขอใหม่', 'ICO แก้ไข', 'ITL ตรวจ', 'IT MGR อนุมัติ', 'ปิดงาน', 'เสร็จ'];
const JOURNEY_INDEX: Partial<Record<TicketStatus, number>> = { OPEN: 0, MGR_WAIT: 0, ICO_WORK: 1, ITL_WAIT: 2, ITM_WAIT: 3, ICO_FINAL: 4, DONE: 5 };

export const SURVEY_Q: { label: string; max: number; key: keyof Survey }[] = [
  { label: 'ตรงตามที่แจ้ง', max: 30, key: 'score_q1' },
  { label: 'ทันเวลา', max: 30, key: 'score_q2' },
  { label: 'อธิบายชัดเจน', max: 20, key: 'score_q3' },
  { label: 'สุภาพ', max: 10, key: 'score_q4' },
  { label: 'โดยรวม', max: 10, key: 'score_q5' },
];

export const MONTH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/* ───────────── dates (Asia/Bangkok) ───────────── */

/** ISO timestamp หรือ YYYY-MM-DD → 'YYYY-MM-DD' ตามเวลาไทย */
export function bkkDay(s?: string | null): string {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}
export const todayBkk = (now: Date = new Date()) => bkkDay(now.toISOString());
const dayNum = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86_400_000;
export const daysFrom = (a: string, b: string) => Math.max(0, Math.round(dayNum(b) - dayNum(a)));
/** '2026-10-24' → '24 ต.ค. 69' */
export function thShort(s?: string | null): string {
  const d = bkkDay(s);
  return d ? `${+d.slice(8, 10)} ${MONTH_SHORT[+d.slice(5, 7) - 1]} ${String(+d.slice(0, 4) + 543).slice(2)}` : '—';
}
/** '2026-10' → 'ตุลาคม 2569' */
export const monthLabel = (key: string) => `${MONTH_FULL[+key.slice(5, 7) - 1]} ${+key.slice(0, 4) + 543}`;
export const monthShortLabel = (key: string) => `${MONTH_SHORT[+key.slice(5, 7) - 1]} ${String(+key.slice(0, 4) + 543).slice(2)}`;
const prevMonth = (key: string) => { const y = +key.slice(0, 4), m = +key.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

/* ───────────── rows ───────────── */

export interface LogRow {
  t: DashTicket;
  no: string;
  seq: number;
  req: string;          // YYYY-MM-DD
  month: string;        // YYYY-MM
  closed: string;       // YYYY-MM-DD หรือ ''
  open: boolean;
  done: boolean;
  station: StationKey | null;
  age: number;          // วันนับจากวันที่แจ้ง (งานปิด = ถึงวันปิด)
  cost: number | null;
  score: number | null;
  survey: Survey | undefined;
}

const OPEN_STATUSES: TicketStatus[] = ['OPEN', 'MGR_WAIT', 'ICO_WORK', 'ITL_WAIT', 'ITM_WAIT', 'ICO_FINAL'];
const seqOf = (no: string) => { const m = /-(\d+)$/.exec(no); return m ? +m[1] : 0; };

export function buildRows(data: DashData, today: string): LogRow[] {
  return data.tickets.map((t) => {
    const req = bkkDay(t.request_date);
    const closed = bkkDay(t.closed_at);
    const open = OPEN_STATUSES.includes(t.status);
    const svc = data.svcMap.get(t.ticket_no);
    const raw = svc?.repair_cost as unknown;
    const cost = raw == null || raw === '' ? null : Number(raw);
    const survey = data.survey.get(t.ticket_no);
    return {
      t, no: t.ticket_no, seq: seqOf(t.ticket_no), req, month: req.slice(0, 7), closed, open, done: t.status === 'DONE',
      station: STATIONS.find((s) => s.statuses.includes(t.status))?.key ?? null,
      age: req ? daysFrom(req, open ? today : closed || today) : 0,
      cost: cost == null || isNaN(cost) ? null : cost,
      score: survey?.score_total ?? t.survey_score ?? null,
      survey,
    };
  });
}

/** เดือนที่มีข้อมูล (ใหม่ → เก่า) และรวมเดือนปัจจุบันเสมอ */
export function monthsOf(rows: LogRow[], today: string): string[] {
  const set = new Set(rows.map((r) => r.month).filter(Boolean));
  set.add(today.slice(0, 7));
  return [...set].sort().reverse();
}

export const departmentsOf = (rows: LogRow[]) => [...new Set(rows.map((r) => r.t.department).filter(Boolean))].sort();

export function matches(r: LogRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [r.no, r.t.issue_detail, r.t.requester_name, r.t.department, r.t.asset_id, r.t.location].join(' ').toLowerCase().includes(s);
}

/* ───────────── page model ───────────── */

export interface LogbookInput { rows: LogRow[]; month: string; dept: string; today: string }

export function summarize({ rows, month, dept, today }: LogbookInput) {
  const inDept = (r: LogRow) => !dept || r.t.department === dept;
  const scoped = rows.filter(inDept);
  const cur = scoped.filter((r) => r.month === month);
  const prev = scoped.filter((r) => r.month === prevMonth(month));
  const closedThisMonth = scoped.filter((r) => r.done && r.closed.slice(0, 7) === month);
  const openAll = scoped.filter((r) => r.open);
  const urgent = openAll.filter((r) => r.t.priority === 'URGENT');
  const costRows = cur.filter((r) => r.cost != null);
  const cost = costRows.reduce((a, r) => a + (r.cost ?? 0), 0);
  const scored = cur.filter((r) => r.score != null);
  const avg = scored.length ? scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length : null;
  const allScored = scoped.filter((r) => r.score != null).sort((a, b) => b.closed.localeCompare(a.closed));
  const latestMonthScored = allScored[0]?.closed.slice(0, 7) || allScored[0]?.month || '';
  const latest = allScored.filter((r) => (r.closed.slice(0, 7) || r.month) === latestMonthScored);
  const latestAvg = latest.length ? latest.reduce((a, r) => a + (r.score ?? 0), 0) / latest.length : null;

  const stationCounts = STATIONS.map((s) => ({ ...s, n: openAll.filter((r) => r.station === s.key).length }));
  const busiest = [...stationCounts].sort((a, b) => b.n - a.n)[0];
  const waitingClose = stationCounts.find((s) => s.key === 'ICO_FINAL')?.n ?? 0;

  const doneN = closedThisMonth.length;
  const headline = !cur.length
    ? { a: `${monthLabel(month)} ยังไม่มีคำขอ`, b: '' }
    : { a: `รับเข้า ${cur.length} งาน`, b: doneN ? `ปิดได้ ${doneN} งาน` : 'ยังไม่มีงานปิดในเดือนนี้' };
  const lede = [
    `ตอนนี้มีงานเปิดอยู่ทั้งหมด ${openAll.length} งาน`,
    busiest && busiest.n ? `ส่วนใหญ่อยู่ที่ขั้น "${busiest.label}" (${busiest.n} งาน) ซึ่งรอ ${busiest.who}` : '',
    waitingClose ? `และมี ${waitingClose} งานที่อนุมัติครบแล้วรอ ICO ปิด` : '',
  ].filter(Boolean).join(' ') + ` · ค่าใช้จ่ายของงานเดือนนี้รวม ${fmtB(cost)}`;

  const diff = cur.length - prev.length;
  const waitSurvey = cur.filter((r) => r.done && r.score == null).length;

  return {
    cur, prev, openAll, urgent, closedThisMonth, cost, costRows, scored, avg, latestAvg, latestMonthScored,
    stationCounts, headline, lede, waitSurvey,
    figs: {
      received: { v: cur.length, d: prev.length ? `${diff >= 0 ? '+' : '−'}${Math.abs(diff)} จากเดือนก่อน` : 'เดือนก่อนไม่มีงาน' },
      closed: { v: doneN },
      open: { v: openAll.length },
      urgent: { v: urgent.length },
      cost: { v: cost, n: costRows.length },
      sat: { v: avg },
    },
    today,
  };
}

/** ช่องรายวันของเดือน: งานรับเข้า / งานปิด */
export function dayStrip(rows: LogRow[], month: string, dept: string) {
  const y = +month.slice(0, 4), m = +month.slice(5, 7);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const scoped = rows.filter((r) => !dept || r.t.department === dept);
  return Array.from({ length: n }, (_, i) => {
    const key = `${month}-${String(i + 1).padStart(2, '0')}`;
    const dow = new Date(Date.UTC(y, m - 1, i + 1)).getUTCDay();
    return { key, day: i + 1, weekend: dow === 0 || dow === 6, ins: scoped.filter((r) => r.req === key), outs: scoped.filter((r) => r.done && r.closed === key) };
  });
}

/** อันดับแบบนับจำนวน (แผนก / ประเภทงาน) */
export function rank<T extends string>(rows: LogRow[], key: (r: LogRow) => T | '' | null | undefined, unknownLabel = 'ยังไม่ระบุ') {
  const m = new Map<string, number>();
  for (const r of rows) { const k = key(r) || unknownLabel; m.set(k, (m.get(k) ?? 0) + 1); }
  const out = [...m.entries()].map(([label, n]) => ({ label, n, unknown: label === unknownLabel }));
  out.sort((a, b) => Number(a.unknown) - Number(b.unknown) || b.n - a.n);
  const max = Math.max(1, ...out.map((x) => x.n));
  return out.map((x) => ({ ...x, pct: (x.n / max) * 100 }));
}

export function journeyIndex(status: TicketStatus) { return JOURNEY_INDEX[status] ?? -1; }

export function fmtB(n: number | null | undefined) {
  return n == null ? '—' : '฿' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
