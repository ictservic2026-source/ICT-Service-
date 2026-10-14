'use client';
import { WS_CATEGORY_ORDER, WS_CATEGORY_TH } from '@/lib/constants';
import { fmtDateTime } from '@/lib/utils/format';
import type { TicketLog, TicketService, WorkStatusMaster } from '@/types';

const hex = (c?: string) => (/^#[0-9a-f]{6}$/i.test(c || '') ? (c as string) : '#6b7280');

export function wsInfo(master: WorkStatusMaster[], code?: string | null) {
  return code ? master.find((m) => m.code === code) ?? null : null;
}

/** ป้ายสถานะงานย่อยขนาดเล็ก (ใช้ในตารางรายการ) */
export function WsBadge({ master, code, small }: { master: WorkStatusMaster[]; code?: string | null; small?: boolean }) {
  const w = wsInfo(master, code);
  if (!w) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-medium text-white ${small ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'}`} style={{ background: hex(w.color) }}>
      {w.icon} {w.name_th}
    </span>
  );
}

/** แถบ "สถานะงานล่าสุด" (ws-bar.js → renderWsBar) */
export function WorkStatusBar({ svc, logs, master }: { svc: TicketService | null; logs: TicketLog[]; master: WorkStatusMaster[] }) {
  if (!svc?.work_status) {
    return <div className="rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-xs text-mute" data-testid="ws-bar">สถานะงานล่าสุด: ยังไม่ระบุ</div>;
  }
  const w = wsInfo(master, svc.work_status);
  const color = hex(w?.color);
  const owner = svc.work_owner === 'ITL' ? 'ITL' : 'ICO';
  const last = [...logs].reverse().find((l) => l.step_name === 'WORK_STATUS');
  const who = last?.action_by || svc.staff_name || '';
  const when = fmtDateTime(last?.created_at || svc.work_status_at || svc.updated_at);
  const curIdx = WS_CATEGORY_ORDER.findIndex((c) => c === w?.category);
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3" data-testid="ws-bar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-sub">สถานะงานล่าสุด</span>
          <span className="inline-flex items-center rounded-lg border px-3 py-1 text-[13px] font-bold" style={{ background: color + '1A', color, borderColor: color + '55' }}>{w?.icon ? w.icon + ' ' : ''}{w?.name_th ?? svc.work_status}</span>
          <span className={`rounded-full border px-2 text-[10px] font-bold ${owner === 'ITL' ? 'tone-orange' : 'tone-purple'}`}>{owner}</span>
        </div>
        <span className="text-[11px] text-mute">{when}{who ? ` · ${who}` : ''}</span>
      </div>
      {svc.work_status_note && <p className="mt-2 text-[12.5px] text-sub">{svc.work_status_note}</p>}
      <div className="mt-3 flex gap-1.5">
        {WS_CATEGORY_ORDER.map((c, i) => {
          const cur = i === curIdx, done = curIdx >= 0 && i < curIdx;
          return (
            <div key={c} className="min-w-0 flex-1 text-center">
              <div className="h-1 rounded-full" style={{ background: cur ? color : done ? color + '66' : 'var(--line)' }} />
              <div className={`mt-1 text-[10.5px] ${cur ? 'font-bold text-ink' : 'text-mute'}`}>{WS_CATEGORY_TH[c]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ตัวเลือก "อัปเดตสถานะงาน" ในกล่องคอมเมนต์ */
export function WorkStatusPicker({ svc, master, value, onChange, disabled }: {
  svc: TicketService | null; master: WorkStatusMaster[]; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const cur = svc?.work_status || '';
  const curW = wsInfo(master, cur);
  const groups = WS_CATEGORY_ORDER.map((c) => [c, master.filter((m) => m.category === c)] as const).filter(([, l]) => l.length);
  return (
    <div>
      <label htmlFor="wsPick" className="mb-1 block text-xs font-semibold text-sub">อัปเดตสถานะงาน <span className="font-normal text-mute">(ไม่บังคับ · ข้อความที่พิมพ์จะเป็นหมายเหตุของสถานะ)</span></label>
      <select id="wsPick" data-testid="ws-pick" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="h-10 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-sm focus:border-brand focus:outline-none">
        <option value="">— ไม่เปลี่ยนสถานะ (ส่งเป็นข้อความธรรมดา) —</option>
        {groups.map(([c, list]) => (
          <optgroup key={c} label={list[0].category_th || WS_CATEGORY_TH[c]}>
            {list.map((m) => <option key={m.code} value={m.code} disabled={m.code === cur}>{m.icon ? m.icon + ' ' : ''}{m.name_th}{m.code === cur ? ' (สถานะปัจจุบัน)' : ''}</option>)}
          </optgroup>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-mute">{curW ? `ตอนนี้: ${curW.icon ? curW.icon + ' ' : ''}${curW.name_th}` : cur ? `ตอนนี้: ${cur}` : 'ตอนนี้: ยังไม่ระบุ'}{!svc && ' · (ต้องบันทึกงานก่อนจึงจะตั้งสถานะได้)'}</p>
    </div>
  );
}
