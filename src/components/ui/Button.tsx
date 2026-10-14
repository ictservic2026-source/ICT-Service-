import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warn' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const V: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-d shadow-card',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
  ghost: 'text-sub hover:bg-surface-3 hover:text-ink',
  danger: 'bg-err text-white hover:brightness-95',
  success: 'bg-ok text-white hover:brightness-95',
  warn: 'bg-warn text-white hover:brightness-95',
  dark: 'bg-navy text-white hover:bg-navy-2',
};
const S: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean; block?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, block, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium transition select-none whitespace-nowrap',
        'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]',
        V[variant], S[size], block && 'w-full', className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="anim-spin size-4" aria-hidden />}
      {children}
    </button>
  );
}
