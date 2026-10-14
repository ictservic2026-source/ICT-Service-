import clsx from 'clsx';
import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const base = 'w-full rounded-xl border bg-surface-2 px-3.5 text-sm text-ink placeholder:text-mute transition focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60';
const ok = 'border-line-strong focus:border-brand';
const bad = 'border-err focus:border-err focus:ring-err/20';

export function Field({ label, required, hint, error, children, className, htmlFor }: {
  label?: React.ReactNode; required?: boolean; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string; htmlFor?: string;
}) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">{label}{required && <span className="ml-0.5 text-err" aria-hidden>*</span>}</label>}
      {children}
      {error ? <p role="alert" className="text-xs text-err">{error}</p> : hint ? <p className="text-xs text-mute">{hint}</p> : null}
    </div>
  );
}

type InProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export const Input = forwardRef<HTMLInputElement, InProps>(function Input({ invalid, className, ...p }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={clsx(base, 'h-11', invalid ? bad : ok, className)} {...p} />;
});

type TaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };
export const Textarea = forwardRef<HTMLTextAreaElement, TaProps>(function Textarea({ invalid, className, rows = 4, ...p }, ref) {
  return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={clsx(base, 'py-2.5 leading-relaxed', invalid ? bad : ok, className)} {...p} />;
});

type SelProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };
export const Select = forwardRef<HTMLSelectElement, SelProps>(function Select({ invalid, className, children, ...p }, ref) {
  return <select ref={ref} aria-invalid={invalid || undefined} className={clsx(base, 'h-11 pr-8', invalid ? bad : ok, className)} {...p}>{children}</select>;
});

export function Checkbox({ label, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
      <input id={id} type="checkbox" className="mt-0.5 size-4 rounded border-line-strong accent-[var(--brand)]" {...p} />
      <span>{label}</span>
    </label>
  );
}
