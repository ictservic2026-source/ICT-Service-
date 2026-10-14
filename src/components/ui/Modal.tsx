'use client';
import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

function useOverlay(open: boolean, onClose: () => void, ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('[data-autofocus],input,textarea,select,button:not([data-close])');
      (el ?? ref.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open, onClose, ref]);
}

const W = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer, headerExtra, z = 60 }: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; size?: keyof typeof W;
  children: React.ReactNode; footer?: React.ReactNode; headerExtra?: React.ReactNode; z?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="anim-fade fixed inset-0 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" style={{ zIndex: z }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}
        className={clsx('anim-pop flex max-h-[94vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-modal sm:max-h-[90vh] sm:rounded-2xl', W[size])}>
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-sub">{subtitle}</div>}
          </div>
          {headerExtra}
          <button data-close onClick={onClose} aria-label="ปิด" className="rounded-lg p-1.5 text-sub hover:bg-surface-3 hover:text-ink"><X className="size-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3 sm:rounded-b-2xl">{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, width = 'max-w-xl', z = 70 }: {
  open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; width?: string; z?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="anim-fade fixed inset-0 flex justify-end bg-slate-950/50" style={{ zIndex: z }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside ref={ref} role="dialog" aria-modal="true" tabIndex={-1} className={clsx('anim-slide flex h-full w-full flex-col border-l border-line bg-surface shadow-modal', width)}>
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-sub">{subtitle}</div>}
          </div>
          <button data-close onClick={onClose} aria-label="ปิด" className="rounded-lg p-1.5 text-sub hover:bg-surface-3"><X className="size-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
