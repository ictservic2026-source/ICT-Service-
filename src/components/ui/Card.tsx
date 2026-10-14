import clsx from 'clsx';

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('rounded-2xl border border-line bg-surface shadow-card', className)} {...p}>{children}</div>;
}
export function CardHeader({ title, subtitle, action, icon }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-5 py-3.5">
      {icon && <div className="mt-0.5 text-brand">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-sub">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Section({ title, children, className }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('mb-5', className)}>
      <h4 className="mb-2 text-xs font-semibold tracking-wide text-sub uppercase">{title}</h4>
      {children}
    </section>
  );
}
export function KV({ k, v, className }: { k: React.ReactNode; v: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 border-b border-line/70 py-2 text-sm last:border-0', className)}>
      <span className="shrink-0 text-sub">{k}</span>
      <span className="min-w-0 text-right font-medium break-words text-ink">{v == null || v === '' ? '—' : v}</span>
    </div>
  );
}
