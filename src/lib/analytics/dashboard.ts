/**
 * Dashboard analytics — pure functions ย้ายจาก dashboard.js เดิม (v2) 1:1
 * ใช้ร่วมกันทั้ง Mock และ Supabase เพราะรับ Snapshot เหมือนกัน
 */
import type { Survey, Ticket, TicketLog, TicketService } from '@/types';
import { SURVEY_KPI_THRESHOLD } from '@/lib/constants';
import { MONTH_SHORT, monthKey } from '@/lib/utils/format';

export const SURVEY_MAX_Q = [30, 30, 20, 10, 10] as const;
export const V2_SV_LABEL = ['แก้ไขตรงรายการ', 'ตรงตามเวลา', 'การอธิบาย', 'ความสุภาพ', 'พึงพอใจรวม'] as const;

export type GroupKey = 'open' | 'ico' | 'bounce' | 'itl' | 'itm' | 'final' | 'done';
export const V2_GROUPS: { key: GroupKey; label: string; color: string; dark: string }[] = [
  { key: 'open', label: 'คำขอใหม่', color: '#3B82F6', dark: '#60A5FA' },
  { key: 'ico', label: 'ICO กำลังดำเนินการ', color: '#7C3AED', dark: '#A78BFA' },
  { key: 'bounce', label: 'ถูกตีกลับ', color: '#DC2626', dark: '#F87171' },
  { key: 'itl', label: 'รอ ITL', color: '#EA580C', dark: '#FB923C' },
  { key: 'itm', label: 'รอ IT MGR', color: '#0891B2', dark: '#22D3EE' },
  { key: 'final', label: 'รอปิดงาน', color: '#0F766E', dark: '#2DD4BF' },
  { key: 'done', label: 'เสร็จสิ้น', color: '#16A34A', dark: '#4ADE80' },
];

/** ticket + ฟิลด์จาก ticket_services (mergeServiceFieldsIntoTickets เดิม) */
export interface DashTicket extends Ticket {
  job_category: TicketService['job_category'];
  priority: TicketService['priority'];
  work_status: string | null;
  work_owner: 'ICO' | 'ITL' | null;
  staff_name: string | null;
}

export interface DashData {
  tickets: DashTicket[];
  services: TicketService[];
  ticketMap: Map<string, DashTicket>;
  /** log ล่าสุด (ไม่นับ COMMENT/INTERNAL_NOTE) ต่อ ticket */
  bounce: Map<string, TicketLog>;
  /** survey ล่าสุดต่อ ticket */
  survey: Map<string, Survey>;
  svcMap: Map<string, TicketService>;
  logsByNo: Map<string, TicketLog[]>;
}

export function buildDashData(tickets: Ticket[], services: TicketService[], logs: TicketLog[], surveys: Survey[]): DashData {
  const svcMap = new Map(services.map((s) => [s.ticket_no, s]));
  const merged: DashTicket[] = tickets.map((t) => {
    const s = svcMap.get(t.ticket_no);
    return { ...t, job_category: s?.job_category ?? null, priority: s?.priority ?? null, work_status: s?.work_status ?? null, work_owner: s?.work_owner ?? null, staff_name: s?.staff_name ?? null };
  });
  const bounce = new Map<string, TicketLog>();
  for (const l of [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)) {
    if (l.status === 'COMMENT' || l.status === 'INTERNAL_NOTE') continue;
    if (!bounce.has(l.ticket_no)) bounce.set(l.ticket_no, l);
  }
  const survey = new Map<string, Survey>();
  for (const s of [...surveys].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    if (!survey.has(s.ticket_no)) survey.set(s.ticket_no, s);
  }
  const logsByNo = new Map<string, TicketLog[]>();
  for (const l of [...logs].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)) {
    const arr = logsByNo.get(l.ticket_no);
    if (arr) arr.push(l); else logsByNo.set(l.ticket_no, [l]);
  }
  return { tickets: merged, services, ticketMap: new Map(merged.map((t) => [t.ticket_no, t])), bounce, survey, svcMap, logsByNo };
}

export const isBouncedTicket = (d: DashData, t: Ticket) => {
  const l = d.bounce.get(t.ticket_no);
  return !!(l && t.status === 'ICO_WORK' && l.status === 'BACK_TO_ICO');
};

export function groupOf(d: DashData, t: Ticket): GroupKey | null {
  if (isBouncedTicket(d, t)) return 'bounce';
  switch (t.status) {
    case 'OPEN': case 'MGR_WAIT': return 'open';
    case 'ICO_WORK': return 'ico';
    case 'ITL_WAIT': return 'itl';
    case 'ITM_WAIT': return 'itm';
    case 'ICO_FINAL': return 'final';
    case 'DONE': return 'done';
  }
  return null; // CANCELLED / REJECTED ไม่นับในขั้นตอนงาน
}

