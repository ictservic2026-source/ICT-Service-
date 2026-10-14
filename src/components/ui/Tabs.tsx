import clsx from 'clsx';

export interface TabItem<T extends string> { id: T; label: React.ReactNode; count?: number | null; tone?: 'red' | 'default' }

export function Tabs<T extends string>({ tabs, value, onChange, className, variant = 'underline' }: {
  tabs: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string; variant?: 'underline' | 'pills';
}) {
  return (
    <div role="tablist" className={clsx('flex gap-1 overflow-x-auto', variant === 'underline' ? 'border-b border-line' : 'rounded-xl bg-surface-3 p-1', className)}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 text-sm font-medium transition',
              variant === 'underline'
                ? clsx('-mb-px border-b-2', on ? 'border-brand text-brand-d' : 'border-transparent text-sub hover:text-ink')
                : clsx('rounded-lg', on ? 'bg-surface text-ink shadow-card' : 'text-sub hover:text-ink'))}>
            {t.label}
            {t.count != null && (
              <span className={clsx('num rounded-full px-1.5 text-[11px] leading-5', t.tone === 'red' && t.count > 0 ? 'bg-err text-white' : 'bg-surface-3 text-sub')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
