'use client';
import { useEffect, useState } from 'react';
import type { Survey, Ticket, TicketLog, TicketService } from '@/types';
import { fmtDate, fmtDateTime } from '@/lib/utils/format';
import { LOG_STATUS_TH, STEP_LABEL } from '@/lib/constants';
import { useServices } from '@/hooks';
import { Drawer } from '@/components/ui/Modal';
import { Stepper } from '@/components/ui/Stepper';
import { KV, Section } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { WorkView } from '@/components/tickets/WorkForm';
import { SurveyBody } from '@/components/tickets/SurveyDetail';
import { isBounced, latestStepLog } from '@/lib/workflow/machine';

/** ลิ้นชักดูรายละเอียดตั๋ว (อ่านอย่างเดียว) — ใช้จาก Dashboard drilldown / Reports */
export function TicketDrawer({ ticketNo, onClose }: { ticketNo: string | null; onClose: () => void }) {
  const sv = useServices();
  const [d, setD] = useState<{ t: Ticket; svc: TicketService | null; logs: TicketLog[]; survey: Survey | null } | null | undefined>(undefined);
  useEffect(() => {
    if (!ticketNo || !sv) return;
    let alive = true; setD(undefined);
    Promise.all([sv.repo.getTicket(ticketNo), sv.repo.getService(ticketNo), sv.repo.listLogs(ticketNo), sv.repo.getSurvey(ticketNo)])
      .then(([t, svc, logs, survey]) => { if (alive) setD(t ? { t, svc, logs, survey } : null); }).catch(() => alive && setD(null));
    return () => { alive = false; };
  }, [ticketNo, sv]);
  const bounced = d ? isBounced(d.t, latestStepLog(d.logs)) : false;
  return (
    <Drawer open={!!ticketNo} onClose={onClose} title={ticketNo ?? ''} subtitle={d ? `${d.t.requester_name} · ${d.t.department}` : undefined}>
      {d === undefined ? <p className="py-10 text-center text-sm text-sub">กำลังโหลด…</p> : d === null ? <p className="py-10 text-center text-sm text-sub">ไม่พบข้อมูล</p> : (
        <div data-testid="ticket-drawer">
          <div className="mb-3"><StatusBadge status={d.t.status} bounced={bounced} /></div>
          <Stepper status={d.t.status} bounced={bounced} />
          <div className="mt-4">
            <Section title="คำขอ"><KV k="สถานที่" v={d.t.location} /><KV k="Asset" v={d.t.asset_id} /><KV k="วันที่แจ้ง" v={fmtDate(d.t.request_date)} /><p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm whitespace-pre-wrap break-words">{d.t.issue_detail}</p></Section>
            <Section title="งานที่ดำเนินการ"><WorkView svc={d.svc} /></Section>
            {d.survey && <Section title="ผลประเมิน"><SurveyBody s={d.survey} t={d.t} /></Section>}
            <Section title="ประวัติ">
              <ol className="space-y-1.5 border-l-2 border-line pl-3">
                {d.logs.filter((l) => l.status !== 'COMMENT' && l.status !== 'INTERNAL_NOTE').map((l) => (
                  <li key={l.id} className="text-xs"><b>{l.action_by || 'ระบบ'}</b> · {STEP_LABEL[l.step_name ?? ''] ?? l.step_name} · <span className="font-semibold">{LOG_STATUS_TH[l.status] ?? l.status}</span>{l.comment ? <span className="text-sub"> — {l.comment}</span> : null}<span className="block text-mute">{fmtDateTime(l.created_at)}</span></li>
                ))}
              </ol>
            </Section>
          </div>
        </div>
      )}
    </Drawer>
  );
}
