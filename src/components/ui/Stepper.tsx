import clsx from 'clsx';
import { Check } from 'lucide-react';
import { TICKET_STEPS } from '@/lib/constants';
import type { TicketStatus } from '@/types';

/** ตัวบอกความคืบหน้า (TK_STEPS ของ dashboard.js เดิม) — REJECTED/CANCELLED แสดงเป็นแถบแจ้งเตือน */
export function Stepper({ status, bounced }: { status: TicketStatus; bounced?: boolean }) {
  if (status === 'REJECTED' || status === 'CANCELLED') {
    return <div className="rounded-xl border border-err/30 bg-[var(--err-bg)] px-4 py-3 text-sm font-medium text-[var(--err-fg)]">
      {status === 'REJECTED' ? 'หัวหน้างานไม่อนุมัติคำขอนี้' : 'IT Manager ยกเลิกงานนี้'}
    </div>;
  }
  const cur = status === 'MGR_WAIT' ? 0 : TICKET_STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="flex items-start gap-1" aria-label="ความคืบหน้าของงาน">
      {TICKET_STEPS.map((s, i) => {
        const done = i < cur || status === 'DONE';
        const now = i === cur && status !== 'DONE';
        return (
          <li key={s.status} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <span className={clsx('h-0.5 flex-1', i === 0 ? 'bg-transparent' : done || now ? 'bg-brand' : 'bg-line')} />
              <span className={clsx('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                done ? 'bg-brand text-on-brand' : now ? (bounced ? 'bg-err text-white ring-4 ring-err/20' : 'bg-brand text-on-brand ring-4 ring-brand/20') : 'bg-surface-3 text-mute')}>
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={clsx('h-0.5 flex-1', i === TICKET_STEPS.length - 1 ? 'bg-transparent' : done ? 'bg-brand' : 'bg-line')} />
            </div>
            <span className={clsx('text-[11px] leading-tight', now ? 'font-semibold text-ink' : 'text-sub')}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
