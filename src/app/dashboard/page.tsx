'use client';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Copy, Printer, X } from 'lucide-react';
import {
  RANGE_MODE_LABEL, STATUS_FILTER_LABEL, catBars, costRows, costSummary, defaultFilter, deptBars, departmentsOf, groupCounts, headlineCounts, makeCtx, monthRows,
  priorityBars, queueRows, satisfaction, svTrack, whoBars, V2_GROUPS, type DashFilter, type RangeMode, type StatusFilter,
} from '@/lib/analytics/dashboard';
import { CAT_KNOWN } from '@/lib/analytics/dashboard';
import { SURVEY_KPI_THRESHOLD } from '@/lib/constants';
import { MONTH_SHORT, fmtBaht, fmtDate, fmtShortDate } from '@/lib/utils/format';
import { useDashData, useTheme, useToast } from '@/hooks';
import { StaffShell } from '@/components/layout/StaffShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { StatusBadge, Badge, UrgentBadge } from '@/components/ui/Badge';
import { PageLoading } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Donut, HBars, MonthlyChart } from '@/components/dashboard/Charts';
import { TicketDrawer } from '@/components/dashboard/TicketDrawer';
import { SurveyDetailModal } from '@/components/tickets/SurveyDetail';

const MODES = Object.keys(RANGE_MODE_LABEL) as RangeMode[];

