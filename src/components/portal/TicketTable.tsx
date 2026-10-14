'use client';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, Star } from 'lucide-react';
import type { Survey, WorkStatusMaster } from '@/types';
import type { DashTicket } from '@/lib/analytics/dashboard';
import { STATUS_META, SURVEY_KPI_THRESHOLD } from '@/lib/constants';
import { fmtBaht, fmtShortDate } from '@/lib/utils/format';
import { Badge, StatusBadge, UrgentBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { WsBadge } from '@/components/tickets/WorkStatus';

export interface Row { t: DashTicket; bounced: boolean; survey: Survey | null; cost: number | null }
type SortKey = 'no' | 'date' | 'req' | 'status' | 'cost';

const statusRank = (s: string) => Object.keys(STATUS_META).indexOf(s);

export function TicketTable({ rows, master, onOpen, showCost, onSurvey, pageSize = 15 }: {
  rows: Row[]; master: WorkStatusMaster[]; onOpen: (no: string) => void; showCost?: boolean; onSurvey?: (no: string) => void; pageSize?: number;
}) {
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'date', dir: -1 });
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => {
    const v = (r: Row) => sort.k === 'no' ? r.t.ticket_no : sort.k === 'date' ? r.t.request_date : sort.k === 'req' ? (r.t.required_date ?? '9999-12-31') : sort.k === 'cost' ? (r.cost ?? -1) : statusRank(r.t.status);
    return [...rows].sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pg = Math.min(page, pages);
  const view = sorted.slice((pg - 1) * pageSize, pg * pageSize);

  const Th = ({ k, children, className }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <th scope="col" aria-sort={k && sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined} className={clsx('px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap text-sub', className)}>
      {k ? <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))} data-testid={`sort-${k}`}>
        {children}{sort.k === k ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button> : children}
    </th>
  );

  if (!rows.length) return <EmptyState icon="📭" title="ไม่พบรายการ" hint="ลองเปลี่ยนตัวกรองหรือคำค้นหา" />;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm" data-testid="ticket-table">
          <thead className="border-b border-line bg-surface-2"><tr>
            <Th k="no">เลขที่</Th><Th>ผู้แจ้ง / แผนก</Th><Th>ปัญหา</Th><Th>ประเภท</Th><Th k="status">สถานะ</Th>
            {showCost && <Th k="cost" className="text-right">ค่าใช้จ่าย</Th>}<Th k="date">วันที่แจ้ง</Th><Th k="req">ต้องการภายใน</Th><Th>ประเมิน</Th>
          </tr></thead>
          <tbody>
            {view.map(({ t, bounced, survey, cost }) => (
              <tr key={t.ticket_no} data-testid="ticket-row" data-no={t.ticket_no} data-status={t.status} data-bounced={bounced || undefined}
                tabIndex={0} onClick={() => onOpen(t.ticket_no)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t.ticket_no); }}
                className={clsx('cursor-pointer border-b border-line/70 transition hover:bg-brand-pale/60 focus:bg-brand-pale/60 focus:outline-none', bounced && 'bg-[var(--err-bg)]/60')}>
                <td className="num px-3 py-3 font-semibold text-brand-d whitespace-nowrap">{t.ticket_no}{t.priority === 'URGENT' && <span className="ml-1.5"><UrgentBadge /></span>}</td>
                <td className="px-3 py-3"><div className="font-medium">{t.requester_name}</div><div className="text-xs text-mute">{t.department}</div></td>
                <td className="max-w-[260px] px-3 py-3"><p className="line-clamp-2 text-[13px] text-sub">{t.issue_detail}</p></td>
                <td className="px-3 py-3 text-xs whitespace-nowrap">{t.job_category ?? <span className="text-mute">—</span>}{t.work_owner === 'ITL' && <Badge tone="orange" className="ml-1.5">Direct ITL</Badge>}</td>
                <td className="px-3 py-3"><div className="flex flex-col items-start gap-1"><StatusBadge status={t.status} bounced={bounced} short /><WsBadge master={master} code={t.work_status} small /></div></td>
                {showCost && <td className="num px-3 py-3 text-right whitespace-nowrap">{cost != null && cost > 0 ? fmtBaht(cost) : <span className="text-mute">—</span>}</td>}
                <td className="px-3 py-3 text-xs whitespace-nowrap text-sub">{fmtShortDate(t.request_date)}</td>
                <td className="px-3 py-3 text-xs whitespace-nowrap text-sub">{t.required_date ? fmtShortDate(t.required_date) : <span className="text-mute">—</span>}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {survey
                    ? <button onClick={(e) => { e.stopPropagation(); onSurvey?.(t.ticket_no); }} className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', survey.score_total >= SURVEY_KPI_THRESHOLD ? 'tone-green' : 'tone-amber')} title="ดูผลประเมิน"><Star className="size-3" />{survey.score_total}</button>
                    : t.status === 'DONE' ? <span className="text-xs text-mute">รอประเมิน</span> : <span className="text-mute">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-2.5 text-xs text-mute">
        <span data-testid="row-count">{sorted.length} รายการ</span>
        {pages > 1 && <span className="flex items-center gap-2">
          <button disabled={pg <= 1} onClick={() => setPage(pg - 1)} className="rounded border border-line px-2 py-1 disabled:opacity-40">ก่อนหน้า</button>
          <span className="num">{pg}/{pages}</span>
          <button disabled={pg >= pages} onClick={() => setPage(pg + 1)} className="rounded border border-line px-2 py-1 disabled:opacity-40">ถัดไป</button>
        </span>}
      </div>
    </div>
  );
}