/* ───────── ช่วงเวลา ───────── */
export type RangeMode = 'month' | 'months' | 'range' | 'all' | 'last7' | 'quarter' | 'lastquarter' | 'half' | 'last12' | 'year';
export interface DashFilter {
  mode: RangeMode;
  month: string;   // YYYY-MM
  month2: string;  // YYYY-MM (โหมด months)
  from: string;    // YYYY-MM-DD
  to: string;
  dept: string;
  cat: string;
  who: '' | 'ICO' | 'ITL';
  priority: '' | 'NORMAL' | 'URGENT';
  /** กรองรายการงาน: '' = ทั้งหมด · pending = ที่ยังไม่ปิด · void = ไม่อนุมัติ/ยกเลิก · หรือกลุ่มขั้นตอน */
  status: StatusFilter;
}
export type StatusFilter = '' | 'pending' | 'void' | GroupKey;
export const STATUS_FILTER_LABEL: Record<Exclude<StatusFilter, GroupKey>, string> = { '': 'ทุกสถานะ', pending: 'อยู่ระหว่างดำเนินการ (ทั้งหมด)', void: 'ไม่อนุมัติ / ยกเลิก' };
export interface Range { from: Date | null; to: Date | null; label: string; mode: RangeMode }

export const RANGE_MODE_LABEL: Record<RangeMode, string> = {
  month: 'เลือกเดือน', months: 'หลายเดือน', range: 'กำหนดช่วงวันที่', all: 'ทุกช่วงเวลา', last7: '7 วันล่าสุด',
  quarter: 'ไตรมาสนี้', lastquarter: 'ไตรมาสก่อน', half: '6 เดือนล่าสุด', last12: '12 เดือนล่าสุด', year: 'ปีนี้',
};

const thMonthYear = (d: Date) => d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
const thShort = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

export function defaultFilter(now = new Date()): DashFilter {
  const k = monthKey(now);
  return { mode: 'month', month: k, month2: k, from: '', to: '', dept: '', cat: '', who: '', priority: '', status: '' };
}

export function getFilterRange(f: DashFilter, now = new Date()): Range {
  const { mode } = f;
  if (mode === 'range') {
    const from = f.from ? new Date(f.from + 'T00:00:00') : null;
    const to = f.to ? new Date(f.to + 'T23:59:59') : null;
    let label = 'ทุกช่วงเวลา';
    if (f.from && f.to) label = `${thShort(f.from)} - ${thShort(f.to)}`;
    else if (f.from) label = `ตั้งแต่ ${thShort(f.from)}`;
    else if (f.to) label = `ถึง ${thShort(f.to)}`;
    return { from, to, label, mode };
  }
  if (mode === 'month') {
    if (!f.month) return { from: null, to: null, label: 'ทุกช่วงเวลา', mode };
    const [y, mo] = f.month.split('-').map(Number);
    const from = new Date(y, mo - 1, 1);
    return { from, to: new Date(y, mo, 0, 23, 59, 59), label: thMonthYear(from), mode };
  }
  if (mode === 'months') {
    let a = f.month, b = f.month2;
    if (!a || !b) return { from: null, to: null, label: 'ทุกช่วงเวลา', mode };
    if (a > b) [a, b] = [b, a];
    const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number);
    const from = new Date(y1, m1 - 1, 1), to = new Date(y2, m2, 0, 23, 59, 59);
    return { from, to, label: a === b ? thMonthYear(from) : `${thMonthYear(from)} – ${thMonthYear(to)}`, mode };
  }
  if (mode === 'all') return { from: null, to: null, label: 'ทุกช่วงเวลา', mode };
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const S = (a: number, b: number, c: number) => new Date(a, b, c);
  const E = (a: number, b: number, c: number) => new Date(a, b, c, 23, 59, 59);
  const q = Math.floor(m / 3) * 3;
  const P: Record<string, [Date, Date, string]> = {
    last7: [S(y, m, d - 6), E(y, m, d), '7 วันล่าสุด'],
    quarter: [S(y, q, 1), E(y, q + 3, 0), `ไตรมาส ${q / 3 + 1}/${y + 543}`],
    lastquarter: [S(y, q - 3, 1), E(y, q, 0), `ไตรมาสก่อน (${MONTH_SHORT[(((q - 3) % 12) + 12) % 12]}–${MONTH_SHORT[(((q - 1) % 12) + 12) % 12]})`],
    half: [S(y, m - 5, 1), E(y, m + 1, 0), '6 เดือนล่าสุด'],
    last12: [S(y, m - 11, 1), E(y, m + 1, 0), '12 เดือนล่าสุด'],
    year: [S(y, 0, 1), E(y, 12, 0), `ปี ${y + 543}`],
  };
  const p = P[mode];
  return { from: p[0], to: p[1], label: p[2], mode };
}

