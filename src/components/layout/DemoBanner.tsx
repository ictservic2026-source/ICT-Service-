'use client';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import { useServices } from '@/hooks';

/** แถบเตือนว่าเป็นโหมด Mockup (ไม่มีการส่งอีเมล/ไม่แตะฐานข้อมูลจริง) พร้อมลิงก์ไปศูนย์ทดสอบ */
export function DemoBanner() {
  const s = useServices();
  if (!s || s.source !== 'mock') return null;
  return (
    <div className="no-print flex items-center justify-center gap-2 bg-[var(--warn-bg)] px-3 py-1.5 text-center text-xs text-[var(--warn-fg)]">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>โหมดทดลอง (Mockup) — ข้อมูลจำลองเก็บในเบราว์เซอร์ · อีเมล/แจ้งเตือนเป็นแบบจำลอง</span>
      <Link href="/demo" className="font-semibold underline">ศูนย์ทดสอบ</Link>
    </div>
  );
}
