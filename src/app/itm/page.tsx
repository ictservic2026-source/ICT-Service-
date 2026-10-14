'use client';
import { Suspense } from 'react';
import { PortalPage, type StatCard } from '@/components/portal/PortalPage';
import { PageLoading } from '@/components/ui/Spinner';

const STATUSES = ['ITM_WAIT','ICO_FINAL','DONE','CANCELLED'];
const CARDS: StatCard[] = [
  { key: 'pending', label: 'รออนุมัติ', tone: 'text-[#0891B2]', test: (t) => t.status === 'ITM_WAIT' },
  { key: 'final', label: 'รอ ICO ปิดงาน', tone: 'text-[#0F766E]', test: (t) => t.status === 'ICO_FINAL' },
  { key: 'bounce', label: 'ตีกลับ ICO', tone: 'text-err', test: (_t, d) => d.bounced },
  { key: 'done', label: 'เสร็จสิ้น', tone: 'text-ok', test: (t) => t.status === 'DONE' },
  { key: 'cancel', label: 'ยกเลิก', tone: 'text-sub', test: (t) => t.status === 'CANCELLED' },
];

export default function ITMPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PortalPage role="ITM" roles={['ITM']} title="IT Manager — อนุมัติ" subtitle="พิจารณาอนุมัติ ยกเลิก หรือตีกลับ" listStatuses={STATUSES} includeBounced showCost cards={CARDS} />
    </Suspense>
  );
}
