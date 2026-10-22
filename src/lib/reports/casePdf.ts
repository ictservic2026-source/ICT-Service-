/**
 * รวมเอกสารของเคสเป็น PDF (ทำในเบราว์เซอร์ทั้งหมด — ไม่ต้องมี Edge Function เพิ่ม)
 *
 * ต่อ 1 เคส เรียงหน้า:
 *   1) ใบงาน FM-IC-001 ที่ generate-pdf สร้าง (ticket-files/tickets/<เลขที่งาน>.pdf)
 *   2) รูปที่ผู้แจ้งแนบ (tickets.issue_img_url)
 *   3) เอกสาร PDF ที่ผู้แจ้งแนบ (tickets.attachment_url)
 *   4) ไฟล์แนบของ ICT (ticket_services.attachment_urls — ไม่รวมใบงานข้อ 1)
 * แล้วต่อด้วยเคสถัดไป (เรียงตามเลขที่งาน)
 *
 * ไม่แทรกหน้าใด ๆ เพิ่ม: มีแค่ใบงานจริงกับไฟล์แนบจริง
 * ไฟล์ Word/Excel/ZIP และไฟล์เสีย → ข้าม แล้วแจ้งบนหน้าจอหลังดาวน์โหลด (โหมด ZIP แนบต้นฉบับไว้ให้)
 * รูป JPG/PNG ฝังตรง · WEBP/GIF/BMP แปลงผ่าน canvas · รูปแนวนอนใช้หน้า A4 แนวนอน
 */
import type { Ticket, TicketService } from '@/types';
import { fileKind, fileNameFromUrl, toArray } from '@/lib/utils/format';

type PDFLib = typeof import('pdf-lib');
type PDFDocument = import('pdf-lib').PDFDocument;

export type DocSource = 'form' | 'user-image' | 'user-doc' | 'ict';
export interface CaseFile { url: string; name: string; source: DocSource }
export interface SkippedFile extends CaseFile { ticketNo: string; reason: string }
export interface CaseBundle { ticketNo: string; pdf: Uint8Array; pages: number; included: CaseFile[]; skipped: SkippedFile[]; hasForm: boolean }
export type Progress = (msg: string) => void;
export type Engine = PDFLib;

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 20;

/** ใบงานที่ generate-pdf สร้าง — path คงที่ tickets/<เลขที่งาน>.pdf */
export const isFormPdf = (url: string, ticketNo: string) =>
  decodeURIComponent(url.split('?')[0]).endsWith(`/tickets/${ticketNo}.pdf`);

/** รายการไฟล์ของเคสตามลำดับที่จะรวม (ตัดลิงก์ซ้ำ) */
export function caseFiles(t: Ticket, svc: TicketService | null | undefined): CaseFile[] {
  const ict = toArray(svc?.attachment_urls);
  const form = ict.find((u) => isFormPdf(u, t.ticket_no));
  const out: CaseFile[] = [];
  const seen = new Set<string>();
  const push = (url: string, source: DocSource) => {
    const key = url.split('?')[0];
    if (!url || seen.has(key)) return;
    seen.add(key);
    out.push({ url, name: fileNameFromUrl(url), source });
  };
  if (form) push(form, 'form');
  toArray(t.issue_img_url).forEach((u) => push(u, 'user-image'));
  toArray(t.attachment_url).forEach((u) => push(u, 'user-doc'));
  ict.filter((u) => u !== form).forEach((u) => push(u, 'ict'));
  return out;
}

export const loadEngine = (): Promise<Engine> => import('pdf-lib');

async function fetchBytes(url: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  // ใบงานใช้ URL เดิมเสมอ (generate-pdf เขียนทับ) → กัน cache ให้ได้ฉบับล่าสุด
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`ดาวน์โหลดไม่ได้ (HTTP ${r.status})`);
  return { bytes: await r.arrayBuffer(), type: r.headers.get('content-type') || '' };
}

/** แปลงรูปชนิดที่ pdf-lib ฝังตรงไม่ได้ (webp/gif/bmp) เป็น PNG ผ่าน canvas */
async function toPng(bytes: ArrayBuffer, type: string): Promise<ArrayBuffer> {
  const bmp = await createImageBitmap(new Blob([bytes], { type: type || 'image/*' }));
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('แปลงรูปไม่ได้'))), 'image/png'));
  return blob.arrayBuffer();
}

/** 1 รูป = 1 หน้า A4 (รูปแนวนอนใช้หน้าแนวนอน) ย่อให้พอดีหน้า ไม่ขยายเกินขนาดจริง */
async function addImagePage(doc: PDFDocument, bytes: ArrayBuffer, type: string) {
  const sig = new Uint8Array(bytes.slice(0, 4));
  const isPng = sig[0] === 0x89 && sig[1] === 0x50;
  const isJpg = sig[0] === 0xff && sig[1] === 0xd8;
  const img = isPng ? await doc.embedPng(bytes) : isJpg ? await doc.embedJpg(bytes) : await doc.embedPng(await toPng(bytes, type));
  const [W, H] = img.width > img.height ? [A4[1], A4[0]] : A4;
  const page = doc.addPage([W, H]);
  const scale = Math.min((W - MARGIN * 2) / img.width, (H - MARGIN * 2) / img.height, 1);
  const w = img.width * scale, h = img.height * scale;
  page.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h });
}

