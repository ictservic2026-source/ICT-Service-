'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useServices } from '@/hooks';

const NO_RE = /^ICT-\d{4}-\d{1,6}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * ผู้แจ้งค้นงานของตัวเองด้วยเลขที่งาน + อีเมลที่ใช้ตอนแจ้ง → ไปหน้า /track/<token>
 * ต้องมีอีเมลด้วยเพราะเลขที่งานเรียงต่อกันและเดาได้ (RPC find_track_token, migration 002)
 */
export function TrackLookup() {
  const svc = useServices();
  const router = useRouter();
  const [no, setNo] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = no.trim().toUpperCase(), em = email.trim();
    if (!NO_RE.test(n)) { setMsg('รูปแบบเลขที่งานไม่ถูกต้อง เช่น ICT-2610-14'); return; }
    if (!EMAIL_RE.test(em)) { setMsg('กรุณากรอกอีเมลที่ใช้ตอนแจ้งปัญหา'); return; }
    if (!svc) return;
    setBusy(true); setMsg('');
    try {
      const token = await svc.actions.findTrack(n, em);
      if (token) { router.push(`/track/${token}`); return; }
      setMsg('ไม่พบงานที่ตรงกับเลขที่งานและอีเมลนี้ กรุณาตรวจสอบอีกครั้ง');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'ค้นหาไม่สำเร็จ กรุณาลองใหม่');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="mt-1 flex flex-col gap-3" data-testid="track-lookup">
      <Field label="เลขที่งาน" htmlFor="tl-no">
        <Input id="tl-no" value={no} onChange={(e) => { setNo(e.target.value); setMsg(''); }} placeholder="ICT-2610-14" autoComplete="off" className="num uppercase" />
      </Field>
      <Field label="อีเมลที่ใช้ตอนแจ้ง" htmlFor="tl-email">
        <Input id="tl-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setMsg(''); }} placeholder="name@nissei.co.th" autoComplete="email" />
      </Field>
      {msg && <p role="alert" data-testid="track-lookup-error" className="rounded-lg bg-[var(--err-bg)] px-3 py-2 text-sm text-[var(--err-fg)]">{msg}</p>}
      <Button type="submit" variant="secondary" loading={busy} disabled={!svc}><Search className="size-4" aria-hidden />ค้นหางานของฉัน</Button>
    </form>
  );
}
