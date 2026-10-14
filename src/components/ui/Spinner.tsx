import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={clsx('inline-flex items-center gap-2 text-sub', className)}>
      <Loader2 className="anim-spin size-5 text-brand" aria-hidden />
      {label && <span className="text-sm">{label}</span>}
      <span className="sr-only">กำลังโหลด</span>
    </span>
  );
}

export function PageLoading({ label = 'กำลังโหลดข้อมูล…' }: { label?: string }) {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner label={label} /></div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('relative overflow-hidden rounded-lg bg-surface-3', className)}>
    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent" style={{ animation: 'ict-shimmer 1.4s infinite' }} />
  </div>;
}
