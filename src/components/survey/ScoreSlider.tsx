'use client';
import { useId } from 'react';

export function scoreHint(r: number): { text: string; emoji: string; color: string } {
  if (r === 0) return { text: 'ยังไม่ได้ให้คะแนน', emoji: '', color: 'var(--mute)' };
  if (r <= 0.2) return { text: 'ควรปรับปรุงอย่างเร่งด่วน', emoji: '😞', color: 'var(--err)' };
  if (r <= 0.4) return { text: 'ต่ำกว่าความคาดหวัง', emoji: '😐', color: '#EA580C' };
  if (r <= 0.6) return { text: 'พอใช้ได้', emoji: '🙂', color: 'var(--warn)' };
  if (r <= 0.75) return { text: 'ดี', emoji: '😊', color: '#65A30D' };
  if (r <= 0.9) return { text: 'ดีมาก', emoji: '😄', color: 'var(--ok)' };
  return { text: 'ดีเยี่ยม!', emoji: '🤩', color: 'var(--ok)' };
}

/** แถบให้คะแนนต่อข้อ (0..max) — ใช้ <input type=range> เพื่อรองรับคีย์บอร์ด/screen reader */
export function ScoreSlider({ n, label, max, value, onChange }: { n: number; label: string; max: number; value: number; onChange: (v: number) => void }) {
  const id = useId();
  const r = value / max;
  const h = scoreHint(r);
  return (
    <div className={`rounded-xl border p-4 transition ${value > 0 ? 'border-brand-line bg-surface' : 'border-line bg-surface-2'}`} data-testid={`score-${n}`}>
      <div className="mb-2 flex items-start gap-3">
        <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-pale text-sm font-semibold text-brand-d">{n}</span>
        <label htmlFor={id} className="flex-1 text-[15px] font-medium">{label}</label>
        <span className="text-2xl" aria-hidden>{h.emoji}</span>
        <span className="num text-right"><b className="text-2xl" style={{ color: value ? h.color : 'var(--mute)' }} data-testid={`score-val-${n}`}>{value}</b><span className="text-xs text-mute"> /{max}</span></span>
      </div>
      <input id={id} type="range" min={0} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${value} จาก ${max} — ${h.text}`} className="h-2 w-full cursor-pointer accent-[var(--brand)]" />
      <div className="num mt-1 flex justify-between text-[11px] text-mute">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => <span key={p}>{Math.round(max * p)}</span>)}
      </div>
      <p className="mt-1 text-xs" style={{ color: h.color }}>{h.text}</p>
    </div>
  );
}