export default function DashboardPage() {
  const { data, loading, error } = useDashData();
  const { dark } = useTheme();
  const toast = useToast();
  const [f, setF] = useState<DashFilter>(() => defaultFilter());
  const [drawer, setDrawer] = useState<string | null>(null);
  const [svNo, setSvNo] = useState<string | null>(null);
  const set = (p: Partial<DashFilter>) => setF((x) => ({ ...x, ...p }));
  /** เลือกสถานะแล้วเลื่อนไปที่รายการงาน (กดซ้ำ = ยกเลิก) */
  const pickStatus = (st: StatusFilter) => {
    setF((x) => ({ ...x, status: x.status === st ? '' : st }));
    window.setTimeout(() => document.getElementById('queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
  const pickMonth = (key: string) => setF((x) => (x.mode === 'month' && x.month === key ? { ...x, mode: 'all' } : { ...x, mode: 'month', month: key }));

  const c = useMemo(() => (data ? makeCtx(data, f) : null), [data, f]);
  const v = useMemo(() => {
    if (!c) return null;
    return { g: groupCounts(c), head: headlineCounts(c), pri: priorityBars(c), who: whoBars(c), rows: queueRows(c, f.status), cost: costSummary(c), costR: costRows(c), sat: satisfaction(c), cat: catBars(c), dept: deptBars(c), months: monthRows(c), tr: svTrack(c) };
  }, [c, f.status]);

  const surveyLink = (no: string) => {
    const t = data?.ticketMap.get(no);
    return t?.survey_token ? `${window.location.origin}/survey/${t.survey_token}` : '';
  };

  return (
    <StaffShell roles={['ICO', 'ITL', 'ITM']} title="Dashboard" wide subtitle={c ? `ช่วงเวลา: ${c.range.label}` : undefined}
      actions={<Button variant="ghost" size="sm" onClick={() => window.print()} aria-label="พิมพ์"><Printer className="size-4" /></Button>}>
      {error && <p role="alert" className="mb-3 rounded-xl border border-err/40 bg-[var(--err-bg)] p-3 text-sm text-err">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      {loading || !data || !c || !v ? <PageLoading /> : (
        <div className="space-y-4" data-testid="dashboard">
          {/* ───── Filters ───── */}
          <Card className="no-print p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <Field label="ช่วงเวลา" htmlFor="df-mode"><Select id="df-mode" data-testid="df-mode" value={f.mode} onChange={(e) => set({ mode: e.target.value as RangeMode })}>{MODES.map((m) => <option key={m} value={m}>{RANGE_MODE_LABEL[m]}</option>)}</Select></Field>
              {(f.mode === 'month' || f.mode === 'months') && <Field label={f.mode === 'months' ? 'ตั้งแต่เดือน' : 'เดือน'} htmlFor="df-month"><Input id="df-month" data-testid="df-month" type="month" value={f.month} onChange={(e) => set({ month: e.target.value })} /></Field>}
              {f.mode === 'months' && <Field label="ถึงเดือน" htmlFor="df-month2"><Input id="df-month2" type="month" value={f.month2} onChange={(e) => set({ month2: e.target.value })} /></Field>}
              {f.mode === 'range' && <><Field label="ตั้งแต่วันที่" htmlFor="df-from"><Input id="df-from" data-testid="df-from" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></Field><Field label="ถึงวันที่" htmlFor="df-to"><Input id="df-to" data-testid="df-to" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} /></Field></>}
              <Field label="แผนก" htmlFor="df-dept"><Select id="df-dept" data-testid="df-dept" value={f.dept} onChange={(e) => set({ dept: e.target.value })}><option value="">ทุกแผนก</option>{departmentsOf(data).map((d) => <option key={d}>{d}</option>)}</Select></Field>
              <Field label="ประเภทงาน" htmlFor="df-cat"><Select id="df-cat" data-testid="df-cat" value={f.cat} onChange={(e) => set({ cat: e.target.value })}><option value="">ทุกประเภท</option>{CAT_KNOWN.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select></Field>
              <Field label="ความเร่งด่วน" htmlFor="df-pri"><Select id="df-pri" data-testid="df-pri" value={f.priority} onChange={(e) => set({ priority: e.target.value as DashFilter['priority'] })}><option value="">ทุกระดับ</option><option value="URGENT">ด่วน</option><option value="NORMAL">ปกติ</option></Select></Field>
              <Field label="สถานะงาน" htmlFor="df-status"><Select id="df-status" data-testid="df-status" value={f.status} onChange={(e) => set({ status: e.target.value as StatusFilter })}>
                <option value="">{STATUS_FILTER_LABEL['']}</option><option value="pending">{STATUS_FILTER_LABEL.pending}</option>{V2_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}<option value="void">{STATUS_FILTER_LABEL.void}</option></Select></Field>
              <Field label="ผู้ดำเนินการ" htmlFor="df-who"><Select id="df-who" data-testid="df-who" value={f.who} onChange={(e) => set({ who: e.target.value as DashFilter['who'] })}><option value="">ทั้งหมด</option><option value="ICO">ICO</option><option value="ITL">Direct ITL</option></Select></Field>
              <div className="flex items-end"><Button variant="secondary" onClick={() => setF(defaultFilter())} data-testid="df-reset">รีเซ็ต</Button></div>
            </div>
          </Card>

          {/* ───── KPI หลัก (กดเพื่อดูรายการ) ───── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" data-testid="kpi-main">
            {([
              { k: 'total', label: 'คำขอทั้งหมด', val: String(v.head.total), st: '' as StatusFilter },
              { k: 'pending', label: 'อยู่ระหว่างดำเนินการ', val: String(v.head.pending), st: 'pending' as StatusFilter },
              { k: 'done', label: 'ปิดงานแล้ว', val: String(v.head.done), st: 'done' as StatusFilter },
              { k: 'void', label: 'ไม่อนุมัติ / ยกเลิก', val: String(v.head.voided), st: 'void' as StatusFilter },
              { k: 'cost', label: 'ค่าใช้จ่ายรวม', val: fmtBaht(v.cost.total), st: null },
            ]).map((x) => (
              <button key={x.k} data-testid={`kpi2-${x.k}`} aria-pressed={x.st !== null && f.status === x.st && (x.st !== '' || f.status === '')}
                onClick={() => (x.st === null ? document.getElementById('cost')?.scrollIntoView({ behavior: 'smooth' }) : pickStatus(x.st))}
                className={clsx('group rounded-2xl border bg-surface p-4 text-left transition hover:border-brand hover:-translate-y-0.5', x.st !== null && f.status === x.st && x.st !== '' ? 'border-brand ring-2 ring-brand/20' : 'border-line')}>
                <p className="text-[13px] font-medium text-sub">{x.label}</p>
                <p className="num mt-1.5 text-[28px] leading-none font-semibold tracking-tight text-ink" data-testid={`kpi2-val-${x.k}`}>{x.val}</p>
                <p className="mt-2 text-xs text-mute opacity-0 transition group-hover:opacity-100">{x.st === null ? 'ดูรายละเอียดค่าใช้จ่าย ↓' : 'กดเพื่อดูรายการ ↓'}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="12 เดือนล่าสุด" subtitle="แท่งทึบ = ปิดงานแล้ว · คลิกแท่งเพื่อกรองเป็นเดือนนั้น (คลิกซ้ำ = ทุกช่วงเวลา)" />
              <div className="px-5 py-3"><MonthlyChart rows={v.months} onPick={pickMonth} /></div>
            </Card>
            <Card>
              <CardHeader title="สัดส่วนตามขั้นตอน" subtitle="คลิกส่วนของวงกลมเพื่อดูรายการ" />
              <div className="flex flex-col items-center gap-4 p-5">
                <Donut parts={V2_GROUPS.map((g) => ({ key: g.key, label: g.label, value: v.g[g.key], color: dark ? g.dark : g.color }))} onPick={(k) => pickStatus(k as StatusFilter)} active={V2_GROUPS.some((g) => g.key === f.status) ? f.status : undefined} />
                <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1 text-xs">{V2_GROUPS.map((g) => <li key={g.key}><button type="button" onClick={() => pickStatus(g.key)} className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-surface-2"><span className="size-2.5 rounded-full" style={{ background: dark ? g.dark : g.color }} />{g.label}<b className="num ml-auto">{v.g[g.key]}</b></button></li>)}</ul>
              </div>
            </Card>
          </div>

          {/* ───── ขั้นตอนงาน ───── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" data-testid="kpi-groups">
            {V2_GROUPS.map((g) => (
              <button key={g.key} onClick={() => pickStatus(g.key)} aria-pressed={f.status === g.key} data-testid={`kpi-${g.key}`}
                className={clsx('rounded-2xl border bg-surface p-3.5 text-left transition hover:border-brand', f.status === g.key ? 'border-brand ring-2 ring-brand/20' : 'border-line')}>
                <p className="num text-2xl font-semibold" style={{ color: dark ? g.dark : g.color }} data-testid={`kpi-val-${g.key}`}>{v.g[g.key]}</p>
                <p className="mt-0.5 text-xs text-sub">{g.label}</p>
              </button>
            ))}
          </div>

          {/* ───── รายการงาน ───── */}
          <Card id="queue" className="scroll-mt-20">
            <CardHeader title="รายการงาน" subtitle={`${v.rows.length} รายการ · ${f.status ? (f.status in STATUS_FILTER_LABEL ? STATUS_FILTER_LABEL[f.status as keyof typeof STATUS_FILTER_LABEL] : V2_GROUPS.find((g) => g.key === f.status)!.label) : 'ทุกสถานะ'} · คลิกแถวเพื่อดูรายละเอียด`}
              action={f.status ? <Button size="sm" variant="secondary" onClick={() => set({ status: '' })} data-testid="clear-status"><X className="size-3.5" />ล้างสถานะ</Button> : undefined} />
            <QueueTable rows={v.rows} onOpen={setDrawer} />
          </Card>

          {/* ───── Cost + satisfaction ───── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card id="cost" data-testid="cost-card" className="scroll-mt-20">
              <CardHeader title="ค่าใช้จ่าย" subtitle={`${v.cost.count} รายการ · แยก ICO / Direct ITL`} />
              <div className="p-5">
                <p className="num text-3xl font-bold" data-testid="cost-total">{fmtBaht(v.cost.total)}</p>
                <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-3" role="img" aria-label="สัดส่วนค่าใช้จ่าย ICO กับ ITL">
                  <div className="bg-[#7C3AED]" style={{ width: `${v.cost.icoPct}%` }} /><div className="bg-[#EA580C]" style={{ width: `${v.cost.itlPct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs"><span><i className="mr-1 inline-block size-2 rounded-full bg-[#7C3AED]" />ICO <b className="num">{fmtBaht(v.cost.ico)}</b> ({v.cost.icoPct.toFixed(0)}%)</span><span><i className="mr-1 inline-block size-2 rounded-full bg-[#EA580C]" />Direct ITL <b className="num">{fmtBaht(v.cost.itl)}</b> ({v.cost.itlPct.toFixed(0)}%)</span></div>
                <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-line">
                  <table className="w-full text-xs"><thead className="sticky top-0 bg-surface-2 text-sub"><tr><th className="px-3 py-2 text-left">Ticket</th><th className="px-3 py-2 text-left">ผู้ดำเนินการ</th><th className="px-3 py-2 text-left">วันที่</th><th className="px-3 py-2 text-right">บาท</th></tr></thead>
                    <tbody>{[...v.costR].sort((a, b) => (b.repair_cost || 0) - (a.repair_cost || 0)).slice(0, 30).map((r) => <tr key={r.ticket_no} onClick={() => setDrawer(r.ticket_no)} className="cursor-pointer border-t border-line/70 hover:bg-brand-pale/60"><td className="num px-3 py-1.5 font-semibold text-brand-d">{r.ticket_no}</td><td className="px-3 py-1.5">{r.work_owner}</td><td className="px-3 py-1.5">{fmtShortDate(r.finish_date || r.received_date)}</td><td className="num px-3 py-1.5 text-right">{fmtBaht(r.repair_cost)}</td></tr>)}</tbody></table>
                  {!v.costR.length && <EmptyState title="ไม่มีข้อมูลค่าใช้จ่ายในช่วงนี้" />}
                </div>
              </div>
            </Card>
            <Card data-testid="sat-card">
              <CardHeader title="ความพึงพอใจ" subtitle={`KPI ≥ ${SURVEY_KPI_THRESHOLD} คะแนน · ${v.sat.n} แบบประเมิน`} />
              <div className="p-5">
                <div className="flex items-baseline gap-3"><span className="num text-4xl font-bold" data-testid="sat-avg" style={{ color: v.sat.tone === 'ok' ? 'var(--ok)' : v.sat.tone === 'warn' ? 'var(--warn)' : v.sat.tone === 'bad' ? 'var(--err)' : 'var(--mute)' }}>{v.sat.avg != null ? v.sat.avg.toFixed(1) : '—'}</span><span className="text-xs text-sub">/ 100</span>{v.sat.avg != null && <Badge tone={v.sat.tone === 'ok' ? 'green' : v.sat.tone === 'warn' ? 'amber' : 'red'}>{v.sat.tone === 'ok' ? 'ถึง KPI' : 'ต่ำกว่า KPI'}</Badge>}</div>
                <div className="mt-4 space-y-2.5">{v.sat.q.map((q) => <div key={q.label} className="text-xs"><div className="mb-1 flex justify-between"><span>{q.label}</span><b className="num">{q.avg.toFixed(1)}</b></div><div className="h-2 rounded-full bg-surface-3"><div className="h-full rounded-full" style={{ width: `${q.pct}%`, background: q.pct >= 96 ? 'var(--ok)' : q.pct >= 75 ? 'var(--warn)' : 'var(--err)' }} /></div></div>)}</div>
              </div>
            </Card>
          </div>

          {/* ───── Category / Priority / Dept ───── */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card><CardHeader title="ตามประเภทงาน" subtitle="คลิกเพื่อกรอง" /><div className="p-5"><HBars rows={v.cat.rows} max={v.cat.max} onPick={(x) => set({ cat: x })} active={f.cat} /></div></Card>
            <Card><CardHeader title="ตามความเร่งด่วน / ผู้ดำเนินการ" subtitle="คลิกเพื่อกรอง" /><div className="space-y-4 p-5">
              <HBars rows={v.pri.rows} max={v.pri.max} onPick={(x) => set({ priority: x as DashFilter['priority'] })} active={f.priority} color="var(--err)" />
              <div className="border-t border-line pt-4"><HBars rows={v.who.rows} max={v.who.max} onPick={(x) => set({ who: x as DashFilter['who'] })} active={f.who} /></div></div></Card>
            <Card><CardHeader title="ตามแผนก" subtitle="คลิกเพื่อกรอง" /><div className="max-h-[320px] overflow-y-auto p-5"><HBars rows={v.dept.rows.map((r) => ({ label: r.k, n: r.n }))} max={v.dept.max} color="var(--navy-2)" onPick={(x) => set({ dept: x })} active={f.dept} /></div></Card>
          </div>

          {/* ───── 12 months ───── */}
          <Card>
            <CardHeader title="สรุปรายเดือน" subtitle="เดือนที่อยู่ในตัวกรองจะไฮไลต์" />
            <div className="overflow-x-auto border-t border-line"><table className="w-full min-w-[520px] text-xs" data-testid="month-table"><thead className="bg-surface-2 text-sub"><tr><th className="px-4 py-2 text-left">เดือน</th><th className="px-4 py-2 text-right">ทั้งหมด</th><th className="px-4 py-2 text-right">เสร็จสิ้น</th><th className="px-4 py-2 text-right">ค้าง</th><th className="px-4 py-2 text-right">คะแนนเฉลี่ย</th></tr></thead>
              <tbody>{v.months.map((m) => <tr key={m.key} className={clsx('border-t border-line/70', m.sel && 'bg-brand-pale')}><td className="px-4 py-1.5">{MONTH_SHORT[m.m]} {m.y + 543}</td><td className="num px-4 py-1.5 text-right">{m.total}</td><td className="num px-4 py-1.5 text-right">{m.done}</td><td className="num px-4 py-1.5 text-right">{m.open}</td><td className="num px-4 py-1.5 text-right">{m.avg != null ? m.avg.toFixed(1) : '—'}</td></tr>)}</tbody></table></div>
          </Card>

          {/* ───── Survey tracking ───── */}
          <Card data-testid="survey-tracking">
            <CardHeader title="ติดตามแบบประเมิน" subtitle={`รอประเมิน ${v.tr.pend.length} · ประเมินแล้ว ${v.tr.evaluated.length}`} />
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div><h4 className="mb-2 text-xs font-semibold text-warn">⏳ รอประเมิน</h4>
                <ul className="max-h-64 space-y-1.5 overflow-y-auto">{v.tr.pend.map((t) => (
                  <li key={t.ticket_no} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs"><button className="num font-bold text-brand-d" onClick={() => setDrawer(t.ticket_no)}>{t.ticket_no}</button><span className="min-w-0 flex-1 truncate text-sub">{t.requester_name} · ปิด {fmtShortDate(t.closed_at)}</span>
                    <Button size="sm" variant="secondary" aria-label={`คัดลอกลิงก์ประเมิน ${t.ticket_no}`} onClick={() => { const u = surveyLink(t.ticket_no); navigator.clipboard?.writeText(u).then(() => toast.success('คัดลอกลิงก์แล้ว')).catch(() => toast.info(u)); }}><Copy className="size-3.5" />ลิงก์</Button></li>))}
                  {!v.tr.pend.length && <li className="py-4 text-center text-xs text-mute">ไม่มีรายการค้างประเมิน 🎉</li>}</ul></div>
              <div><h4 className="mb-2 text-xs font-semibold text-ok">✅ ประเมินแล้ว</h4>
                <ul className="max-h-64 space-y-1.5 overflow-y-auto">{v.tr.evaluated.map((t) => { const s = data.survey.get(t.ticket_no)!; return (
                  <li key={t.ticket_no}><button onClick={() => setSvNo(t.ticket_no)} className="flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-xs hover:border-brand"><b className="num text-brand-d">{t.ticket_no}</b><span className="min-w-0 flex-1 truncate text-sub">{t.requester_name}</span><Badge tone={s.score_total >= SURVEY_KPI_THRESHOLD ? 'green' : 'amber'}>{s.score_total}</Badge></button></li>); })}</ul></div>
            </div>
          </Card>
        </div>
      )}
      <TicketDrawer ticketNo={drawer} onClose={() => setDrawer(null)} />
      <SurveyDetailModal ticketNo={svNo} ticket={svNo ? data?.ticketMap.get(svNo) : null} onClose={() => setSvNo(null)} />
    </StaffShell>
  );
}

function QueueTable({ rows, onOpen }: { rows: ReturnType<typeof queueRows>; onOpen: (no: string) => void }) {
  if (!rows.length) return <EmptyState icon="📭" title="ไม่มีรายการตามตัวกรอง" hint="ลองเปลี่ยนช่วงเวลาหรือล้างตัวกรอง" />;
  const cat = (c: string | null) => (c === 'Other' ? 'อื่นๆ' : c || '—');
  return (
    <div className="max-h-[480px] overflow-auto">
      <table className="w-full min-w-[860px] text-sm" data-testid="queue-table">
        <thead className="sticky top-0 bg-surface-2 text-left text-xs text-sub"><tr>
          <th className="px-4 py-2 font-medium">เลขที่งาน</th><th className="px-2 py-2 font-medium">ผู้แจ้ง / แผนก</th><th className="px-2 py-2 font-medium">ประเภทงาน</th>
          <th className="px-2 py-2 font-medium">ความเร่งด่วน</th><th className="px-2 py-2 font-medium">สถานะ</th><th className="px-2 py-2 font-medium">ผู้ดำเนินการ</th><th className="px-4 py-2 text-right font-medium">วันที่แจ้ง</th>
        </tr></thead>
        <tbody>
          {rows.slice(0, 200).map((t) => (
            <tr key={t.ticket_no} data-no={t.ticket_no} tabIndex={0} onClick={() => onOpen(t.ticket_no)} onKeyDown={(e) => e.key === 'Enter' && onOpen(t.ticket_no)} className="cursor-pointer border-t border-line/70 hover:bg-brand-pale/60 focus:bg-brand-pale/60 focus:outline-none">
              <td className="num px-4 py-2.5 font-semibold whitespace-nowrap text-brand-d">{t.ticket_no}</td>
              <td className="px-2 py-2.5"><div className="font-medium">{t.requester_name}</div><div className="text-xs text-mute">{t.department}</div></td>
              <td className="px-2 py-2.5 text-xs whitespace-nowrap">{cat(t.job_category)}</td>
              <td className="px-2 py-2.5">{t.priority === 'URGENT' ? <UrgentBadge /> : <span className="text-xs text-sub">{t.priority === 'NORMAL' ? 'ปกติ' : '—'}</span>}</td>
              <td className="px-2 py-2.5"><StatusBadge status={t.status} short /></td>
              <td className="px-2 py-2.5 text-xs whitespace-nowrap text-sub">{t.staff_name || '—'}</td>
              <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap text-sub">{fmtDate(t.request_date)}</td>
            </tr>))}
        </tbody>
      </table>
      {rows.length > 200 && <p className="border-t border-line px-4 py-2 text-center text-xs text-mute">แสดง 200 รายการแรกจาก {rows.length} — ใช้ตัวกรองเพื่อจำกัดช่วง</p>}
    </div>
  );
}
