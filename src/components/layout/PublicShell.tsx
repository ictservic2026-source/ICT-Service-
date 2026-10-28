import Link from 'next/link';
import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { DemoBanner } from './DemoBanner';

/**
 * โครงหน้าสาธารณะ (ผู้แจ้ง / หัวหน้างาน / ผู้ประเมิน — ไม่ต้องล็อกอิน)
 * fit = พอดีหนึ่งจอ ไม่ต้องเลื่อน (เฉพาะจอคอมที่สูงพอ ≥ 1024×740; มือถือ/จอเตี้ยยังเลื่อนได้ตามปกติ)
 */
export function PublicShell({ children, right, wide, fit }: { children: React.ReactNode; right?: React.ReactNode; wide?: boolean; fit?: boolean }) {
  return (
    <div className={fit ? 'flex min-h-screen flex-col [@media(min-width:1024px)_and_(min-height:740px)]:h-dvh [@media(min-width:1024px)_and_(min-height:740px)]:min-h-0 [@media(min-width:1024px)_and_(min-height:740px)]:overflow-hidden' : 'flex min-h-screen flex-col'}>
      <DemoBanner />
      <header className="border-b border-line bg-surface">
        <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-3.5 sm:px-8 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
          <Brand />
          <div className="flex items-center gap-2">
            {right}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className={fit ? 'flex flex-1 flex-col [@media(min-width:1024px)_and_(min-height:740px)]:min-h-0 [@media(min-width:1024px)_and_(min-height:740px)]:overflow-y-auto' : 'flex-1'}>{children}</main>
      <footer className={`border-t border-line text-center text-xs text-mute ${fit ? 'py-3' : 'py-5'}`}>
        © NISSEI TRADING (THAILAND) CO., LTD. · ICT Department ·{' '}
        <Link href="/login" className="hover:text-brand">เข้าสู่ระบบเจ้าหน้าที่</Link>
      </footer>
    </div>
  );
}