export function inRange(dateStr: string | null | undefined, r: Range): boolean {
  if (!dateStr) return false;
  if (!r.from && !r.to) return true;
  const d = new Date(dateStr);
  if (r.from && d < r.from) return false;
  if (r.to && d > r.to) return false;
  return true;
}
export function isMonthInRange(yr: number, m: number, r: Range): boolean {
  if (!r.from && !r.to) return false;
  const start = new Date(yr, m, 1), end = new Date(yr, m + 1, 0, 23, 59, 59);
  if (r.to && start > r.to) return false;
  if (r.from && end < r.from) return false;
  return true;
}

/** catKey: รวม Other/อื่นๆ ให้เป็นคีย์เดียว (เหมือน dashboard.js) */
export function catKey(v: string | null | undefined): string {
  const k = (v == null ? '' : String(v)).trim().toLowerCase().replace(/\s+/g, '');
  if (!k) return '';
  if (['other', 'others', 'อื่นๆ', 'อื่น', 'อื่นๆๆ'].includes(k)) return 'other';
  return k;
}
export const CAT_KNOWN = [
  { key: 'hardware', label: 'Hardware', value: 'Hardware' }, { key: 'software', label: 'Software', value: 'Software' },
  { key: 'network', label: 'Network', value: 'Network' }, { key: 'other', label: 'อื่นๆ', value: 'Other' },
] as const;

/* ───────── Context + widgets ───────── */
export interface Ctx {
  d: DashData; f: DashFilter; range: Range; hasRange: boolean;
  pass: (t: DashTicket, skip?: 'date' | 'dept' | 'cat' | 'who' | 'priority') => boolean;
  data: DashTicket[];
}
export function makeCtx(d: DashData, f: DashFilter, now = new Date()): Ctx {
  const range = getFilterRange(f, now);
  const hasRange = !!(range.from || range.to);
  const pass: Ctx['pass'] = (t, skip) => {
    if (skip !== 'date' && hasRange && !inRange(t.request_date, range)) return false;
    if (skip !== 'dept' && f.dept && t.department !== f.dept) return false;
    if (skip !== 'cat' && f.cat && catKey(t.job_category) !== catKey(f.cat)) return false;
    if (skip !== 'who' && f.who && t.work_owner !== f.who) return false;
    if (skip !== 'priority' && f.priority && t.priority !== f.priority) return false;
    return true;
  };
  return { d, f, range, hasRange, pass, data: d.tickets.filter((t) => pass(t)) };
}

export function groupCounts(c: Ctx): Record<GroupKey, number> {
  const cnt = Object.fromEntries(V2_GROUPS.map((g) => [g.key, 0])) as Record<GroupKey, number>;
  c.data.forEach((t) => { const g = groupOf(c.d, t); if (g) cnt[g]++; });
  return cnt;
}

/** สรุปตัวเลขหลัก (ไม่ขึ้นกับตัวกรองสถานะ เพื่อให้กดไล่ดูแต่ละกลุ่มได้) */
export function headlineCounts(c: Ctx) {
  const g = groupCounts(c);
  const done = g.done, pending = g.open + g.ico + g.bounce + g.itl + g.itm + g.final;
  const voided = c.data.filter((t) => t.status === 'REJECTED' || t.status === 'CANCELLED').length;
  return { total: c.data.length, pending, done, voided };
}

export function matchStatus(d: DashData, t: DashTicket, st: StatusFilter): boolean {
  if (!st) return true;
  if (st === 'void') return t.status === 'REJECTED' || t.status === 'CANCELLED';
  const g = groupOf(d, t);
  if (st === 'pending') return !!g && g !== 'done';
  return g === st;
}

export function queueRows(c: Ctx, st: StatusFilter): DashTicket[] {
  return c.data.filter((t) => matchStatus(c.d, t, st)).sort((a, b) => String(b.request_date || '').localeCompare(String(a.request_date || '')));
}

export const costDateOf = (r: TicketService) => r.finish_date || r.received_date || null;

export function costRows(c: Ctx): TicketService[] {
  return c.d.services.filter((r) => {
    if (r.repair_cost == null || !costDateOf(r)) return false;
    if (c.hasRange && !inRange(costDateOf(r), c.range)) return false;
    const t = c.d.ticketMap.get(r.ticket_no);
    if (c.f.dept && t?.department !== c.f.dept) return false;
    if (c.f.cat && catKey(r.job_category) !== catKey(c.f.cat)) return false;
    if (c.f.who && r.work_owner !== c.f.who) return false;
    if (c.f.priority && r.priority !== c.f.priority) return false;
    return true;
  });
}
export function costSummary(c: Ctx) {
  const rows = costRows(c);
  const sum = (o?: 'ICO' | 'ITL') => rows.filter((r) => !o || r.work_owner === o).reduce((a, r) => a + (Number(r.repair_cost) || 0), 0);
  const total = sum(), ico = sum('ICO'), itl = sum('ITL');
  return { total, ico, itl, count: rows.length, icoPct: (ico / (total || 1)) * 100, itlPct: (itl / (total || 1)) * 100 };
}

