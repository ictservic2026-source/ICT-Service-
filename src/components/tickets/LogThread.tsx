'use client';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Lock, Send, Target } from 'lucide-react';
import type { CommentRead, Role, TicketLog, TicketService, WorkStatusMaster } from '@/types';
import { LOG_STATUS_TH, MENTION_OPTIONS, STEP_LABEL } from '@/lib/constants';
import { fmtDateTime } from '@/lib/utils/format';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { WorkStatusPicker } from './WorkStatus';

const PAGE_SIZE = 5;
const CHAT_APPROVAL_STEPS = ['MANAGER_APPROVE', 'ITL_APPROVE', 'IT_MGR_APPROVE'];
const chatText = (r: TicketLog) => String(r.comment || '').replace(/\s*\(สถานะงานล่าสุด:[^)]*\)\s*$/, '').trim();
/** ข้อความที่นับเป็น "คุยกันในทีม" (isTeamChat ของ admin-*.js เดิม) */
export function isTeamChat(r: TicketLog) {
  if (r.status === 'COMMENT' || r.status === 'INTERNAL_NOTE') return true;
  if (r.step_name === 'WORK_STATUS') return /\(([^()]+)\)\s*$/.test(String(r.comment || ''));
  return CHAT_APPROVAL_STEPS.includes(r.step_name || '') && chatText(r) !== '';
}

type Mode = 'note' | 'history' | 'all';

export interface SendInput { text: string; internal: boolean; mention: Role | '' ; wsCode: string }

