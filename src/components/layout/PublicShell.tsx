import Link from 'next/link';
import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { DemoBanner } from './DemoBanner';

/** โครงหน้าสาธารณะ (ผู้แจ้ง / หัวหน้างาน / ผู้ประเมิน — ไม่ต้องล็อกอิน) */
export function PublicShell({ children, right, wide }: { children: React.ReactNode; right?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
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
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line py-5 text-center text-xs text-mute">
        © NISSEI TRADING (THAILAND) CO., LTD. · ICT Department ·{' '}
        <Link href="/login" className="hover:text-brand">เข้าสู่ระบบเจ้าหน้าที่</Link>
      </footer>
    </div>
  );
}
