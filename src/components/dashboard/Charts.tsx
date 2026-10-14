'use client';
import { MONTH_SHORT } from '@/lib/utils/format';
import type { MonthRow } from '@/lib/analytics/dashboard';

/** Donut SVG — ทดแทน Chart.js doughnut ของ dashboard เดิม (ทดสอบได้ + พิมพ์ได้) */
export function Donut({ parts, size = 168, center, onPick, active }: { parts: { label: string; value: number; color: string; key?: string }[]; size?: number; center?: React.ReactNode; onPick?: (key: string) => void; active?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = size / 2 - 14, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`แผนภาพวงกลม รวม ${total}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={22} />
        {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
          const len = (p.value / total) * c, k = p.key ?? p.label, dim = !!active && active !== k && active !== 'pending' ? 0.35 : 1;
          const el = (
            <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={22} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off}
              opacity={dim} data-seg={k} role={onPick ? 'button' : undefined} tabIndex={onPick ? 0 : undefined} aria-label={onPick ? `เปิดรายการ ${p.label} ${p.value} รายการ` : undefined}
              style={onPick ? { cursor: 'pointer' } : undefined} onClick={onPick ? () => onPick(k) : undefined}
              onKeyDown={onPick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(k); } } : undefined}><title>{`${p.label}: ${p.value}`}</title></circle>); off += len; return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center ?? <><b className="num text-2xl">{total}</b><span className="text-[11px] text-mute">รายการ</span></>}</div>
    </div>
  );
}

export function HBars({ rows, max, color = 'var(--brand)', onPick, active }: { rows: { label: string; n: number; value?: string }[]; max: number; color?: string; onPick?: (v: string) => void; active?: string }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const v = r.value ?? r.label, on = active === v && !!active;
        return (
          <li key={r.label}>
            <button type="button" disabled={!onPick} onClick={() => onPick?.(on ? '' : v)} aria-pressed={on}
              className={`block w-full rounded-lg px-1 py-0.5 text-left text-xs transition ${onPick ? 'hover:bg-surface-2' : ''} ${on ? 'bg-brand-pale' : ''}`}>
              <span className="mb-1 flex justify-between"><span>{r.label}</span><b className="num">{r.n}</b></span>
              <span className="block h-2 rounded-full bg-surface-3"><span className="block h-full rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: color }} /></span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** กราฟแท่งรายเดือน: แท่ง = ทั้งหมด (ส่วนเสร็จสิ้นทึบ), จุด = คะแนนประเมินเฉลี่ย */
export function MonthlyChart({ rows, onPick }: { rows: MonthRow[]; onPick?: (key: string) => void }) {
  const H = 140, max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="flex items-end gap-1.5 overflow-x-auto pt-2 pb-1" role="img" aria-label="กราฟรายเดือน">
      {rows.map((r) => (
        <button type="button" key={r.key} data-month={r.key} disabled={!onPick} onClick={() => onPick?.(r.key)} aria-label={`กรองเดือน ${MONTH_SHORT[r.m]} ${r.y + 543} (${r.total} รายการ)`}
          className={`flex min-w-[34px] flex-1 flex-col items-center gap-1 rounded-lg px-0.5 ${onPick ? 'cursor-pointer hover:bg-surface-2' : ''} ${r.sel ? 'bg-brand-pale' : ''}`} title={`${MONTH_SHORT[r.m]} ${r.y + 543}: ทั้งหมด ${r.total}, เสร็จ ${r.done}${r.avg != null ? `, คะแนน ${r.avg.toFixed(1)}` : ''}`}>
          <span className="num text-[10px] text-mute">{r.total || ''}</span>
          <div className="flex w-full items-end" style={{ height: H }}>
            <div className="relative w-full overflow-hidden rounded-t bg-brand/35" style={{ height: Math.max(r.total ? 3 : 0, Math.round((r.total / max) * H)) }}>
              <div className="absolute inset-x-0 bottom-0 bg-brand" style={{ height: r.total ? `${(r.done / r.total) * 100}%` : 0 }} />
            </div>
          </div>
          <span className="text-[10px] text-mute">{MONTH_SHORT[r.m]}</span>
        </button>
      ))}
    </div>
  );
}
