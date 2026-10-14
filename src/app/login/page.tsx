'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { AuthShell } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { ROLE_LABEL, ROLE_PORTAL } from '@/lib/constants';
import { DEMO_PASSWORD } from '@/lib/mock/users';
import { useServices, useSession } from '@/hooks';

/** กัน open-redirect: อนุญาตเฉพาะ path ภายในเว็บ */
function safeNext(n: string | null) { return n && n.startsWith('/') && !n.startsWith('//') ? n : null; }

export default function LoginPage() {
  const svc = useServices();
  const { user, setUser } = useSession();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { if (user) router.replace(next || ROLE_PORTAL[user.role]); }, [user, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!svc) return;
    setMsg(''); setBusy(true);
    try {
      const u = await svc.auth.signIn(email.trim(), pw);
      setUser(u);
      router.replace(next || ROLE_PORTAL[u.role]);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบได้');
      setBusy(false);
    }
  }
  async function quick(em: string) {
    if (!svc) return;
    setBusy(true);
    try { const u = await svc.auth.signIn(em, DEMO_PASSWORD); setUser(u); router.replace(next || ROLE_PORTAL[u.role]); } catch (err) { setMsg(String(err)); setBusy(false); }
  }

  return (
    <AuthShell title="เข้าสู่ระบบเจ้าหน้าที่ IT" subtitle="สำหรับ ICO · ITL · IT Manager"
      footer={<Link href="/" className="hover:text-white">← กลับหน้าแรก</Link>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="อีเมล" htmlFor="email"><Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@nissei.co.th" required /></Field>
        <Field label="รหัสผ่าน" htmlFor="password">
          <div className="relative">
            <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required className="pr-11" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="absolute top-1/2 right-3 -translate-y-1/2 text-mute hover:text-ink">{show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>
          </div>
        </Field>
        {msg && <p role="alert" data-testid="login-error" className="rounded-lg bg-[var(--err-bg)] px-3 py-2 text-sm text-[var(--err-fg)]">{msg}</p>}
        <Button type="submit" block size="lg" loading={busy} disabled={!svc}><LogIn className="size-5" />เข้าสู่ระบบ</Button>
        <p className="text-center text-sm"><Link href="/forgot-password" className="text-brand-d hover:underline">ลืมรหัสผ่าน?</Link></p>
      </form>
      {svc?.source === 'mock' && (
        <div className="mt-6 border-t border-line pt-4" data-testid="quick-login">
          <p className="mb-2 text-xs font-medium text-sub">โหมดทดลอง — เข้าสู่ระบบด่วน (รหัสผ่าน {DEMO_PASSWORD})</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {svc.auth.demoAccounts?.().map((a) => (
              <button key={a.id} type="button" disabled={busy} onClick={() => quick(a.email)} data-testid={`quick-${a.email.split('@')[0]}`}
                className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-left text-sm transition hover:border-brand hover:bg-brand-pale disabled:opacity-50">
                <span className="block font-medium">{a.display_name}</span><span className="text-xs text-sub">{ROLE_LABEL[a.role]} · {a.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
