'use client';
import { Suspense } from 'react';
import { PortalPage, type StatCard } from '@/components/portal/PortalPage';
import { PageLoading } from '@/components/ui/Spinner';

const STATUSES = ['ICO_WORK','ITL_WAIT','ITM_WAIT','ICO_FINAL','DONE','CANCELLED','REJECTED','OPEN','MGR_WAIT'];
const CARDS: StatCard[] = [
  { key: 'mgr', label: 'รอหัวหน้างานอนุมัติ', tone: 'text-[#3B82F6]', test: (t) => t.status === 'OPEN' || t.status === 'MGR_WAIT' },
  { key: 'todo', label: 'ต้องดำเนินการ', tone: 'text-[#7C3AED]', test: (t, d) => t.status === 'ICO_WORK' && !d.bounced },
  { key: 'bounce', label: 'ถูกตีกลับ', tone: 'text-err', test: (_t, d) => d.bounced },
  { key: 'itl', label: 'รอ ITL', tone: 'text-[#EA580C]', test: (t) => t.status === 'ITL_WAIT' },
  { key: 'itm', label: 'รอ IT MGR', tone: 'text-[#0891B2]', test: (t) => t.status === 'ITM_WAIT' },
  { key: 'final', label: 'รอปิดงาน', tone: 'text-[#0F766E]', test: (t) => t.status === 'ICO_FINAL' },
  { key: 'done', label: 'เสร็จสิ้น', tone: 'text-ok', test: (t) => t.status === 'DONE' },
];

export default function ICOPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PortalPage role="ICO" roles={['ICO','ITL','ITM']} title="งาน ICO" subtitle="บันทึกงาน ส่งต่อ ITL และปิดงาน" listStatuses={STATUSES} withOverview cards={CARDS} />
    </Suspense>
  );
}
