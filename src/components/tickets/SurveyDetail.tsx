'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { SURVEY_ITEMS } from '@/lib/constants';
import { fmtDateTime, gradeOf } from '@/lib/utils/format';
import { useServices } from '@/hooks';
import type { Survey, Ticket } from '@/types';

const colorOf = (p: number) => (p >= 75 ? 'var(--ok)' : p >= 50 ? 'var(--warn)' : 'var(--err)');

export function SurveyBars({ s }: { s: Survey }) {
  return (
    <div className="space-y-1.5">
      {SURVEY_ITEMS.map((it) => {
        const v = Number(s[`score_q${it.n}` as keyof Survey] ?? 0);
        const pct = Math.min(100, (v / it.max) * 100);
        return (
          <div key={it.n} className="flex items-center gap-2 text-xs">
            <span className="w-44 shrink-0 truncate text-sub" title={it.label}>{it.n}) {it.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: colorOf(pct) }} /></div>
            <span className="num w-12 text-right font-semibold">{v}/{it.max}</span>
          </div>
        );
      })}
    </div>
  );
}

export function SurveyBody({ s, t }: { s: Survey; t?: Ticket | null }) {
  const total = s.score_total ?? [1, 2, 3, 4, 5].reduce((a, i) => a + Number(s[`score_q${i}` as keyof Survey] || 0), 0);
  const g = gradeOf(total);
  const evaluator = s.submitted_by && s.submitted_by !== '[ลายเซ็น]' ? s.submitted_by : t?.requester_name || 'ไม่ระบุชื่อ';
  return (
    <div data-testid="survey-detail">
      <div className="flex items-center gap-5 border-b border-line pb-4">
        <div className="min-w-20 text-center">
          <p className="num text-4xl font-extrabold leading-none">{total}</p>
          <p className="text-[10px] text-mute">คะแนนรวม /100</p>
          <p className="mt-1 text-xs font-bold" style={{ color: colorOf(total) }}>{g.label}</p>
        </div>
        <dl className="flex-1 space-y-1 text-sm">
          <div className="flex gap-3"><dt className="w-24 text-sub">ชื่อผู้ประเมิน</dt><dd className="font-bold">{evaluator}</dd></div>
          <div className="flex gap-3"><dt className="w-24 text-sub">วันที่ประเมิน</dt><dd>{fmtDateTime(s.created_at)}</dd></div>
        </dl>
      </div>
      <p className="mt-4 mb-2 text-xs font-semibold tracking-wide text-sub uppercase">คะแนนแยกรายหัวข้อ</p>
      <SurveyBars s={s} />
      <div className="mt-4 space-y-1 rounded-lg bg-surface-2 p-3 text-sm">
        <p>แก้ไขปัญหาสำเร็จ: <b>{s.chk_resolved ? '✅ ใช่' : '❌ ไม่'}</b></p>
        <p>ได้รับคำอธิบายจากเจ้าหน้าที่: <b>{s.chk_explained ? '✅ ใช่' : '❌ ไม่'}</b></p>
      </div>
      {s.comment
        ? <div className="mt-4 rounded-lg border border-[var(--warn)]/40 bg-[var(--warn-bg)] p-3 text-sm whitespace-pre-wrap text-[var(--warn-fg)]">💬 {s.comment}</div>
        : <p className="mt-4 text-xs text-mute">— ผู้แจ้งไม่ได้เขียนคำแนะนำ/ความเห็นเพิ่มเติม —</p>}
      {s.signature_data && (
        <div className="mt-4"><p className="mb-1 text-xs text-sub">ลายเซ็นผู้ประเมิน</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.signature_data} alt="ลายเซ็นผู้ประเมิน" className="h-14 rounded border border-line bg-white object-contain" /></div>
      )}
    </div>
  );
}

/** ป๊อปอัปผลประเมินแบบเต็ม — เรียกได้จากทุกจุด (รายการ / dashboard tracking / ในหน้า ticket) */
export function SurveyDetailModal({ ticketNo, ticket, onClose }: { ticketNo: string | null; ticket?: Ticket | null; onClose: () => void }) {
  const svc = useServices();
  const [s, setS] = useState<Survey | null | undefined>(undefined);
  useEffect(() => {
    if (!ticketNo || !svc) return;
    setS(undefined);
    svc.repo.getSurvey(ticketNo).then(setS).catch(() => setS(null));
  }, [ticketNo, svc]);
  return (
    <Modal open={!!ticketNo} onClose={onClose} title="ผลประเมินความพึงพอใจ" subtitle={ticketNo ? `Ticket ${ticketNo}${ticket?.requester_name ? ' — ' + ticket.requester_name : ''}` : ''} size="md" z={80}>
      {s === undefined ? <p className="py-8 text-center text-sm text-sub">กำลังโหลด...</p>
        : s === null ? <p className="py-8 text-center text-sm text-sub">⏳ ผู้แจ้งยังไม่ได้ทำแบบประเมินสำหรับงานนี้</p>
        : <SurveyBody s={s} t={ticket} />}
    </Modal>
  );
}
