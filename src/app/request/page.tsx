'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Copy, Info, Mail, MapPin, Paperclip, Send, User } from 'lucide-react';
import { PublicShell } from '@/components/layout/PublicShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { FileInput } from '@/components/forms/FileInput';
import { DEPARTMENTS } from '@/lib/constants';
import { REQUEST_LABELS, validateRequest, type RequestField } from '@/lib/validation';
import { useServices, useToast } from '@/hooks';
import type { AutomationReceipt, NewTicketInput, Ticket } from '@/types';

const EMPTY: NewTicketInput = {
  requester_name: '', department: '', location: '', required_date: '', asset_id: '', issue_detail: '', requester_email: '', manager_email: '',
};
const STEP1: RequestField[] = ['requester_name', 'department', 'location', 'required_date'];
const stepOf = (k: string) => (STEP1.includes(k as RequestField) ? 1 : 2);
const today = () => new Date().toISOString().slice(0, 10);

export default function RequestPage() {
  const svc = useServices();
  const toast = useToast();
  const [f, setF] = useState<NewTicketInput>(EMPTY);
  const [errs, setErrs] = useState<Partial<Record<RequestField, string>>>({});
  const [imgs, setImgs] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<{ ticket: Ticket; receipt: AutomationReceipt | null } | null>(null);

  const set = <K extends keyof NewTicketInput>(k: K, v: NewTicketInput[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errs[k as RequestField]) setErrs((e) => ({ ...e, [k]: undefined }));
  };
  const required = Object.keys(REQUEST_LABELS) as (keyof typeof REQUEST_LABELS)[];
  const progress = useMemo(() => Math.round((required.filter((k) => String(f[k] ?? '').trim()).length / required.length) * 100), [f, required]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!svc) return;
    const v = validateRequest(f);
    setErrs(v);
    const first = Object.keys(v)[0];
    if (first) {
      if (stepOf(first) === 1) setStep(1);
      toast.error(v[first as RequestField]!);
      setTimeout(() => document.getElementById(first)?.focus(), 0);
      return;
    }
    try {
      setBusy(imgs.length || docs.length ? 'กำลังอัปโหลดไฟล์…' : 'กำลังบันทึกข้อมูล…');
      const r = await svc.actions.submitRequest(f, { images: imgs, docs });
      setDone({ ticket: r.ticket, receipt: r.receipt });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setBusy(null);
    }
  }

  if (done) return <Success done={done} onNew={() => { setDone(null); setF(EMPTY); setImgs([]); setDocs([]); setStep(1); }} mock={svc?.source === 'mock'} manual={svc?.source !== 'mock' && svc?.automation.mode === 'mock'} />;


  function goNext() {
    const v = validateRequest(f);
    const mine = Object.fromEntries(Object.entries(v).filter(([k]) => stepOf(k) === 1)) as Partial<Record<RequestField, string>>;
    setErrs(mine);
    const first = STEP1.find((k) => mine[k]);
    if (first) { toast.error(mine[first]!); document.getElementById(first)?.focus(); return; }
    setStep(2);
    window.scrollTo({ top: 0 });
  }

  return (
    <PublicShell>
      <div className="fixed top-0 left-0 z-50 h-[3px] bg-gradient-to-r from-brand to-sky-300 transition-all" style={{ width: `${progress}%` }} role="progressbar" aria-valuenow={progress} aria-label="ความคืบหน้าการกรอกฟอร์ม" />
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">แจ้งปัญหาการใช้งาน IT</h1>
            <p className="mt-0.5 text-[13px] text-sub">กรอก 2 ขั้นตอน ทีม ICT จะติดต่อกลับภายใน 1 วันทำการ</p>
          </div>
          <ol className="flex gap-2 text-xs" data-testid="req-steps" data-step={step}>
            {[['1', 'ผู้แจ้งและสถานที่'], ['2', 'รายละเอียดและอีเมล']].map(([n, label]) => (
              <li key={n} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${Number(n) === step ? 'border-brand bg-brand-pale font-semibold text-brand-d' : Number(n) < step ? 'border-line text-ink' : 'border-line text-mute'}`}>
                <span className={`num flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${Number(n) === step ? 'bg-brand text-on-brand' : Number(n) < step ? 'bg-ok text-white' : 'bg-surface-3 text-mute'}`}>{Number(n) < step ? '✓' : n}</span>{label}
              </li>
            ))}
          </ol>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (step === 1) goNext(); else void submit(e); }} noValidate>
          <Card>
            {step === 1 ? (
              <div className="grid gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-2 sm:px-6" data-testid="req-step-1">
                <Sub icon={<User />} title="ข้อมูลผู้แจ้ง" />
                <Field label="ชื่อ-นามสกุล" required error={errs.requester_name} htmlFor="requester_name">
                  <Input id="requester_name" value={f.requester_name} onChange={(e) => set('requester_name', e.target.value)} placeholder="เช่น สมชาย ใจดี" invalid={!!errs.requester_name} maxLength={120} autoComplete="name" />
                </Field>
                <Field label="ฝ่าย / แผนก" required error={errs.department} htmlFor="department">
                  <Select id="department" value={f.department} onChange={(e) => set('department', e.target.value)} invalid={!!errs.department}>
                    <option value="">— เลือกฝ่าย/แผนก —</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </Field>
                <Sub icon={<MapPin />} title="สถานที่และกำหนดเวลา" />
                <Field label="สถานที่ดำเนินการ" required error={errs.location} htmlFor="location">
                  <Input id="location" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="เช่น อาคาร A ชั้น 2 ห้อง HR" invalid={!!errs.location} maxLength={160} />
                </Field>
                <Field label="วันที่ต้องการ" required error={errs.required_date} htmlFor="required_date">
                  <Input id="required_date" type="date" min={today()} value={f.required_date} onChange={(e) => set('required_date', e.target.value)} invalid={!!errs.required_date} />
                </Field>
              </div>
            ) : (
              <div className="grid gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-2 sm:px-6" data-testid="req-step-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs sm:col-span-2" data-testid="req-summary">
                  <span className="min-w-0 text-sub"><b className="text-ink">{f.requester_name}</b> · {f.department} · {f.location} · ต้องการ {f.required_date}</span>
                  <button type="button" onClick={() => setStep(1)} className="font-medium text-brand-d underline" data-testid="req-edit">แก้ไข</button>
                </div>
                <div className="sm:col-span-2">
                  <Field label="อาการปัญหา / ความต้องการ" required error={errs.issue_detail} htmlFor="issue_detail">
                    <div className="relative">
                      <Textarea id="issue_detail" value={f.issue_detail} maxLength={500} rows={3} onChange={(e) => set('issue_detail', e.target.value)} invalid={!!errs.issue_detail}
                        placeholder="เช่น: เครื่องคอมพิวเตอร์เปิดไม่ติด มีเสียงดังผิดปกติ" />
                      <span className="num absolute right-3 bottom-2 text-xs text-mute">{f.issue_detail.length}/500</span>
                    </div>
                  </Field>
                </div>
                <Field label={<>รหัสทรัพย์สิน <span className="text-xs font-normal text-mute">ไม่บังคับ</span></>} htmlFor="asset_id" error={errs.asset_id}>
                  <Input id="asset_id" value={f.asset_id ?? ''} onChange={(e) => set('asset_id', e.target.value)} placeholder="เช่น CP-HR (ดูจากสติ๊กเกอร์)" maxLength={60} />
                </Field>
                <div>
                  <p className="mb-1.5 text-[13px] font-medium">ไฟล์แนบ <span className="text-xs font-normal text-mute">ไม่บังคับ</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    <FileInput compact files={imgs} onChange={setImgs} imageOnly label="รูปภาพ" testId="file-images" />
                    <FileInput compact files={docs} onChange={setDocs} label="เอกสาร" testId="file-docs" />
                  </div>
                </div>
                <Field label="อีเมลของท่าน" required error={errs.requester_email} htmlFor="requester_email">
                  <Input id="requester_email" type="email" inputMode="email" value={f.requester_email} onChange={(e) => set('requester_email', e.target.value)} placeholder="your@nissei.co.th" invalid={!!errs.requester_email} autoComplete="email" />
                </Field>
                <Field label="อีเมลหัวหน้างาน (สำหรับอนุมัติ)" required error={errs.manager_email} htmlFor="manager_email">
                  <Input id="manager_email" type="email" inputMode="email" value={f.manager_email} onChange={(e) => set('manager_email', e.target.value)} placeholder="approver@nissei.co.th" invalid={!!errs.manager_email} />
                </Field>
                <p className="flex items-center gap-2 text-xs text-sub sm:col-span-2"><Info className="size-3.5 shrink-0 text-brand" aria-hidden />หัวหน้างานจะได้รับลิงก์เพื่ออนุมัติคำขอ โดยไม่ต้องเข้าสู่ระบบ</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
              {step === 2 ? <Button type="button" variant="secondary" onClick={() => setStep(1)} data-testid="btn-back">← ย้อนกลับ</Button> : <span />}
              {step === 1
                ? <Button type="submit" data-testid="btn-next">ถัดไป: รายละเอียดและอีเมล →</Button>
                : <Button type="submit" loading={!!busy} disabled={!svc} data-testid="submit-request"><Send className="size-4" />{busy ?? 'ส่งคำขอรับบริการ'}</Button>}
            </div>
          </Card>
        </form>
      </div>
    </PublicShell>
  );
}

function Sub({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-ink sm:col-span-2 [&>svg]:size-4 [&>svg]:text-brand">{icon}{title}</h2>
  );
}

function Success({ done, onNew, mock, manual }: { done: { ticket: Ticket; receipt: AutomationReceipt | null }; onNew: () => void; mock: boolean; manual: boolean }) {
  const toast = useToast();
  const { ticket, receipt } = done;
  const approve = receipt?.messages.find((m) => m.kind === 'APPROVAL_EMAIL')?.links?.[0]?.href;
  return (
    <PublicShell>
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-14 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-[var(--ok-bg)] text-ok"><CheckCircle2 className="size-10" /></span>
        <h1 className="mt-5 text-2xl font-semibold">ส่งคำขอเรียบร้อยแล้ว!</h1>
        <p className="mt-2 text-sub">ทีม ICT ได้รับคำขอของท่านแล้ว<br />จะดำเนินการติดต่อกลับตามวันที่ระบุ</p>
        <div data-testid="success-ticket-no" className="num mt-6 rounded-2xl border border-brand-line bg-brand-pale px-8 py-3 text-2xl font-bold tracking-wide text-brand-d">{ticket.ticket_no}</div>
        <button onClick={() => navigator.clipboard?.writeText(ticket.ticket_no).then(() => toast.success('คัดลอกแล้ว: ' + ticket.ticket_no))} className="mt-3 inline-flex items-center gap-1.5 text-sm text-sub hover:text-brand"><Copy className="size-4" />คัดลอกหมายเลขตั๋ว</button>
        {manual && approve && (
          <div className="mt-6 w-full rounded-xl border border-[var(--warn)]/40 bg-[var(--warn-bg)] p-4 text-left text-sm text-[var(--warn-fg)]" data-testid="manual-approve">
            <p className="font-semibold">ระบบยังไม่ส่งอีเมลอัตโนมัติ</p>
            <p className="mt-1 text-xs">กรุณาคัดลอกลิงก์ด้านล่างส่งให้หัวหน้างานเพื่อขออนุมัติ (หัวหน้างานไม่ต้องเข้าสู่ระบบ)</p>
            <div className="mt-2 flex items-center gap-2"><input readOnly value={approve} aria-label="ลิงก์อนุมัติสำหรับหัวหน้างาน" onFocus={(e) => e.currentTarget.select()} className="num min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink" />
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(approve).then(() => toast.success('คัดลอกลิงก์แล้ว')).catch(() => toast.info(approve))}><Copy className="size-3.5" />คัดลอก</Button></div>
          </div>
        )}
        {receipt && !manual && (
          <div className="mt-6 w-full rounded-xl border border-line bg-surface p-4 text-left text-sm">
            <p className="mb-2 font-medium">สถานะระบบแจ้งเตือน</p>
            <ul className="space-y-1 text-sub">
              {receipt.messages.map((m, i) => <li key={i} className="flex items-center gap-2"><Mail className="size-3.5 text-brand" aria-hidden /><span className="truncate">{m.subject}</span><span className="ml-auto text-xs text-ok">{m.statusLabel}</span></li>)}
            </ul>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          {ticket.track_token && <Link href={`/track/${ticket.track_token}`}><Button variant="secondary">ติดตามสถานะงาน</Button></Link>}
          {mock && approve && <Link href={approve.replace(/^https?:\/\/[^/]+/, '')}><Button variant="secondary" data-testid="open-approve">จำลอง: เปิดลิงก์ของหัวหน้างาน</Button></Link>}
          <Button onClick={onNew}>แจ้งปัญหาใหม่</Button>
        </div>
      </div>
    </PublicShell>
  );
}