/** ต่อเอกสารของ 1 เคสท้าย doc — ไฟล์ที่เสีย/รวมไม่ได้จะถูกข้าม ไม่ทำให้ทั้งไฟล์ล้ม */
export async function appendCase(
  lib: Engine, doc: PDFDocument, t: Ticket, svc: TicketService | null | undefined, onProgress?: Progress,
): Promise<{ included: CaseFile[]; skipped: SkippedFile[]; hasForm: boolean }> {
  const files = caseFiles(t, svc);
  const included: CaseFile[] = [], skipped: SkippedFile[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress?.(`${t.ticket_no} · ${i + 1}/${files.length} · ${f.name}`);
    const kind = fileKind(f.name);
    if (kind === 'office' || kind === 'other') { skipped.push({ ...f, ticketNo: t.ticket_no, reason: 'ไฟล์ชนิดนี้รวมเข้า PDF ไม่ได้' }); continue; }
    try {
      const { bytes, type } = await fetchBytes(f.url);
      if (kind === 'pdf' || type.includes('pdf')) {
        const src = await lib.PDFDocument.load(bytes, { ignoreEncryption: true });
        (await doc.copyPages(src, src.getPageIndices())).forEach((p) => doc.addPage(p));
      } else {
        await addImagePage(doc, bytes, type);
      }
      included.push(f);
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      skipped.push({ ...f, ticketNo: t.ticket_no, reason: m.startsWith('ดาวน์โหลด') ? m : kind === 'pdf' ? 'ไฟล์ PDF เสียหรือมีรหัสผ่าน' : 'ไฟล์รูปเสียหรือเปิดไม่ได้' });
    }
  }
  return { included, skipped, hasForm: files[0]?.source === 'form' };
}

/** PDF รวมของเคสเดียว */
export async function buildCasePdf(lib: Engine, t: Ticket, svc: TicketService | null | undefined, onProgress?: Progress): Promise<CaseBundle> {
  const doc = await lib.PDFDocument.create();
  doc.setTitle(t.ticket_no);
  const r = await appendCase(lib, doc, t, svc, onProgress);
  return { ticketNo: t.ticket_no, pdf: await doc.save(), pages: doc.getPageCount(), ...r };
}

/** PDF ไฟล์เดียวรวมหลายเคส (เช่น ทั้งเดือน) — ส่ง items ที่เรียงแล้ว */
export async function buildCombinedPdf(
  lib: Engine, items: { t: Ticket; svc: TicketService | null | undefined }[], title: string, onProgress?: Progress,
): Promise<{ pdf: Uint8Array; pages: number; skipped: SkippedFile[]; noForm: string[] }> {
  const doc = await lib.PDFDocument.create();
  doc.setTitle(title);
  const skipped: SkippedFile[] = [], noForm: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const r = await appendCase(lib, doc, items[i].t, items[i].svc, (m) => onProgress?.(`เคส ${i + 1}/${items.length} · ${m}`));
    skipped.push(...r.skipped);
    if (!r.hasForm) noForm.push(items[i].t.ticket_no);
  }
  return { pdf: await doc.save(), pages: doc.getPageCount(), skipped, noForm };
}

/** ZIP: 1 PDF ต่อเคส + ต้นฉบับไฟล์ที่รวมเข้า PDF ไม่ได้ ในโฟลเดอร์ <เลขที่งาน>_attachments */
export async function buildZip(
  lib: Engine, items: { t: Ticket; svc: TicketService | null | undefined }[], onProgress?: Progress,
): Promise<{ zip: Uint8Array; cases: number; skipped: SkippedFile[]; noForm: string[] }> {
  const { zipSync } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};
  const skipped: SkippedFile[] = [], noForm: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const { t, svc } = items[i];
    const b = await buildCasePdf(lib, t, svc, (m) => onProgress?.(`เคส ${i + 1}/${items.length} · ${m}`));
    if (b.pages) entries[`${t.ticket_no}.pdf`] = b.pdf;
    if (!b.hasForm) noForm.push(t.ticket_no);
    for (const s of b.skipped) {
      try {
        const { bytes } = await fetchBytes(s.url);
        entries[`${t.ticket_no}_attachments/${s.name}`] = new Uint8Array(bytes);
      } catch { skipped.push(s); }
    }
  }
  onProgress?.('กำลังบีบอัด ZIP…');
  return { zip: zipSync(entries, { level: 0 }), cases: items.length, skipped, noForm };
}

export function saveBytes(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
