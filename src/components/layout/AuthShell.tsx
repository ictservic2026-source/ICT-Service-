import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { DemoBanner } from './DemoBanner';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-navy to-navy-2">
      <DemoBanner />
      <div className="flex justify-end p-3"><ThemeToggle className="text-slate-300 hover:bg-white/10 hover:text-white" /></div>
      <div className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center"><Brand light /></div>
          <div className="rounded-2xl border border-line bg-surface p-7 shadow-modal">
            <h1 className="text-xl font-semibold">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-sub">{subtitle}</p>}
            <div className="mt-5">{children}</div>
          </div>
          {footer && <div className="mt-4 text-center text-sm text-slate-400">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