export function satisfaction(c: Ctx) {
  const rows = c.data.map((t) => c.d.survey.get(t.ticket_no)).filter((x): x is Survey => !!x);
  const avg = rows.length ? rows.reduce((a, r) => a + (r.score_total || 0), 0) / rows.length : null;
  const q = [1, 2, 3, 4, 5].map((i) => {
    const a = rows.length ? rows.reduce((s, r) => s + (Number(r[`score_q${i}` as keyof Survey]) || 0), 0) / rows.length : 0;
    return { label: V2_SV_LABEL[i - 1], avg: a, pct: (a / SURVEY_MAX_Q[i - 1]) * 100 };
  });
  const tone: 'ok' | 'warn' | 'bad' | 'none' = avg == null ? 'none' : avg >= SURVEY_KPI_THRESHOLD ? 'ok' : avg >= 75 ? 'warn' : 'bad';
  return { avg, n: rows.length, q, tone };
}

export function catBars(c: Ctx) {
  const d = c.d.tickets.filter((t) => c.pass(t, 'cat'));
  const rows = [
    ...CAT_KNOWN.map((k) => ({ label: k.label, value: k.value as string, n: d.filter((t) => catKey(t.job_category) === k.key).length })),
    { label: 'ยังไม่ระบุ', value: '', n: d.filter((t) => !catKey(t.job_category)).length },
  ];
  return { rows, max: Math.max(...rows.map((r) => r.n), 1) };
}
export function priorityBars(c: Ctx) {
  const d = c.d.tickets.filter((t) => c.pass(t, 'priority'));
  const rows = [
    { label: 'ด่วน', value: 'URGENT', n: d.filter((t) => t.priority === 'URGENT').length },
    { label: 'ปกติ', value: 'NORMAL', n: d.filter((t) => t.priority === 'NORMAL').length },
    { label: 'ยังไม่ระบุ', value: '', n: d.filter((t) => !t.priority).length },
  ];
  return { rows, max: Math.max(...rows.map((r) => r.n), 1) };
}
export function whoBars(c: Ctx) {
  const d = c.d.tickets.filter((t) => c.pass(t, 'who'));
  const rows = [
    { label: 'ICO', value: 'ICO', n: d.filter((t) => t.work_owner === 'ICO').length },
    { label: 'Direct ITL', value: 'ITL', n: d.filter((t) => t.work_owner === 'ITL').length },
    { label: 'ยังไม่ระบุ', value: '', n: d.filter((t) => !t.work_owner).length },
  ];
  return { rows, max: Math.max(...rows.map((r) => r.n), 1) };
}
export function deptBars(c: Ctx) {
  const d = c.d.tickets.filter((t) => c.pass(t, 'dept')), m: Record<string, number> = {};
  d.forEach((t) => { const k = t.department || 'ไม่ระบุ'; m[k] = (m[k] || 0) + 1; });
  const rows = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n }));
  return { rows, max: Math.max(...rows.map((r) => r.n), 1) };
}
export interface MonthRow { y: number; m: number; key: string; total: number; done: number; open: number; avg: number | null; sel: boolean }
export function monthRows(c: Ctx, now = new Date()): MonthRow[] {
  const base = c.d.tickets.filter((t) => c.pass(t, 'date'));
  const out: MonthRow[] = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = dt.getFullYear(), m = dt.getMonth();
    const rows = base.filter((t) => { if (!t.request_date) return false; const x = new Date(t.request_date); return x.getFullYear() === y && x.getMonth() === m; });
    const sc = rows.map((t) => c.d.survey.get(t.ticket_no)).filter((x): x is Survey => !!x).map((s) => s.score_total || 0);
    const done = rows.filter((t) => t.status === 'DONE').length;
    out.push({ y, m, key: `${y}-${String(m + 1).padStart(2, '0')}`, total: rows.length, done, open: rows.length - done,
      avg: sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null, sel: isMonthInRange(y, m, c.range) });
  }
  return out;
}
export function svTrack(c: Ctx) {
  const done = c.data.filter((t) => t.status === 'DONE');
  return { pend: done.filter((t) => !c.d.survey.has(t.ticket_no)), evaluated: done.filter((t) => c.d.survey.has(t.ticket_no)) };
}
export function departmentsOf(d: DashData): string[] {
  return [...new Set(d.tickets.map((t) => t.department).filter(Boolean))].sort();
}
