import Link from 'next/link';
import { Monitor } from 'lucide-react';

export function Brand({ href = '/', compact, light }: { href?: string; compact?: boolean; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3" aria-label="ICT Service Desk หน้าแรก">
      <span className="flex size-10 items-center justify-center rounded-lg bg-brand text-on-brand"><Monitor className="size-5" aria-hidden /></span>
      {!compact && (
        <span className="leading-tight">
          <span className={`block text-[15px] font-semibold ${light ? 'text-white' : 'text-ink'}`}>ICT Service Desk</span>
          <span className={`block text-xs ${light ? 'text-slate-400' : 'text-sub'}`}>NISSEI TRADING (THAILAND)</span>
        </span>
      )}
    </Link>
  );
}
