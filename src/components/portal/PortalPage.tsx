'use client';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, RefreshCw } from 'lucide-react';
import type { Role } from '@/types';
import { groupOf, type DashTicket, type GroupKey } from '@/lib/analytics/dashboard';
import { JOB_CATEGORIES, ROLE_PORTAL, STATUS_META, STATUS_ORDER } from '@/lib/constants';
import { useDashData } from '@/hooks';
import { StaffShell } from '@/components/layout/StaffShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { PageLoading } from '@/components/ui/Spinner';
import { TicketModal } from '@/components/tickets/TicketModal';
import { SurveyDetailModal } from '@/components/tickets/SurveyDetail';
import { MONTH_SHORT, monthKey } from '@/lib/utils/format';
import { TicketTable, type Row } from './TicketTable';
import { PortalOverview } from './PortalOverview';

export interface StatCard { key: string; label: string; tone: string; test: (t: DashTicket, d: { bounced: boolean }) => boolean }

/** หน้ารายการงานของแต่ละบทบาท — ตัวกรอง/การ์ดสรุป/ตาราง/Modal ใช้ร่วมกัน ต่างกันที่ config */
export function PortalPage({ role, title, subtitle, listStatuses, includeBounced, cards, showCost, withOverview, roles }: {
  role: Role; title: string; subtitle: string; listStatuses: string[]; includeBounced?: boolean; cards: StatCard[]; showCost?: boolean; withOverview?: boolean; roles: Role[];
}) {
  const { data, snapshot, loading, error, refresh } = useDashData();
  const params = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<'overview' | 'list'>(withOverview ? 'overview' : 'list');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [cat, setCat] = useState('');
  const [month, setMonth] = useState(''); // '' = ทุกเดือน, หรือ YYYY-MM ของวันที่แจ้ง
  const [card, setCard] = useState('');
  const [openNo, setOpenNo] = useState<string | null>(null);
  const [svNo, setSvNo] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);

  const qOpen = params.get('open');
  const qTab = params.get('tab') === 'log' ? 'log' : undefined; // จากกระดิ่ง → เปิดแท็บประวัติ/ทีมทันที
  useEffect(() => { if (qOpen) { setOpenNo(qOpen); setView('list'); } }, [qOpen]);
  const closeModal = () => { setOpenNo(null); if (qOpen) router.replace(ROLE_PORTAL[role]); };

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    return data.tickets
      .map((t) => {
        const b = groupOf(data, t) === 'bounce';
        return { t, bounced: b, survey: data.survey.get(t.ticket_no) ?? null, cost: data.svcMap.get(t.ticket_no)?.repair_cost ?? null } as Row;
      })
      .filter((r) => listStatuses.includes(r.t.status) || (includeBounced && r.bounced));
  }, [data, listStatuses, includeBounced]);

  const monthOf = (d?: string | null) => (d ? monthKey(new Date(d)) : '');
  const monthOptions = useMemo(() => {
    const set = new Set(rows.map((r) => monthOf(r.t.request_date)).filter(Boolean));
    return [...set].sort().reverse().map((k) => { const [y, m] = k.split('-').map(Number); return { key: k, label: `${MONTH_SHORT[m - 1]} ${y + 543}` }; });
  }, [rows]);
  const inMonth = useMemo(() => rows.filter((r) => !month || monthOf(r.t.request_date) === month), [rows, month]);
  const counts = useMemo(() => Object.fromEntries(cards.map((c) => [c.key, inMonth.filter((r) => c.test(r.t, r)).length])), [cards, inMonth]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const c = cards.find((x) => x.key === card);
    return inMonth.filter((r) => {
      if (c && !c.test(r.t, r)) return false;
      if (status && r.t.status !== status) return false;
      if (cat && r.t.job_category !== cat) return false;
      if (s && !`${r.t.ticket_no} ${r.t.requester_name} ${r.t.department} ${r.t.issue_detail} ${r.t.asset_id ?? ''}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [inMonth, q, status, cat, card, cards]);

  return (
    <StaffShell roles={roles} title={title} subtitle={subtitle} wide
      actions={<Button variant="ghost" size="sm" onClick={async () => { setSpin(true); await refresh(); setSpin(false); }} aria-label="รีเฟรช" data-testid="refresh"><RefreshCw className={clsx('size-4', spin && 'anim-spin')} /></Button>}>
      {error && <p role="alert" className="mb-3 rounded-xl border border-err/40 bg-[var(--err-bg)] p-3 text-sm text-err">โหลดข้อมูลไม่สำเร็จ: {error}</p>}
      {loading || !data || !snapshot ? <PageLoading /> : (
        <div className="space-y-4">
          {withOverview && <Tabs variant="pills" className="w-fit" value={view} onChange={setView} tabs={[{ id: 'overview', label: '📊 ภาพรวม' }, { id: 'list', label: '📋 รายการงาน', count: rows.length }]} />}
          {view === 'overview' && withOverview ? (
            <PortalOverview data={data} month={month} onMonth={setMonth} months={monthOptions} onGo={(c) => { setCard(c); setView('list'); }} onOpen={setOpenNo} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" data-testid="stat-cards">
                {cards.map((c) => (
                  <button key={c.key} onClick={() => setCard(card === c.key ? '' : c.key)} aria-pressed={card === c.key} data-testid={`card-${c.key}`}
                    className={clsx('rounded-2xl border bg-surface p-4 text-left shadow-card transition hover:-translate-y-0.5', card === c.key ? 'border-brand ring-2 ring-brand/25' : 'border-line')}>
                    <p className={clsx('num text-2xl font-bold', c.tone)}>{counts[c.key] ?? 0}</p>
                    <p className="mt-0.5 text-xs text-sub">{c.label}</p>
                  </button>
                ))}
              </div>
              <Card>
                <div className="flex flex-wrap items-center gap-2.5 border-b border-line p-3.5">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mute" aria-hidden />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา เลขที่ / ผู้แจ้ง / แผนก / ปัญหา…" className="h-10 pl-9" aria-label="ค้นหา" data-testid="search" />
                  </div>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto" aria-label="สถานะ" data-testid="filter-status">
                    <option value="">ทุกสถานะ</option>
                    {STATUS_ORDER.filter((s) => listStatuses.includes(s)).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </Select>
                  <Select value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 w-auto" aria-label="เดือน" data-testid="filter-month">
                    <option value="">ทุกเดือน</option>
                    {monthOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </Select>
                  <Select value={cat} onChange={(e) => setCat(e.target.value)} className="h-10 w-auto" aria-label="ประเภทงาน" data-testid="filter-cat">
                    <option value="">ทุกประเภท</option>
                    {JOB_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                  {(q || status || cat || card || month) && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setStatus(''); setCat(''); setCard(''); setMonth(''); }}>ล้างตัวกรอง</Button>}
                </div>
                <TicketTable rows={filtered} master={snapshot.workStatus} onOpen={setOpenNo} showCost={showCost} onSurvey={setSvNo} />
              </Card>
            </>
          )}
        </div>
      )}
      {openNo && <TicketModal ticketNo={openNo} portal={role} onClose={closeModal} initialTab={openNo === qOpen ? qTab : undefined} />}
      <SurveyDetailModal ticketNo={svNo} ticket={svNo ? data?.ticketMap.get(svNo) : null} onClose={() => setSvNo(null)} />
    </StaffShell>
  );
}

export type { GroupKey };
