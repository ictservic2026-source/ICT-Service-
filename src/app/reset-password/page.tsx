'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { AuthShell } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { validatePassword } from '@/lib/validation';
import { useServices } from '@/hooks';

export default function ResetPasswordPage() {
  const svc = useServices();
  const router = useRouter();
  const [valid, setValid] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!svc) return;
    // Supabase ต้องรอ detectSessionInUrl แลก token ในลิงก์ก่อน — ลองซ้ำสั้นๆ
    let tries = 0;
    const tick = async () => {
      const ok = await svc.auth.hasRecoverySession();
      if (ok || ++tries >= 5) setValid(ok); else setTimeout(tick, 400);
    };
    void tick();
  }, [svc]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!svc) return;
    const err = validatePassword(pw);
    if (err) return setMsg({ ok: false, text: 'กรุณาตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร' });
    if (pw !== pw2) return setMsg({ ok: false, text: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' });
    setBusy(true); setMsg(null);
    try {
      await svc.auth.updatePassword(pw);
      setMsg({ ok: true, text: 'เปลี่ยนรหัสผ่านสำเร็จ กำลังกลับหน้าเข้าสู่ระบบ...' });
      await svc.auth.signOut(); // ออกจาก session กู้รหัสผ่าน (เหมือนต้นฉบับ)
      setTimeout(() => router.replace('/login'), 1500);
    } catch (e2) {
      setMsg({ ok: false, text: e2 instanceof Error ? e2.message : 'ไม่สามารถเปลี่ยนรหัสผ่านได้' });
      setBusy(false);
    }
  }

  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่" subtitle="รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" footer={<Link href="/login" className="hover:text-white">← กลับหน้าเข้าสู่ระบบ</Link>}>
      {valid === false && <p role="alert" data-testid="reset-invalid" className="mb-4 rounded-lg bg-[var(--err-bg)] px-3 py-2 text-sm text-[var(--err-fg)]">ลิงก์เปลี่ยนรหัสผ่านไม่ถูกต้อง หมดอายุ หรือถูกใช้งานแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง</p>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="รหัสผ่านใหม่" htmlFor="newPassword"><Input id="newPassword" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} disabled={valid === false} /></Field>
        <Field label="ยืนยันรหัสผ่านใหม่" htmlFor="confirmPassword"><Input id="confirmPassword" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} disabled={valid === false} /></Field>
        {msg && <p role="status" data-testid="reset-msg" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-[var(--ok-bg)] text-[var(--ok-fg)]' : 'bg-[var(--err-bg)] text-[var(--err-fg)]'}`}>{msg.text}</p>}
        <Button type="submit" block size="lg" loading={busy} disabled={valid !== true}><KeyRound className="size-5" />เปลี่ยนรหัสผ่าน</Button>
      </form>
    </AuthShell>
  );
}
