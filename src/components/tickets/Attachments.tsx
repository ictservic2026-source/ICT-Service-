'use client';
import { useState } from 'react';
import { Download, ExternalLink, Eye, FileText, X } from 'lucide-react';
import { fileKind, fileNameFromUrl, toArray } from '@/lib/utils/format';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

/** รูป (แกลเลอรี + lightbox) และเอกสาร (พรีวิวใน Modal: รูป/PDF; ไฟล์อื่นเปิดแท็บใหม่) — จาก openLB/openFileModal ของ approve.js */
export function Attachments({ images, docs }: { images?: unknown; docs?: unknown }) {
  const imgs = toArray(images), files = toArray(docs);
  const [lb, setLb] = useState<string | null>(null);
  const [fm, setFm] = useState<string | null>(null);
  if (!imgs.length && !files.length) return null;
  const name = fm ? fileNameFromUrl(fm) : '';
  const kind = fileKind(name);
  return (
    <div className="space-y-3">
      {imgs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imgs.map((u, i) => (
            <button key={u + i} type="button" onClick={() => setLb(u)} className="overflow-hidden rounded-lg border border-line" aria-label={`ดูรูปที่ ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`รูปประกอบที่ ${i + 1}`} className="size-24 object-cover transition hover:scale-105" />
            </button>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((u, i) => {
            const n = fileNameFromUrl(u);
            return (
              <li key={u + i}>
                <button type="button" onClick={() => setFm(u)} className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left text-sm hover:border-brand">
                  <FileText className={fileKind(n) === 'pdf' ? 'size-4 text-err' : 'size-4 text-warn'} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{n}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-brand-d"><Eye className="size-3.5" aria-hidden />พรีวิว</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {lb && (
        <div className="anim-fade fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4" onClick={() => setLb(null)} role="dialog" aria-modal="true" aria-label="ดูรูปขยาย">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lb} alt="รูปขยาย" className="max-h-full max-w-full rounded-lg" />
          <button className="absolute top-4 right-4 rounded-full bg-white/15 p-2 text-white" aria-label="ปิด"><X className="size-5" /></button>
        </div>
      )}
      <Modal open={!!fm} onClose={() => setFm(null)} title={name} size="lg" z={85}
        footer={fm ? <>
          <a href={fm} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="sm"><ExternalLink className="size-4" />เปิดแท็บใหม่</Button></a>
          <a href={fm} download={name}><Button size="sm"><Download className="size-4" />ดาวน์โหลด</Button></a>
        </> : null}>
        {fm && (kind === 'image'
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={fm} alt={name} className="mx-auto max-h-[60vh] rounded-lg" />
          : kind === 'pdf'
            ? <iframe src={fm} title={name} className="h-[60vh] w-full rounded-lg border border-line" />
            : <div className="py-10 text-center text-sm text-sub">ไฟล์ประเภทนี้ไม่รองรับพรีวิว<br /><span className="text-xs">กด “เปิดแท็บใหม่” หรือ “ดาวน์โหลด” เพื่อเปิดดู</span></div>)}
      </Modal>
    </div>
  );
}
