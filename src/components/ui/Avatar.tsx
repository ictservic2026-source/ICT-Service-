import clsx from 'clsx';
import { initials } from '@/lib/utils/format';

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  return <span aria-hidden className={clsx('inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-pale text-xs font-semibold text-brand-d', className)}>{initials(name)}</span>;
}
