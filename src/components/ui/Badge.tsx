import clsx from 'clsx';
import { STATUS_META } from '@/lib/constants';
import type { TicketStatus } from '@/types';

export type Tone = 'blue' | 'amber' | 'purple' | 'orange' | 'cyan' | 'teal' | 'green' | 'red' | 'slate' | 'brand';

export function Badge({ tone = 'slate', children, className, title }: { tone?: Tone; children: React.ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', `tone-${tone}`, className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, bounced, short }: { status: TicketStatus | string; bounced?: boolean; short?: boolean }) {
  if (bounced) return <Badge tone="red">↩ ถูกตีกลับ</Badge>;
  const m = STATUS_META[status as TicketStatus];
  if (!m) return <Badge>{status}</Badge>;
  return <Badge tone={m.tone}>{short ? m.short : m.label}</Badge>;
}

export function UrgentBadge() { return <Badge tone="red">ด่วน</Badge>; }
