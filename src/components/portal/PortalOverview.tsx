'use client';
import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { catBars, defaultFilter, groupCounts, makeCtx, monthRows, satisfaction, svTrack, V2_GROUPS, deptBars, type DashData, type GroupKey } from '@/lib/analytics/dashboard';
import { SURVEY_KPI_THRESHOLD } from '@/lib/constants';
import { fmtShortDate } from '@/lib/utils/format';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge, UrgentBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Field';
import { Donut, HBars, MonthlyChart } from '@/components/dashboard/Charts';

const GO: Partial<Record<GroupKey, string>> = { open: 'mgr', ico: 'todo', bounce: 'bounce', itl: 'itl', itm: 'itm', final: 'final', done: 'done' };
const LABEL: Partial<Record<GroupKey, string>> = { open: 'รอหัวหน้างานอนุมัติ' };

/** ภาพรวมของ ICO แบบแดชบอร์ดย่อม: สถานะ · วงกลม · รายเดือน · เตรียมรับงาน (รอหัวหน้าอนุมัติ) · ประเภท/แผนก */
export function PortalOverview({ data, month, onMonth, months, onGo, onOpen }: {
  data: DashData; month: string; onMonth: (m: string) => void; months: { key: string; label: string }[];
  onGo: (cardKey: string) => void; onOpen: (no: string) => void;
}) {
  const f = useMemo(() => ({ ...defaultFilter(), mode: month ? ('month' as const) : ('all' as const), month: month || defaultFilter().month }), [month]);
  const c = useMemo(() => makeCtx(data, f), [data, f]);
  const g = groupCounts(c), cat = catBars(c), dept = deptBars(c), sv = satisfaction(c), tr = svTrack(c);
  // กราฟรายเดือนแสดง 12 เดือนล่าสุดเสมอ (ไม่ถูกตัดด้วยเดือนที่เลือก) แต่ไฮไลต์เดือนที่เลือก
  const mc = useMemo(() => makeCtx(data, { ...f, mode: 'all' }), [data, f]);
  const mrows = monthRows(mc).map((m) => ({ ...m, sel: !!month && m.key === month }));
  const parts = V2_GROUPS.map((x) => ({ label: LABEL[x.key] ?? x.label, value: g[x.key], color: x.color, key: x.key }));
  const prep = c.data
    .filter((t) => t.status === 'OPEN' || t.status === 'MGR_WAIT')
    .sort((a, b) => (a.required_date ?? '9999').localeCompare(b.required_date ?? '9999'))
    .slice(0, 6);
  const todo = c.data.filter((t) => t.status === 'ICO_WORK').length;

  return (
    <div className="space-y-4" data-testid="overview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-sub">{month ? `เดือนที่เลือก · ${c.data.length} รายการ` : `ทุกเดือน · ${c.data.length} รายการ`}</p>
        <Select value={month} onChange={(e) => onMonth(e.target.value)} className="h-9 !w-44" aria-label="เดือน" data-testid="ov-month">
          <option value="">ทุกเดือน</option>
          {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
        {V2_GROUPS.map((x) => (
          <button key={x.key} onClick={() => GO[x.key] && onGo(GO[x.key]!)} data-testid={`ov-${x.key}`}
            className="rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition hover:border-brand-line hover:bg-brand-pale/50">
            <p className="num text-2xl leading-none font-bold" style={{ color: x.color }}>{g[x.key]}</p>
            <p className="mt-1.5 text-[11px] leading-tight text-sub">{LABEL[x.key] ?? x.label}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader title="สัดส่วนตามขั้นตอน" subtitle="กดส่วนของวงกลมเพื่อดูรายการ" />
          <div className="flex flex-col items-center gap-3 p-4 sm:flex-row sm:justify-center lg:flex-col xl:flex-row">
            <Donut parts={parts} size={148} onPick={(k) => GO[k as GroupKey] && onGo(GO[k as GroupKey]!)} />
            <ul className="space-y-1 text-xs">
              {parts.map((p) => <li key={p.key} className="flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ background: p.color }} /><span className="text-sub">{p.label}</span><b className="num ml-auto pl-3">{p.value}</b></li>)}
            </ul>
          </div>
        </Card>
        <Card className="lg:col-span-5">
          <CardHeader title="งานรายเดือน (12 เดือนล่าสุด)" subtitle="กดแท่งเพื่อกรองเดือน · ส่วนเข้มคือเสร็จสิ้น" />
          <div className="px-4 pb-3"><MonthlyChart rows={mrows} onPick={(k) => onMonth(month === k ? '' : k)} /></div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="ความพึงพอใจ" subtitle={`KPI ≥ ${SURVEY_KPI_THRESHOLD} คะแนน`} />
          <div className="p-4">
            <p className="num text-4xl font-bold" style={{ color: sv.tone === 'ok' ? 'var(--ok)' : sv.tone === 'warn' ? 'var(--warn)' : sv.tone === 'bad' ? 'var(--err)' : 'var(--mute)' }} data-testid="ov-sv-avg">{sv.avg != null ? sv.avg.toFixed(1) : '—'}</p>
            <p className="mt-1 text-xs text-sub">จาก {sv.n} แบบประเมิน</p>
            <p className="mt-0.5 text-xs text-mute">รอประเมิน {tr.pend.length} · ประเมินแล้ว {tr.evaluated.length}</p>
            <p className="mt-3 border-t border-line pt-3 text-xs text-sub">งานที่ ICO ต้องทำ <b className="num text-[#7C3AED]">{todo}</b> รายการ</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-6" >
          <CardHeader title="เตรียมรับงาน · รอหัวหน้างานอนุมัติ" subtitle="เรียงตามวันที่ต้องการ" action={<button onClick={() => onGo('mgr')} className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-d hover:underline" data-testid="ov-prep-all">ดูทั้งหมด<ChevronRight className="size-3.5" /></button>} />
          {prep.length === 0 ? <p className="p-5 text-center text-xs text-mute" data-testid="ov-prep-empty">ไม่มีงานที่รอหัวหน้างานอนุมัติ</p> : (
            <ul className="divide-y divide-line" data-testid="ov-prep">
              {prep.map((t) => (
                <li key={t.ticket_no}>
                  <button onClick={() => onOpen(t.ticket_no)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs hover:bg-brand-pale/50" data-testid="ov-prep-row">
                    <span className="min-w-0"><b className="num text-brand-d">{t.ticket_no}</b>{t.priority === 'URGENT' && <span className="ml-1.5"><UrgentBadge /></span>}<br />
                      <span className="block truncate text-mute">{t.requester_name} · {t.department}</span></span>
                    <span className="shrink-0 text-right"><span className="text-mute">ต้องการภายใน</span><br /><b className="num">{t.required_date ? fmtShortDate(t.required_date) : '—'}</b></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-3"><CardHeader title="ตามประเภทงาน" /><div className="p-4"><HBars rows={cat.rows} max={cat.max} /></div></Card>
        <Card className="lg:col-span-3"><CardHeader title="ตามแผนก (Top 5)" /><div className="p-4"><HBars rows={dept.rows.slice(0, 5).map((r) => ({ label: r.k, n: r.n }))} max={dept.max} color="var(--navy-2)" /></div></Card>
      </div>
    </div>
  );
}
