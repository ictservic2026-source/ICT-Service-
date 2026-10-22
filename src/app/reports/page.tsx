'use client';
import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type { TicketStatus } from '@/types';
import { ALL_STATUSES, CASE_TABLE_COLS, PENDING_STATUSES, caseTableRows, defaultReportFilter, periodLabel, reportFileName, runReport, summarize, type Period, type ReportFilter, type ReportResult } from '@/lib/reports/report';
import { STATUS_META } from '@/lib/constants';
import { fmtShortDate, fmtMoney } from '@/lib/utils/format';
import { useSnapshot, useToast } from '@/hooks';
import { StaffShell } from '@/components/layout/StaffShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Checkbox } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/Badge';
import { PageLoading } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { HBars } from '@/components/dashboard/Charts';
import { TicketDrawer } from '@/components/dashboard/TicketDrawer';
import { CaseDocButton, CaseDocsPanel } from '@/components/CaseDocs';

const PREVIEW_MAX = 200;

export default function ReportsPage() {
  const { snapshot, loading, error } = useSnapshot();
  const toast = useToast();
  const [f, setF] = useState<ReportFilter>(() => defaultReportFilter());
  const [res, setRes] = useState<ReportResult | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<ReportFilter>) => setF((x) => ({ ...x, ...p }));
  const depts = useMemo(() => [...new Set((snapshot?.tickets ?? []).map((t) => t.department).filter(Boolean))].sort(), [snapshot]);
  const sum = useMemo(() => (res ? summarize(res) : null), [res]);
  const years = useMemo(() => { const y = new Date().getFullYear(); return Array.from({ length: 6 }, (_, i) => String(y - i)); }, []);

  function search(): ReportResult | null {
    if (!snapshot) return null;
    if (!f.statuses.length) { toast.error('กรุณาเลือกสถานะอย่างน้อย 1 รายการ'); return null; }
    const r = runReport(snapshot, f);
    setRes(r);
    if (!r.tickets.length) toast.error('ไม่พบข้อมูลตามเงื่อนไขที่เลือก'); else toast.success(`พบข้อมูล ${r.tickets.length} รายการ`);
    return r;
  }
  async function exportXlsx() {
    const r = search();
    if (!r || !r.tickets.length) return;
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      // หน้าเดียว 11 คอลัมน์ — วันที่เป็นข้อความ DD-MM-YY (ค.ศ.)
      const ws = XLSX.utils.aoa_to_sheet([CASE_TABLE_COLS.map((c) => c.h), ...caseTableRows(r)]);
      ws['!cols'] = CASE_TABLE_COLS.map((c) => ({ wch: c.w }));
      if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
      XLSX.utils.book_append_sheet(wb, ws, 'รายงาน');
      const name = reportFileName(f);
      XLSX.writeFile(wb, name);
      toast.success(`Export สำเร็จ: ${name}`);
    } catch (e) { toast.error('Export ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(false); }
  }
  const toggle = (s: TicketStatus) => set({ statuses: f.statuses.includes(s) ? f.statuses.filter((x) => x !== s) : [...f.statuses, s] });

  return (
    <StaffShell roles={['ICO', 'ITL', 'ITM']} title="รายงาน / Export" subtitle="ค้นหา แล้วส่งออกเป็น Excel หรือดาวน์โหลดเอกสาร PDF ของเคส" wide>
      {error && <p role="alert" className="mb-3 rounded-xl border border-err/40 bg-[var(--err-bg)] p-3 text-sm text-err">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      {loading || !snapshot ? <PageLoading /> : (
        <div className="space-y-4">
          <Card className="space-y-4 p-5" data-testid="report-filters">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <span className="mb-1.5 block text-[13px] font-medium">ช่วงเวลา (วันที่แจ้ง)</span>
                <Tabs variant="pills" value={f.period} onChange={(p: Period) => set({ period: p })} tabs={[{ id: 'month', label: 'รายเดือน' }, { id: 'year', label: 'รายปี' }, { id: 'range', label: 'กำหนดเอง' }, { id: 'all', label: 'ทั้งหมด' }]} />
                <div className="mt-2.5">
                  {f.period === 'month' && <Input type="month" aria-label="เดือน" data-testid="rf-month" value={f.month} onChange={(e) => set({ month: e.target.value })} />}
                  {f.period === 'year' && <Select aria-label="ปี" data-testid="rf-year" value={f.year} onChange={(e) => set({ year: e.target.value })}>{years.map((y) => <option key={y}>{y}</option>)}</Select>}
                  {f.period === 'range' && <div className="flex items-center gap-2"><Input type="date" aria-label="ตั้งแต่" data-testid="rf-from" value={f.from} onChange={(e) => set({ from: e.target.value })} /><span className="text-sub">–</span><Input type="date" aria-label="ถึง" data-testid="rf-to" value={f.to} onChange={(e) => set({ to: e.target.value })} /></div>}
                </div>
              </div>
              <Field label="แผนก" htmlFor="rf-dept"><Select id="rf-dept" data-testid="rf-dept" value={f.department} onChange={(e) => set({ department: e.target.value })}><option value="">ทุกแผนก</option>{depts.map((d) => <option key={d}>{d}</option>)}</Select></Field>
              <Field label="ความสำคัญ" htmlFor="rf-prio"><Select id="rf-prio" data-testid="rf-prio" value={f.priority} onChange={(e) => set({ priority: e.target.value as ReportFilter['priority'] })}><option value="">ทุกระดับ</option><option value="NORMAL">ปกติ</option><option value="URGENT">ด่วน</option></Select></Field>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[13px] font-medium">สถานะ</span>
                <Button size="sm" variant="secondary" onClick={() => set({ statuses: [...PENDING_STATUSES] })} data-testid="rf-pending">⏳ เฉพาะงานค้าง</Button>
                <Button size="sm" variant="secondary" onClick={() => set({ statuses: [...ALL_STATUSES] })}>เลือกทั้งหมด</Button>
                <Button size="sm" variant="ghost" onClick={() => set({ statuses: [] })}>ล้างการเลือก</Button></div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ALL_STATUSES.map((s) => <Checkbox key={s} data-testid={`rf-st-${s}`} checked={f.statuses.includes(s)} onChange={() => toggle(s)} label={STATUS_META[s].label} />)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Button onClick={search} data-testid="rf-search"><Search className="size-4" />ค้นหา / แสดงตัวอย่าง</Button>
              <Button variant="success" onClick={exportXlsx} loading={busy} data-testid="rf-export"><Download className="size-4" />Export เป็น Excel</Button>
            </div>
          </Card>

          {res && sum && res.tickets.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6" data-testid="report-summary">
                <div className="rounded-2xl border border-line bg-surface p-4 shadow-card"><p className="num text-2xl font-bold" data-testid="rs-total">{sum.total}</p><p className="text-xs text-sub">ทั้งหมด</p></div>
                <div className="rounded-2xl border border-line bg-surface p-4 shadow-card"><p className="num text-2xl font-bold" data-testid="rs-cost">{fmtMoney(sum.cost)}</p><p className="text-xs text-sub">ค่าใช้จ่ายรวม (บาท)</p></div>
                {ALL_STATUSES.filter((s) => sum.byStatus[s]).map((s) => <div key={s} className="rounded-2xl border border-line bg-surface p-4 shadow-card"><p className="num text-2xl font-bold">{sum.byStatus[s]}</p><p className="text-xs text-sub">{STATUS_META[s].label}</p></div>)}
              </div>
              <Card><CardHeader title="จำนวนตามสถานะ" /><div className="p-5"><HBars rows={ALL_STATUSES.filter((s) => sum.byStatus[s]).map((s) => ({ label: STATUS_META[s].label, n: sum.byStatus[s] }))} max={Math.max(...Object.values(sum.byStatus))} /></div></Card>
              <CaseDocsPanel items={res.tickets.map((t) => ({ t, svc: res.serviceMap.get(t.ticket_no) }))} label={periodLabel(res.filter)} />
              <Card>
                <CardHeader title="ตัวอย่างข้อมูล" subtitle={`แสดง ${Math.min(PREVIEW_MAX, res.tickets.length)} จาก ${res.tickets.length} รายการ (ไฟล์ Export มีครบทุกแถว)`} />
                <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm" data-testid="report-preview"><thead className="bg-surface-2 text-xs text-sub"><tr>{['เลขที่', 'วันที่แจ้ง', 'ผู้แจ้ง', 'แผนก', 'ปัญหา', 'สถานะ', 'ความสำคัญ', 'ค่าใช้จ่าย', 'คะแนน', 'ไฟล์แนบ', 'เอกสาร'].map((h) => <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody>{res.tickets.slice(0, PREVIEW_MAX).map((t) => { const s = res.serviceMap.get(t.ticket_no), sv = res.surveyMap.get(t.ticket_no);
                    const att = (t.issue_img_url?.length ?? 0) + (t.attachment_url?.length ?? 0) + (s?.attachment_urls?.length ?? 0);
                    return <tr key={t.ticket_no} onClick={() => setDrawer(t.ticket_no)} className="cursor-pointer border-t border-line/70 hover:bg-brand-pale/60"><td className="num px-3 py-2 font-semibold whitespace-nowrap text-brand-d">{t.ticket_no}</td><td className="px-3 py-2 whitespace-nowrap">{fmtShortDate(t.request_date)}</td><td className="px-3 py-2">{t.requester_name}</td><td className="px-3 py-2">{t.department}</td><td className="max-w-[220px] truncate px-3 py-2 text-sub">{t.issue_detail}</td><td className="px-3 py-2"><StatusBadge status={t.status} short /></td><td className="px-3 py-2">{s?.priority === 'URGENT' ? 'ด่วน' : s?.priority ? 'ปกติ' : '—'}</td><td className="num px-3 py-2 text-right">{s?.repair_cost ? fmtMoney(s.repair_cost) : '—'}</td><td className="num px-3 py-2">{sv ? sv.score_total : '—'}</td><td className="px-3 py-2">{att} ไฟล์</td><td className="px-3 py-1.5"><CaseDocButton t={t} svc={s} label="PDF" /></td></tr>; })}</tbody></table></div>
              </Card>
            </>
          )}
          {res && !res.tickets.length && <Card><EmptyState icon="🔎" title="ไม่พบข้อมูลตามเงื่อนไขที่เลือก" hint="ลองขยายช่วงเวลาหรือเลือกสถานะเพิ่ม" /></Card>}
        </div>
      )}
      <TicketDrawer ticketNo={drawer} onClose={() => setDrawer(null)} />
    </StaffShell>
  );
}
