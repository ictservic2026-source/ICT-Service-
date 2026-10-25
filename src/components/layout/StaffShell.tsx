'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { BarChart3, BookOpen, FileSpreadsheet, FlaskConical, LogOut, Menu, ShieldCheck, UserCog, Wrench, X } from 'lucide-react';
import type { Role } from '@/types';
import { ROLE_LABEL, ROLE_PORTAL } from '@/lib/constants';
import { useServices, useSession } from '@/hooks';
import { Avatar } from '@/components/ui/Avatar';
import { PageLoading } from '@/components/ui/Spinner';
import { Brand } from './Brand';
import { DemoBanner } from './DemoBanner';
import { NotifyBell } from './NotifyBell';
import { ThemeToggle } from './ThemeToggle';

interface NavItem { href: string; label: string; icon: React.ReactNode; roles: Role[]; mockOnly?: boolean }
const NAV: NavItem[] = [
  { href: '/ico', label: 'งาน ICO', icon: <Wrench />, roles: ['ICO', 'ITL', 'ITM'] },
  { href: '/itl', label: 'งาน ITL (ตรวจสอบ)', icon: <ShieldCheck />, roles: ['ITL', 'ITM'] },
  { href: '/itm', label: 'IT Manager (อนุมัติ)', icon: <UserCog />, roles: ['ITM'] },
  { href: '/dashboard', label: 'Dashboard', icon: <BarChart3 />, roles: ['ICO', 'ITL', 'ITM'] },
  { href: '/logbook', label: 'สมุดงาน', icon: <BookOpen />, roles: ['ICO', 'ITL', 'ITM'] },
  { href: '/reports', label: 'รายงาน / Export', icon: <FileSpreadsheet />, roles: ['ICO', 'ITL', 'ITM'] },
  { href: '/demo', label: 'ศูนย์ทดสอบ (Demo)', icon: <FlaskConical />, roles: ['ICO', 'ITL', 'ITM'], mockOnly: true },
];

/** โครงหน้าเจ้าหน้าที่ + Route guard (บทบาทเดียวกับ data-roles ของ protected-page.js เดิม) */
export function StaffShell({ roles, title, subtitle, actions, children, wide }: {
  roles: Role[]; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean;
}) {
  const { user, signOut } = useSession();
  const svc = useServices();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (!roles.includes(user.role)) router.replace(ROLE_PORTAL[user.role]);
  }, [user, roles, router, path]);
  useEffect(() => { setMenu(false); }, [path]);

  if (!user || !roles.includes(user.role)) {
    return <div className="min-h-screen"><PageLoading label={user === undefined ? 'กำลังตรวจสอบสิทธิ์…' : 'กำลังนำทาง…'} /></div>;
  }
  const items = NAV.filter((n) => n.roles.includes(user.role) && (!n.mockOnly || svc?.source === 'mock'));

  const sidebar = (
    <nav aria-label="เมนูหลัก" className="flex h-full flex-col">
      <div className="px-4 py-4"><Brand href={ROLE_PORTAL[user.role]} /></div>
      <ul className="flex-1 space-y-1 px-3 py-2">
        {items.map((n) => {
          const on = path === n.href || path.startsWith(n.href + '/');
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={on ? 'page' : undefined}
                className={clsx('flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition [&>svg]:size-[18px]',
                  on ? 'rounded-r-lg bg-brand-pale text-brand-d shadow-[inset_3px_0_0_var(--brand)]' : 'rounded-lg text-sub hover:bg-surface-3 hover:text-ink')}>
                {n.icon}{n.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="m-3 border-t border-line pt-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={user.display_name} className="bg-brand-pale text-brand-d" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink" data-testid="me-name">{user.display_name}</p><p className="truncate text-xs text-mute" data-testid="me-role">{ROLE_LABEL[user.role]}</p></div>
        </div>
        <button onClick={async () => { await signOut(); router.replace('/login'); }} data-testid="logout"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface py-2 text-sm text-sub transition hover:bg-surface-3 hover:text-ink"><LogOut className="size-4" />ออกจากระบบ</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-side lg:block">{sidebar}</aside>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenu(false)} />
          <aside className="anim-slide absolute inset-y-0 left-0 w-72 border-r border-line bg-side">
            <button onClick={() => setMenu(false)} aria-label="ปิดเมนู" className="absolute top-4 right-3 rounded-lg p-1.5 text-sub"><X className="size-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur sm:px-6">
          <button onClick={() => setMenu(true)} aria-label="เปิดเมนู" className="rounded-lg p-2 text-sub hover:bg-surface-3 lg:hidden"><Menu className="size-5" /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-ink">{title}</h1>
            {subtitle && <p className="truncate text-xs text-sub">{subtitle}</p>}
          </div>
          {actions}
          <NotifyBell />
          <ThemeToggle />
        </header>
        <main className={clsx('mx-auto w-full flex-1 px-4 py-5 sm:px-6', wide ? 'max-w-[1500px]' : 'max-w-7xl')}>{children}</main>
      </div>
    </div>
  );
}
