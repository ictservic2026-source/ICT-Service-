'use client';
import { useState } from 'react';
import { FileArchive, FileDown, Files, Loader2 } from 'lucide-react';
import type { Ticket, TicketService } from '@/types';
import { buildCasePdf, buildCombinedPdf, buildZip, caseFiles, loadEngine, saveBytes, type SkippedFile } from '@/lib/reports/casePdf';
import { useToast } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';

type Item = { t: Ticket; svc: TicketService | null | undefined };
const byNo = (a: Item, b: Item) => a.t.ticket_no.localeCompare(b.t.ticket_no, 'en', { numeric: true });

/** สรุปผลหลังดาวน์โหลด (ไฟล์ที่รวมไม่ได้ / เคสที่ยังไม่มีใบงาน) */
function notice(skipped: SkippedFile[], noForm: string[]) {
  const parts: string[] = [];
  if (noForm.length) parts.push(`ยังไม่มีใบงาน ${noForm.length} เคส (${noForm.slice(0, 5).join(', ')}${noForm.length > 5 ? '…' : ''})`);
  if (skipped.length) parts.push(`ข้าม ${skipped.length} ไฟล์ที่รวมไม่ได้ (${skipped.slice(0, 3).map((s) => `${s.ticketNo}/${s.name}`).join(', ')}${skipped.length > 3 ? '…' : ''})`);
  return parts.join(' · ');
}

/** hook กลาง: ดาวน์โหลดเคสเดียว / ZIP แยกเคส / PDF รวม พร้อมข้อความความคืบหน้า */
export function useCaseDocs() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  async function run(kind: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(kind); setProgress('กำลังเตรียม…');
    try { await fn(); } catch (e) { toast.error('สร้างไฟล์ไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setBusy(null); setProgress(''); }
  }

  const single = (it: Item) => run(`one:${it.t.ticket_no}`, async () => {
    const eng = await loadEngine();
    const b = await buildCasePdf(eng, it.t, it.svc, setProgress);
    if (!b.pages) { toast.error(`${b.ticketNo} ยังไม่มีใบงานและไฟล์แนบให้รวม`); return; }
    saveBytes(b.pdf, `${b.ticketNo}.pdf`, 'application/pdf');
    const n = notice(b.skipped, b.hasForm ? [] : [b.ticketNo]);
    if (n) toast.info(`${b.ticketNo}.pdf (${b.pages} หน้า) · ${n}`); else toast.success(`${b.ticketNo}.pdf · ${b.pages} หน้า`);
  });

  const zip = (items: Item[], label: string) => run('zip', async () => {
    const eng = await loadEngine();
    const r = await buildZip(eng, [...items].sort(byNo), setProgress);
    const name = `ICT-Documents_${label}.zip`;
    saveBytes(r.zip, name, 'application/zip');
    const n = notice(r.skipped, r.noForm);
    if (n) toast.info(`${name} · ${r.cases} เคส · ${n}`); else toast.success(`${name} · ${r.cases} เคส`);
  });

  const combined = (items: Item[], label: string) => run('combined', async () => {
    const eng = await loadEngine();
    const r = await buildCombinedPdf(eng, [...items].sort(byNo), `ICT Documents ${label}`, setProgress);
    if (!r.pages) { toast.error('เคสที่เลือกยังไม่มีใบงานและไฟล์แนบให้รวม'); return; }
    const name = `ICT-Documents_${label}.pdf`;
    saveBytes(r.pdf, name, 'application/pdf');
    const n = notice(r.skipped, r.noForm);
    if (n) toast.info(`${name} · ${r.pages} หน้า · ${n}`); else toast.success(`${name} · ${r.pages} หน้า`);
  });

  return { busy, progress, single, zip, combined };
}

/** ปุ่มดาวน์โหลดเอกสารรวมของเคสเดียว (ใช้ในหน้ารายละเอียดเคส / ตารางรายงาน) */
export function CaseDocButton({ t, svc, size = 'sm', label = 'เอกสารรวม (PDF)' }: { t: Ticket; svc: TicketService | null | undefined; size?: 'sm' | 'md'; label?: string }) {
  const d = useCaseDocs();
  const mine = d.busy === `one:${t.ticket_no}`;
  return (
    <Button size={size} variant="secondary" onClick={(e) => { e.stopPropagation(); void d.single({ t, svc }); }} disabled={!!d.busy && !mine}
      title={mine ? d.progress : 'ใบงาน + ไฟล์แนบทั้งหมดของเคสนี้ในไฟล์เดียว'} data-testid={`case-pdf-${t.ticket_no}`}>
      {mine ? <Loader2 className="anim-spin size-4" aria-hidden /> : <FileDown className="size-4" aria-hidden />}{mine ? 'กำลังรวม…' : label}
    </Button>
  );
}

/** การ์ดในหน้ารายงาน: ดาวน์โหลดเอกสารของเคสที่ค้นหาได้ */
export function CaseDocsPanel({ items, label }: { items: Item[]; label: string }) {
  const d = useCaseDocs();
  const files = items.reduce((n, it) => n + caseFiles(it.t, it.svc).length, 0);
  const noForm = items.filter((it) => caseFiles(it.t, it.svc)[0]?.source !== 'form').length;
  const heavy = items.length > 80;
  return (
    <Card data-testid="case-docs">
      <CardHeader title="ดาวน์โหลดเอกสาร (PDF)"
        subtitle={`${items.length} เคส · ${files} ไฟล์ · เรียงตามเลขที่งาน: ใบงาน ICT-xxxx-x ขึ้นก่อน ตามด้วยไฟล์แนบทั้งหมดของเคสนั้น แล้วต่อเคสถัดไป`} />
      <div className="space-y-3 p-5 pt-1">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => d.zip(items, label)} loading={d.busy === 'zip'} disabled={!items.length || (!!d.busy && d.busy !== 'zip')} data-testid="docs-zip">
            <FileArchive className="size-4" aria-hidden />แยกรายเคส (ZIP · 1 PDF ต่อเคส)
          </Button>
          <Button variant="secondary" onClick={() => d.combined(items, label)} loading={d.busy === 'combined'} disabled={!items.length || (!!d.busy && d.busy !== 'combined')} data-testid="docs-combined">
            <Files className="size-4" aria-hidden />รวมทุกเคสเป็น PDF เดียว
          </Button>
        </div>
        {d.progress && <p className="text-sm text-brand-d" aria-live="polite" data-testid="docs-progress">⏳ {d.progress}</p>}
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-sub">
          <li>ต้องการเคสเดียว: กดปุ่ม <b className="text-ink">PDF</b> ท้ายแถวในตารางด้านล่าง หรือในหน้ารายละเอียดเคส</li>
          <li>ไฟล์ Word / Excel / ZIP รวมเข้า PDF ไม่ได้ จะถูกข้าม (แจ้งบนหน้าจอหลังดาวน์โหลด) — แบบ ZIP แนบต้นฉบับไว้ในโฟลเดอร์ <code>เลขที่งาน_attachments</code> ให้</li>
          {noForm > 0 && <li className="text-warn">{noForm} เคสยังไม่มีใบงาน FM-IC-001 — ใน PDF จะมีเฉพาะไฟล์แนบของเคสนั้น</li>}
          {heavy && <li className="text-warn">จำนวนเคสมาก อาจใช้เวลาหลายนาที — แนะนำกรองทีละเดือน และเปิดหน้านี้ค้างไว้จนดาวน์โหลดเสร็จ</li>}
        </ul>
      </div>
    </Card>
  );
}
