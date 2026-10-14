'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { FileText, ImagePlus, Paperclip, X } from 'lucide-react';
import { ALLOWED_UPLOAD_EXT, MAX_UPLOAD_MB } from '@/lib/constants';
import { validateFile } from '@/lib/validation';
import { fileKind } from '@/lib/utils/format';

/** เลือกไฟล์ + ตรวจสอบนามสกุล/ขนาด (ฝั่ง client) + พรีวิวรูป — ฝั่ง server ต้องตรวจซ้ำ (ดู docs/RECOMMENDATIONS.md) */
export function FileInput({ files, onChange, accept, imageOnly, max = 5, label, hint, testId, compact }: {
  files: File[]; onChange: (f: File[]) => void; accept?: string; imageOnly?: boolean; max?: number; label: string; hint?: string; testId?: string; compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  // สร้าง object URL ครั้งเดียวต่อไฟล์ (เดิมสร้างใหม่ทุก render ทำให้รูปกะพริบ/หน่วยความจำรั่ว)
  const urls = useMemo(() => files.map((f) => (fileKind(f.name) === 'image' ? URL.createObjectURL(f) : '')), [files]);
  useEffect(() => () => urls.forEach((u) => u && URL.revokeObjectURL(u)), [urls]);

  const add = (list: FileList | File[]) => {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= max) { setErr(`แนบได้สูงสุด ${max} ไฟล์`); break; }
      const e = validateFile(f) || (imageOnly && fileKind(f.name) !== 'image' ? `${f.name}: ต้องเป็นไฟล์รูปภาพ` : null);
      if (e) { setErr(e); continue; }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f); setErr(null);
    }
    onChange(next);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={clsx('flex cursor-pointer items-center rounded-xl border-2 border-dashed text-center transition', compact ? 'min-h-10 justify-center gap-2 px-3 py-2' : 'flex-col gap-1 px-4 py-5',
          drag ? 'border-brand bg-brand-pale' : 'border-line-strong bg-surface-2 hover:border-brand')}
        onClick={() => ref.current?.click()} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ref.current?.click(); } }}>
        {imageOnly ? <ImagePlus className={compact ? 'size-4 text-brand' : 'size-6 text-brand'} aria-hidden /> : <Paperclip className={compact ? 'size-4 text-brand' : 'size-6 text-brand'} aria-hidden />}
        <p className="text-sm font-medium">{label}</p>
        {!compact && <p className="text-xs text-mute">{hint ?? `คลิกหรือลากไฟล์มาวาง · สูงสุด ${MAX_UPLOAD_MB} MB ต่อไฟล์`}</p>}
        <input ref={ref} type="file" hidden multiple data-testid={testId}
          accept={accept ?? (imageOnly ? 'image/*' : ALLOWED_UPLOAD_EXT.map((e) => '.' + e).join(','))}
          onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
      </div>
      {err && <p role="alert" className="mt-1.5 text-xs text-err">{err}</p>}
      {files.length > 0 && (
        <ul className={clsx('mt-2 grid gap-2', !compact && 'sm:grid-cols-2')}>
          {files.map((f, i) => (
            <li key={f.name + i} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm">
              {fileKind(f.name) === 'image'
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={urls[i]} alt="" className="size-9 rounded object-cover" />
                : <FileText className="size-9 rounded bg-surface-3 p-2 text-sub" aria-hidden />}
              <span className="min-w-0 flex-1"><span className="block truncate">{f.name}</span><span className="num text-xs text-mute">{(f.size / 1024).toFixed(0)} KB</span></span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`ลบ ${f.name}`} className="rounded p-1 text-mute hover:bg-surface-3 hover:text-err"><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
