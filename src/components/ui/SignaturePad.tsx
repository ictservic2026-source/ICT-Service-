'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import clsx from 'clsx';
import { Eraser, PenLine, Type } from 'lucide-react';
import { Input } from './Field';

export interface SignatureState { mode: 'type' | 'draw'; text: string; hasDrawing: boolean }
export interface SignatureHandle {
  toBlob(): Promise<Blob | null>;
  toDataUrl(): string | null;
  clear(): void;
}

/**
 * ช่องลงนาม 2 โหมด (พิมพ์ชื่อ / วาดลายเซ็น) — ย้ายจาก canvas + switchSig() ของ approve.js และ survey.js
 * รองรับเมาส์/ทัช (Pointer Events), DPR, และ resize
 */
export const SignaturePad = forwardRef<SignatureHandle, {
  onChange?: (s: SignatureState) => void; typeLabel?: string; typePlaceholder?: string; disabled?: boolean; height?: number;
}>(function SignaturePad({ onChange, typeLabel = 'พิมพ์ชื่อ-นามสกุล', typePlaceholder = 'พิมพ์ชื่อ-นามสกุลของท่าน', disabled, height = 150 }, ref) {
  const [mode, setMode] = useState<'type' | 'draw'>('type');
  const [text, setText] = useState('');
  const [has, setHas] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => { onChange?.({ mode, text, hasDrawing: has }); }, [mode, text, has, onChange]);

  const setup = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    // เก็บภาพเดิมไว้เมื่อ resize
    const old = has ? c.toDataURL() : null;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = document.documentElement.classList.contains('dark') ? '#e6edf7' : '#1c1917';
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (old) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height); img.src = old; }
  }, [has]);

  useEffect(() => {
    if (mode !== 'draw') return;
    const raf = requestAnimationFrame(setup);
    window.addEventListener('resize', setup);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', setup); };
  }, [mode, setup]);

  const pt = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current!.getContext('2d')!;
    const p = pt(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01); ctx.stroke(); // จุดเดียวก็เห็น
    setHas(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext('2d')!;
    const p = pt(e); ctx.lineTo(p.x, p.y); ctx.stroke();
  };
  const up = () => { drawing.current = false; };

  const clear = useCallback(() => {
    const c = canvas.current;
    if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setHas(false);
  }, []);

  useImperativeHandle(ref, () => ({
    toBlob: () => new Promise((res) => {
      const c = canvas.current;
      if (mode !== 'draw' || !c || !has) return res(null);
      c.toBlob((b) => res(b), 'image/png');
    }),
    toDataUrl: () => (mode === 'draw' && has && canvas.current ? canvas.current.toDataURL('image/png') : null),
    clear,
  }), [mode, has, clear]);

  return (
    <div>
      <div role="tablist" className="mb-3 inline-flex rounded-xl bg-surface-3 p-1">
        {([['type', 'พิมพ์ชื่อ', Type], ['draw', 'วาดลายเซ็น', PenLine]] as const).map(([m, l, Icon]) => (
          <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => setMode(m)}
            className={clsx('inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition', mode === m ? 'bg-surface text-ink shadow-card' : 'text-sub')}>
            <Icon className="size-4" aria-hidden />{l}
          </button>
        ))}
      </div>
      {mode === 'type' ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium" htmlFor="sig-text">{typeLabel}</label>
          <Input id="sig-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={typePlaceholder} disabled={disabled} maxLength={80} autoComplete="name" />
        </div>
      ) : (
        <div>
          <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-line-strong bg-white dark:bg-surface-2" style={{ height }}>
            <canvas ref={canvas} data-testid="sig-canvas" aria-label="พื้นที่วาดลายเซ็น" className="absolute inset-0 size-full touch-none cursor-crosshair"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} />
            {!has && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-mute">ใช้เมาส์หรือนิ้ววาดลายเซ็นตรงนี้</span>}
          </div>
          <button type="button" onClick={clear} className="mt-2 inline-flex items-center gap-1 text-xs text-sub hover:text-err"><Eraser className="size-3.5" aria-hidden />ล้างลายเซ็น</button>
        </div>
      )}
    </div>
  );
});
