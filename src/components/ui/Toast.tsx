import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import clsx from 'clsx';

export interface ToastItem { id: number; kind: 'success' | 'error' | 'info'; text: string }

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info };
const COLOR = { success: 'text-ok', error: 'text-err', info: 'text-brand' };

export function ToastViewport({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: number) => void }) {
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className="anim-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-modal">
            <Icon className={clsx('mt-0.5 size-5 shrink-0', COLOR[t.kind])} aria-hidden />
            <p className="flex-1 text-sm leading-snug text-ink">{t.text}</p>
            <button onClick={() => onClose(t.id)} className="text-mute hover:text-ink" aria-label="ปิดข้อความ"><X className="size-4" /></button>
          </div>
        );
      })}
    </div>
  );
}
