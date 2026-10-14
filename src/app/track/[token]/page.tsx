'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { PublicShell } from '@/components/layout/PublicShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { KV } from '@/components/ui/Card';
import { PageLoading } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/Badge';
import { Stepper } from '@/components/ui/Stepper';
import { Attachments } from '@/components/tickets/Attachments';
import { LOG_STATUS_TH, STEP_LABEL } from '@/lib/constants';
import { isWellFormedToken } from '@/lib/utils/token';
import { fmtDate, fmtDateTime } from '@/lib/utils/format';
import { isBounced, latestStepLog } from '@/lib/workflow/machine';
import { useServices } from '@/hooks';
import type { PublicTicketView } from '@/lib/services/repository';
import type { Ticket, TicketLog } from '@/types';

/** หน้าติดตามสถานะสำหรับผู้แจ้ง (ไม่ต้องล็อกอิน, ใช้ Secure Token) — เพิ่มใหม่: ต้นฉบับไม่มีหน้านี้ แสดงเฉพาะข้อมูลที่ผู้แจ้งควรเห็น (ไม่รวมบันทึกภายใน/ค่าใช้จ่าย) */
export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const svc = useServices();
  const [t, setT] = useState<Ticket | null>(null);
  const [logs, setLogs] = useState<TicketLog[]>([]);
  const [sv, setSv] = useState<PublicTicketView['service']>(null);
  const [survey, setSurvey] = useState<PublicTicketView['survey']>(null);
  const [phase, setPhase] = useState<'loading' | 'invalid' | 'ok'>('loading');

  useEffect(() => {
    if (!svc) return;
    if (!isWellFormedToken(token)) { setPhase('invalid'); return; }
    (async () => {
      // บันทึกภายใน/คอมเมนต์ทีม/ค่าใช้จ่าย ถูกกรองตั้งแต่ฝั่งข้อมูล (get_public_ticket) — ไม่ได้แค่ซ่อนบนหน้าจอ
      const view = await svc.actions.getPublic('track', token);
      if (!view) { setPhase('invalid'); return; }
      setT(view.ticket); setLogs(view.logs); setSv(view.service); setSurvey(view.survey); setPhase('ok');
    })().catch(() => setPhase('invalid'));
  }, [svc, token]);

  if (phase === 'loading') return <PublicShell><PageLoading /></PublicShell>;
  if (phase === 'invalid' || !t) return (
    <PublicShell>
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center" data-testid="track-invalid">
        <span className="flex size-16 items-center justify-center rounded-full bg-[var(--err-bg)] text-err"><ShieldAlert className="size-8" /></span>
        <h1 className="mt-4 text-xl font-semibold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</h1>
        <Link href="/" className="mt-5"><Button variant="secondary">กลับหน้าแรก</Button></Link>
      </div>
    </PublicShell>
  );
  const bounced = isBounced(t, latestStepLog(logs));
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm text-sub">ติดตามสถานะงาน</p><h1 className="num text-2xl font-bold" data-testid="track-ticket-no">{t.ticket_no}</h1></div>
          <StatusBadge status={t.status} />
        </div>
        <Card className="p-5"><Stepper status={t.status} bounced={bounced} /></Card>
        <Card className="p-5">
          <KV k="ผู้แจ้ง" v={t.requester_name} /><KV k="แผนก" v={t.department} /><KV k="สถานที่" v={t.location} />
          <KV k="วันที่แจ้ง" v={fmtDate(t.request_date)} /><KV k="วันที่ต้องการ" v={fmtDate(t.required_date)} />
          {sv?.staff_name && <KV k="เจ้าหน้าที่ผู้ดูแล" v={sv.staff_name} />}
          {t.closed_at && <KV k="ปิดงานเมื่อ" v={fmtDate(t.closed_at)} />}
          <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm whitespace-pre-wrap">{t.issue_detail}</p>
          <div className="mt-3"><Attachments images={t.issue_img_url} docs={t.attachment_url} /></div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-sub">ประวัติการดำเนินการ</h2>
          {logs.length === 0 ? <p className="text-sm text-mute">ยังไม่มีการดำเนินการ</p> : (
            <ol className="space-y-3 border-l-2 border-line pl-4">
              {logs.map((l) => (
                <li key={l.id} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-brand" />
                  <p className="text-sm font-medium">{STEP_LABEL[l.step_name ?? ''] ?? l.step_name} · {LOG_STATUS_TH[l.status ?? ''] ?? l.status}</p>
                  <p className="text-xs text-sub">โดย {l.action_by} · {fmtDateTime(l.created_at)}</p>
                  {l.comment && l.step_name !== 'WORK_STATUS' && <p className="mt-1 rounded-lg bg-surface-2 p-2 text-sm">{l.comment}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
        {t.status === 'DONE' && t.survey_token && t.survey_score == null && !survey && (
          <Link href={`/survey/${t.survey_token}`} className="block"><Button block size="lg">ประเมินความพึงพอใจ</Button></Link>
        )}
      </div>
    </PublicShell>
  );
}
