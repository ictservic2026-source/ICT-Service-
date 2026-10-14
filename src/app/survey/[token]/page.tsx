'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ShieldAlert, Star } from 'lucide-react';
import { PublicShell } from '@/components/layout/PublicShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Field';
import { PageLoading } from '@/components/ui/Spinner';
import { SignaturePad, type SignatureHandle, type SignatureState } from '@/components/ui/SignaturePad';
import { ScoreSlider } from '@/components/survey/ScoreSlider';
import { SURVEY_ITEMS } from '@/lib/constants';
import { isWellFormedToken } from '@/lib/utils/token';
import { fmtShortDate, gradeOf } from '@/lib/utils/format';
import { useServices, useToast } from '@/hooks';
import type { PublicTicketView } from '@/lib/services/repository';
import type { Survey, Ticket } from '@/types';

type Scores = [number, number, number, number, number];

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>();
  const svc = useServices();
  const toast = useToast();
  const [t, setT] = useState<Ticket | null>(null);
  const [sv, setSv] = useState<PublicTicketView['service']>(null);
  const [existing, setExisting] = useState<PublicTicketView['survey']>(null);
  const [phase, setPhase] = useState<'loading' | 'invalid' | 'form' | 'done'>('loading');
  const [scores, setScores] = useState<Scores>([0, 0, 0, 0, 0]);
  const [chk, setChk] = useState({ resolved: false, explained: false });
  const [comment, setComment] = useState('');
  const [sig, setSig] = useState<SignatureState>({ mode: 'type', text: '', hasDrawing: false });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Survey | null>(null);
  const pad = useRef<SignatureHandle>(null);
  const onSig = useCallback((s: SignatureState) => setSig(s), []);

  useEffect(() => {
    if (!svc) return;
    if (!isWellFormedToken(token)) { setPhase('invalid'); return; }
    (async () => {
      const view = await svc.actions.getPublic('survey', token);
      if (!view) { setPhase('invalid'); return; }
      setT(view.ticket); setSv(view.service); setExisting(view.survey);
      setPhase('form');
    })().catch(() => setPhase('invalid'));
  }, [svc, token]);

  const total = scores.reduce((a, b) => a + b, 0);
  const grade = gradeOf(total);

  async function submit() {
    if (!svc || busy) return;
    if (total === 0) return toast.error('กรุณาให้คะแนนอย่างน้อย 1 หัวข้อก่อน');
    if (sig.mode === 'type' && !sig.text.trim()) { document.getElementById('sig-text')?.focus(); return toast.error('กรุณาพิมพ์ชื่อ-นามสกุลผู้ประเมินก่อนส่ง'); }
    if (sig.mode === 'draw' && !sig.hasDrawing) return toast.error('กรุณาเซ็นชื่อในกล่องลายเซ็นก่อนส่ง');
    setBusy(true);
    try {
      const r = await svc.actions.submitSurvey(token, {
        scores, chk_resolved: chk.resolved, chk_explained: chk.explained, comment: comment.trim() || undefined,
        signerName: sig.mode === 'type' ? sig.text.trim() : undefined, signatureData: pad.current?.toDataUrl() ?? null,
      });
      setResult(r.survey); setPhase('done');
    } catch (e) {
      toast.error('ส่งไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  }

  return (
    <PublicShell>
      {phase === 'loading' && <PageLoading />}
      {phase === 'invalid' && (
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center" data-testid="survey-invalid">
          <span className="flex size-16 items-center justify-center rounded-full bg-[var(--err-bg)] text-err"><ShieldAlert className="size-8" /></span>
          <h1 className="mt-4 text-xl font-semibold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</h1>
          <p className="mt-2 text-sm text-sub">กรุณาเปิดผ่านลิงก์ที่ได้รับจากทีม ICT</p>
          <Link href="/" className="mt-5"><Button variant="secondary">กลับหน้าแรก</Button></Link>
        </div>
      )}
      {phase === 'done' && result && (
        <div className="mx-auto max-w-md px-4 py-14 text-center" data-testid="survey-done">
          <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-[var(--ok-bg)] text-ok"><CheckCircle2 className="size-10" /></span>
          <h1 className="mt-4 text-2xl font-semibold">ขอบคุณสำหรับการประเมิน!</h1>
          <p className="mt-1 text-sm text-sub">ความคิดเห็นของท่านช่วยให้เราพัฒนาบริการให้ดียิ่งขึ้น</p>
          <Card className="mt-6 p-5">
            <p className="num text-4xl font-bold" data-testid="done-total">{result.score_total}<span className="text-lg text-mute">/100</span></p>
            <p className="mt-1 font-medium" style={{ color: `var(--${grade.tone === 'green' ? 'ok' : grade.tone === 'amber' ? 'warn' : 'err'})` }}>{grade.label}</p>
            <ul className="mt-4 grid grid-cols-5 gap-1 text-center text-[11px] text-sub">
              {SURVEY_ITEMS.map((it) => <li key={it.n} className="rounded-lg bg-surface-2 p-1.5"><span className="block">{it.short}</span><b className="num text-sm text-ink">{result[`score_q${it.n}` as keyof Survey] as number}</b><span className="text-mute">/{it.max}</span></li>)}
            </ul>
            <div className="mt-4 rounded-lg bg-surface-2 p-3 text-left text-sm">
              <p className="text-xs text-sub">ผู้ประเมิน</p>
              {result.signature_data
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={result.signature_data} alt="ลายเซ็นผู้ประเมิน" className="mt-1 h-14 object-contain" />
                : <p className="font-semibold text-ok">{result.submitted_by}</p>}
            </div>
          </Card>
        </div>
      )}
      {phase === 'form' && t && (
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6">
          <div><h1 className="flex items-center gap-2 text-xl font-semibold"><Star className="size-5 text-warn" />แบบประเมินความพึงพอใจ</h1>
            <p className="text-sm text-sub">FM-IC-001 · ใช้เวลาไม่ถึง 1 นาที</p></div>
          <Card className="p-5">
            <div className="flex items-center justify-between"><span className="num font-bold text-brand-d" data-testid="survey-ticket-no">{t.ticket_no}</span><span className="text-xs text-sub">{fmtShortDate(t.request_date)}</span></div>
            <p className="mt-2 text-sm"><span className="text-sub">ผู้แจ้ง: </span>{t.requester_name} — {t.department}</p>
            <p className="mt-1 text-sm"><span className="text-sub">ปัญหา: </span>{t.issue_detail}</p>
            {sv && (sv.action_detail || sv.staff_name || sv.finish_date) && (
              <div className="mt-3 space-y-1 rounded-lg bg-surface-2 p-3 text-sm">
                {sv.staff_name && <p><span className="text-sub">เจ้าหน้าที่: </span>{sv.staff_name}</p>}
                {sv.action_detail && <p><span className="text-sub">การแก้ไข: </span>{sv.action_detail.slice(0, 120)}{sv.action_detail.length > 120 ? '…' : ''}</p>}
                {sv.finish_date && <p><span className="text-sub">เสร็จเมื่อ: </span>{fmtShortDate(sv.finish_date)}</p>}
              </div>
            )}
          </Card>

          {existing ? (
            <div role="status" className="rounded-xl border border-ok/40 bg-[var(--ok-bg)] p-4 text-[var(--ok-fg)]" data-testid="survey-already">✅ คุณส่งแบบประเมินแล้ว (คะแนน: {existing.score_total}/100) ขอบคุณ!</div>
          ) : !['DONE', 'ICO_FINAL'].includes(t.status) ? (
            <div role="status" className="rounded-xl border border-warn/40 bg-[var(--warn-bg)] p-4 text-[var(--warn-fg)]" data-testid="survey-notready">งานนี้ยังไม่ได้ปิด จึงยังประเมินไม่ได้ — กรุณากลับมาประเมินเมื่อได้รับแจ้งว่างานเสร็จสิ้น</div>
          ) : (
            <>
              <div className="space-y-3">
                {SURVEY_ITEMS.map((it, i) => (
                  <ScoreSlider key={it.n} n={it.n} label={it.label} max={it.max} value={scores[i]}
                    onChange={(v) => setScores((s) => s.map((x, j) => (j === i ? v : x)) as Scores)} />
                ))}
              </div>
              <Card className="sticky bottom-3 z-10 flex items-center gap-4 p-4 shadow-pop">
                <div className="flex-1"><div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${total}%` }} /></div></div>
                <p className="num text-2xl font-bold" data-testid="survey-total">{total}<span className="text-sm text-mute">/100</span></p>
                <span className="text-sm font-medium">{grade.label}</span>
              </Card>
              <Card className="space-y-3 p-5">
                <p className="text-sm font-medium">โปรดทำเครื่องหมาย ✓ ที่ตรงกับความเป็นจริง</p>
                {([['resolved', 'จนท. ได้ดำเนินการแก้ไขเป็นที่เรียบร้อยสมบูรณ์ สามารถใช้งานได้ตามปกติ'], ['explained', 'จนท. ได้อธิบายเกี่ยวกับปัญหา, สาเหตุ, การแก้ไขและการป้องกัน ให้ผู้ขอใช้บริการเข้าใจ']] as const).map(([k, txt]) => (
                  <label key={k} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm hover:bg-surface-2">
                    <input type="checkbox" checked={chk[k]} onChange={(e) => setChk((c) => ({ ...c, [k]: e.target.checked }))} className="mt-0.5 size-4 accent-[var(--brand)]" data-testid={`chk-${k}`} />{txt}
                  </label>
                ))}
              </Card>
              <Card className="p-5">
                <Field label="ข้อเสนอแนะเพิ่มเติม" htmlFor="sv-comment" className="mb-5">
                  <Textarea id="sv-comment" rows={3} value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} placeholder="ความคิดเห็น/ข้อเสนอแนะ (ถ้ามี)" />
                </Field>
                <SignaturePad ref={pad} onChange={onSig} typeLabel="พิมพ์ชื่อ-นามสกุลผู้ประเมิน" height={130} />
              </Card>
              <Button size="lg" block loading={busy} onClick={submit} data-testid="btn-submit-survey">ส่งแบบประเมิน</Button>
            </>
          )}
        </div>
      )}
    </PublicShell>
  );
}