export function LogThread({ logs, reads, me, role, svc, master, canSetStatus, onSend, busy }: {
  logs: TicketLog[]; reads: CommentRead[]; me: string; role: Role; svc: TicketService | null; master: WorkStatusMaster[];
  canSetStatus: boolean; onSend: (i: SendInput) => Promise<boolean>; busy?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('note');
  const [page, setPage] = useState(1);
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [mention, setMention] = useState<Role | ''>('');
  const [ws, setWs] = useState('');

  const filtered = useMemo(() => logs.filter((r) => {
    const isNote = r.status === 'COMMENT' || r.status === 'INTERNAL_NOTE';
    if (mode === 'history') return !isNote || r.step_name === 'WORK_STATUS';
    if (mode === 'note') return isTeamChat(r);
    return true;
  }), [logs, mode]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pg = Math.min(page, pages);
  const endIdx = filtered.length - (pg - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(Math.max(0, endIdx - PAGE_SIZE), endIdx);
  const shown = mode === 'history' ? [...pageRows].reverse() : pageRows;
  useEffect(() => { setPage(1); }, [mode, logs.length]);

  const readMap = useMemo(() => {
    const m = new Map<number, CommentRead[]>();
    reads.forEach((r) => { const a = m.get(r.log_id); if (a) a.push(r); else m.set(r.log_id, [r]); });
    return m;
  }, [reads]);

  async function send() {
    const ok = await onSend({ text, internal, mention, wsCode: ws });
    if (ok) { setText(''); setInternal(false); setWs(''); }
  }
  const mentions = MENTION_OPTIONS.filter((m) => m.value !== role);

  return (
    <div className="flex flex-col gap-3" data-testid="log-thread">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="ตัวกรองประวัติ">
        {([['note', '💬 คุยกันในทีม'], ['history', '📜 ประวัติระบบ'], ['all', 'ทั้งหมด']] as const).map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} data-testid={`logf-${m}`}
            className={clsx('rounded-full border px-3 py-1 text-xs font-medium transition', mode === m ? 'border-brand bg-brand-pale text-brand-d' : 'border-line text-sub hover:bg-surface-2')}>{l}</button>
        ))}
      </div>

      <div className="space-y-2" aria-live="polite">
        {logs.length === 0 && <p className="py-6 text-center text-sm text-mute">ยังไม่มี log สำหรับ ticket นี้</p>}
        {logs.length > 0 && filtered.length === 0 && <p className="py-6 text-center text-sm text-mute">{mode === 'history' ? 'ยังไม่มีประวัติระบบ' : 'ยังไม่มีข้อความคุยกันในทีม'}</p>}
        {shown.map((r) => {
          const isBounce = /BACK|REJECT/i.test(r.status || '');
          const isInternal = r.status === 'INTERNAL_NOTE';
          const isApprove = /APPROVE|DONE/i.test(r.status || '') && !isBounce;
          const isNote = r.status === 'COMMENT' || r.status === 'INTERNAL_NOTE';
          const isWS = r.step_name === 'WORK_STATUS';
          const label = isWS ? '📌 สถานะงาน' : isInternal ? '🔒 คุยในทีม' : r.status === 'COMMENT' ? '💬 ความเห็น' : (LOG_STATUS_TH[r.status || ''] ?? r.status);
          const mine = r.action_by === me;
          const seenBy = (readMap.get(r.id) || []).filter((x) => x.reader_name !== me);
          return (
            <div key={r.id} data-testid="log-item"
              className={clsx('rounded-xl border px-3.5 py-2.5 text-sm', isBounce ? 'border-err/40 bg-[var(--err-bg)]' : isInternal ? 'tone-purple border-transparent' : isWS ? 'border-brand-line bg-brand-pale' : 'border-line bg-surface-2')}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <b className="text-ink">{r.action_by || 'ไม่ระบุผู้บันทึก'}</b>
                <span className="text-sub">{STEP_LABEL[r.step_name ?? ''] ?? r.step_name ?? 'ระบบ'}</span>
                <span className={clsx('font-semibold', isBounce ? 'text-err' : isApprove ? 'text-ok' : isInternal ? '' : 'text-sub')}>{label}</span>
                {isNote && r.mentioned_role && <span className="inline-flex items-center gap-0.5 font-bold text-err"><Target className="size-3" />ถึง {r.mentioned_role}</span>}
                <span className="ml-auto text-mute">{fmtDateTime(r.created_at)}</span>
              </div>
              {r.comment && <p className="mt-1 break-words whitespace-pre-wrap text-ink">{r.comment}</p>}
              {isNote && mine && (seenBy.length
                ? <p className="mt-1 text-[11px] text-ok">✓ เห็นแล้วโดย {seenBy.map((x) => `${x.reader_name} (${x.reader_role})`).join(', ')}</p>
                : <p className="mt-1 text-[11px] text-mute">ยังไม่มีใครอ่าน</p>)}
            </div>
          );
        })}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-mute">
          <span>แสดง {Math.max(1, endIdx - PAGE_SIZE + 1)}–{endIdx} จาก {filtered.length} (ใหม่สุดก่อน)</span>
          <span className="flex items-center gap-1">
            <button disabled={pg <= 1} onClick={() => setPage(pg - 1)} aria-label="ใหม่กว่า" className="rounded border border-line p-1 disabled:opacity-40"><ChevronRight className="size-4" /></button>
            <span className="num px-1">{pg}/{pages}</span>
            <button disabled={pg >= pages} onClick={() => setPage(pg + 1)} aria-label="เก่ากว่า" className="rounded border border-line p-1 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
          </span>
        </div>
      )}

      <div className="space-y-2.5 rounded-xl border border-line bg-surface p-3">
        {canSetStatus && <WorkStatusPicker svc={svc} master={master} value={ws} onChange={setWs} disabled={!svc} />}
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} data-testid="comment-text" aria-label="ความเห็น"
          placeholder={ws ? 'หมายเหตุของสถานะงาน (ไม่บังคับ)…' : 'พิมพ์ความเห็น / คุยกับทีม…'} />
        <div className="flex flex-wrap items-center gap-2">
          <select value={mention} onChange={(e) => setMention(e.target.value as Role | '')} data-testid="mention" title="แจ้งเตือนไปที่ใคร" aria-label="แจ้งเตือนไปที่ใคร"
            className="h-9 rounded-lg border border-line-strong bg-surface-2 px-2 text-xs">
            {mentions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-sub"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} data-testid="comment-internal" className="accent-[var(--brand)]" /><Lock className="size-3.5" />ภายในทีมเท่านั้น</label>
          <Button size="sm" className="ml-auto" onClick={send} loading={busy} data-testid="comment-send"><Send className="size-4" />{ws ? 'อัปเดตสถานะ' : 'ส่งความเห็น'}</Button>
        </div>
      </div>
    </div>
  );
}
