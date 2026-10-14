'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Check, CheckCircle2, MapPin, ShieldAlert, X, XCircle } from 'lucide-react';
import { PublicShell } from '@/components/layout/PublicShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Field';
import { PageLoading } from '@/components/ui/Spinner';
import { SignaturePad, type SignatureHandle, type SignatureState } from '@/components/ui/SignaturePad';
import { Attachments } from '@/components/tickets/Attachments';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { isWellFormedToken } from '@/lib/utils/token';
import { fmtDate } from '@/lib/utils/format';
import { useServices, useToast } from '@/hooks';
import type { Ticket } from '@/types';

type Phase = 'loading' | 'invalid' | 'form' | 'done';

export default function ApprovePage() {
  const { token } = useParams<{ token: string }>();
  const svc = useServices();
  const toast = useToast();
  const [t, setT] = useState<Ticket | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [comment, setComment] = useState('');
  const [sig, setSig] = useState<SignatureState>({ mode: 'type', text: '', hasDrawing: false });
  const [busy, setBusy] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const pad = useRef<SignatureHandle>(null);
  const onSig = useCallback((s: SignatureState) => setSig(s), []);

  useEffect(() => {
    if (!svc) return;
    if (!isWellFormedToken(token)) { setPhase('invalid'); return; }
    svc.actions.getPublic('approve', token).then((view) => {
      const x = view?.ticket;
      if (!x) { setPhase('invalid'); return; }
      setT(x);
      if (x.mgr_status === 'APPROVED' || x.mgr_status === 'REJECTED') { setDecision(x.mgr_status); setPhase('done'); }
      else setPhase('form');
    }).catch(() => setPhase('invalid'));
  }, [svc, token]);

  async function act(action: 'APPROVED' | 'REJECTED') {
    if (!svc || !t) return;
    const c = comment.trim();
    if (action === 'REJECTED' && !c) { toast.error('กรุณาระบุเหตุผลที่ไม่อนุมัติ'); document.getElementById('mgr_comment')?.focus(); return; }
    if (sig.mode === 'type' && !sig.text.trim()) { toast.error('กรุณาพิมพ์ชื่อก่อนยืนยัน'); return; }
    if (sig.mode === 'draw' && !sig.hasDrawing) { toast.error('กรุณาวาดลายเซ็นก่อนยืนยัน'); return; }
    setBusy(action);
    try {
      const blob = sig.mode === 'draw' ? await pad.current?.toBlob() : null;
      const r = await svc.actions.managerDecide(token, { action, comment: c || undefined, name: sig.mode === 'type' ? sig.text.trim() : undefined, signature: blob });
      setT(r.ticket); setDecision(action); setPhase('done');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally { setBusy(null); }
  }

  const pill = decision === 'APPROVED' ? <Badge tone="green"><Check className="size-3" />อนุมัติแล้ว</Badge> : decision === 'REJECTED' ? <Badge tone="red"><X className="size-3" />ไม่อนุมัติ</Badge> : <Badge tone="amber">รอการอนุมัติ</Badge>;

  return (
    <PublicShell right={t ? <span className="num hidden rounded-full border border-brand-line bg-brand-pale px-3.5 py-1 text-sm font-semibold text-brand-d sm:inline">{t.ticket_no}</span> : null}>
      {phase === 'loading' && <PageLoading />}
      {phase === 'invalid' && (
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center" data-testid="approve-invalid">
          <span className="flex size-16 items-center justify-center rounded-full bg-[var(--err-bg)] text-err"><ShieldAlert className="size-8" /></span>
          <h1 className="mt-4 text-xl font-semibold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</h1>
          <p className="mt-2 text-sm text-sub">กรุณาเปิดผ่านลิงก์ในอีเมลที่ได้รับ หากยังพบปัญหาให้ติดต่อทีม ICT</p>
          <Link href="/" className="mt-5"><Button variant="secondary">กลับหน้าแรก</Button></Link>
        </div>
      )}
      {phase === 'done' && t && (
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center" data-testid="approve-done">
          <span className={`flex size-20 items-center justify-center rounded-full ${decision === 'APPROVED' ? 'bg-[var(--ok-bg)] text-ok' : 'bg-[var(--err-bg)] text-err'}`}>
            {decision === 'APPROVED' ? <CheckCircle2 className="size-10" /> : <XCircle className="size-10" />}
          </span>
          <div className="mt-4">{pill}</div>
          <h1 className="mt-3 text-2xl font-semibold">{decision === 'APPROVED' ? 'อนุมัติเรียบร้อยแล้ว' : 'บันทึกการไม่อนุมัติแล้ว'}</h1>
          <p className="mt-2 text-sm text-sub">{decision === 'APPROVED' ? 'ทีม ICT จะดำเนินการและติดต่อกลับหาผู้แจ้ง' : 'ระบบจะแจ้งผู้แจ้งพร้อมเหตุผลที่ท่านระบุ'}</p>
          <span className="num mt-5 rounded-xl border border-line bg-surface px-5 py-2 font-semibold">{t.ticket_no}</span>
        </div>
      )}
      {phase === 'form' && t && (
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6">
          <div className="flex items-center justify-between">
            <div><h1 className="text-xl font-semibold">อนุมัติคำขอรับบริการ ICT</h1><p className="text-sm text-sub">ตรวจสอบรายละเอียดแล้วกดอนุมัติหรือไม่อนุมัติ</p></div>
            {pill}
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar name={t.requester_name} className="size-11 text-sm" />
              <div className="min-w-0"><p className="font-semibold">{t.requester_name}</p><p className="text-sm text-sub">{t.department}</p></div>
              <div className="ml-auto text-right text-xs text-sub"><p>วันที่แจ้ง</p><p className="font-medium text-ink">{fmtDate(t.request_date)}</p></div>
            </div>
            <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
              <div className="flex gap-2"><MapPin className="mt-0.5 size-4 text-brand" /><div><dt className="text-xs text-sub">สถานที่</dt><dd>{t.location}</dd></div></div>
              <div><dt className="text-xs text-sub">วันที่ต้องการ</dt><dd className="font-medium">{fmtDate(t.required_date)}</dd></div>
              {t.asset_id && <div><dt className="text-xs text-sub">รหัสทรัพย์สิน</dt><dd className="num">{t.asset_id}</dd></div>}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 text-sm font-semibold text-sub">ปัญหาที่แจ้ง</h2>
            <p className="rounded-lg bg-surface-2 p-3.5 text-[15px] leading-relaxed whitespace-pre-wrap" data-testid="issue-detail">{t.issue_detail}</p>
            <div className="mt-4"><Attachments images={t.issue_img_url} docs={t.attachment_url} /></div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-sub">ความเห็นและลายเซ็นผู้อนุมัติ</h2>
            <Field label="ความเห็น / เหตุผล" hint="จำเป็นต้องระบุเมื่อไม่อนุมัติ" htmlFor="mgr_comment" className="mb-5">
              <Textarea id="mgr_comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder="ความเห็นเพิ่มเติม (ถ้ามี)" />
            </Field>
            <SignaturePad ref={pad} onChange={onSig} typeLabel="พิมพ์ชื่อ-นามสกุลผู้อนุมัติ" />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button variant="danger" size="lg" loading={busy === 'REJECTED'} disabled={!!busy} onClick={() => act('REJECTED')} data-testid="btn-reject"><X className="size-5" />ไม่อนุมัติ</Button>
              <Button variant="success" size="lg" loading={busy === 'APPROVED'} disabled={!!busy} onClick={() => act('APPROVED')} data-testid="btn-approve"><Check className="size-5" />อนุมัติ</Button>
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs text-mute"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />การตัดสินใจนี้ถูกบันทึกพร้อมลายเซ็นและเวลา และไม่สามารถแก้ไขผ่านหน้านี้ได้อีก</p>
          </Card>
        </div>
      )}
    </PublicShell>
  );
}
