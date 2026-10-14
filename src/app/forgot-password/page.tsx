'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { AuthShell } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useServices } from '@/hooks';

export default function ForgotPasswordPage() {
  const svc = useServices();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!svc || !email.trim()) return;
    setBusy(true); setMsg(null);
    try {
      await svc.auth.requestPasswordReset(email.trim(), `${window.location.origin}/reset-password`);
      setMsg({ ok: true, text: 'ส่งลิงก์เปลี่ยนรหัสผ่านไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย' });
      setEmail('');
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'ไม่สามารถส่งลิงก์เปลี่ยนรหัสผ่านได้' });
    } finally { setBusy(false); }
  }

  return (
    <AuthShell title="ลืมรหัสผ่าน" subtitle="กรอกอีเมลที่ใช้เข้าสู่ระบบ แล้วเราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้"
      footer={<Link href="/login" className="hover:text-white">← กลับหน้าเข้าสู่ระบบ</Link>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="อีเมล" htmlFor="email"><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@nissei.co.th" required /></Field>
        {msg && <p role="status" data-testid="forgot-msg" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-[var(--ok-bg)] text-[var(--ok-fg)]' : 'bg-[var(--err-bg)] text-[var(--err-fg)]'}`}>{msg.text}</p>}
        <Button type="submit" block size="lg" loading={busy}><MailCheck className="size-5" />ส่งลิงก์เปลี่ยนรหัสผ่าน</Button>
      </form>
      {svc?.source === 'mock' && msg?.ok && (
        <p className="mt-4 rounded-lg bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn-fg)]">โหมดทดลอง: ไม่มีการส่งอีเมลจริง — <Link href="/reset-password" className="font-semibold underline" data-testid="mock-reset-link">เปิดลิงก์รีเซ็ตจำลอง</Link></p>
      )}
    </AuthShell>
  );
}
