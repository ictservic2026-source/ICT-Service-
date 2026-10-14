'use client';
import { Suspense } from 'react';
import { PortalPage, type StatCard } from '@/components/portal/PortalPage';
import { PageLoading } from '@/components/ui/Spinner';

const STATUSES = ['ITL_WAIT','ITM_WAIT','DONE','ICO_WORK','ICO_FINAL','CANCELLED'];
const CARDS: StatCard[] = [
  { key: 'pending', label: 'รอตรวจสอบ', tone: 'text-[#EA580C]', test: (t) => t.status === 'ITL_WAIT' },
  { key: 'itm', label: 'ส่ง IT MGR แล้ว', tone: 'text-[#0891B2]', test: (t) => t.status === 'ITM_WAIT' },
  { key: 'back', label: 'ตีกลับ ICO', tone: 'text-err', test: (t) => t.itl_status === 'BACK_TO_ICO' && t.status === 'ICO_WORK' },
  { key: 'final', label: 'รอปิดงาน', tone: 'text-[#0F766E]', test: (t) => t.status === 'ICO_FINAL' },
  { key: 'done', label: 'เสร็จสิ้น', tone: 'text-ok', test: (t) => t.status === 'DONE' },
];

export default function ITLPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PortalPage role="ITL" roles={['ITL','ITM']} title="ITL — ตรวจสอบงาน" subtitle="ตรวจสอบงานที่ ICO ส่งต่อ อนุมัติหรือตีกลับ" listStatuses={STATUSES} cards={CARDS} />
    </Suspense>
  );
}
