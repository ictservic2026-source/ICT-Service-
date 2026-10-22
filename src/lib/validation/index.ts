/**
 * Input validation (ฝั่ง client + ใช้ซ้ำใน service layer) — ไม่พึ่ง library ภายนอก
 * หมายเหตุ XSS: React escape ข้อความให้อัตโนมัติ และไม่มีการใช้ dangerouslySetInnerHTML ในโปรเจกต์นี้
 */
import { ALLOWED_UPLOAD_EXT, MAX_UPLOAD_MB } from '@/lib/constants';
import type { NewTicketInput } from '@/types';

export type Errors<K extends string = string> = Partial<Record<K, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// ตัดอักขระควบคุม (ยกเว้น \n \t) ออกจากข้อความที่ผู้ใช้พิมพ์
// eslint-disable-next-line no-control-regex
const CTRL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(s: string | null | undefined, max = 2000): string {
  return (s ?? '').replace(CTRL_RE, '').trim().slice(0, max);
}

export const REQUEST_LABELS = {
  requester_name: 'ชื่อ-นามสกุล',
  department: 'ฝ่าย / แผนก',
  location: 'สถานที่ดำเนินการ',
  required_date: 'วันที่ต้องการ',
  issue_detail: 'อาการปัญหา / ความต้องการ',
  requester_email: 'อีเมลของท่าน',
  manager_email: 'อีเมลหัวหน้างาน',
} as const;
export type RequestField = keyof typeof REQUEST_LABELS | 'asset_id';

export function validateRequest(i: Partial<NewTicketInput>): Errors<RequestField> {
  const e: Errors<RequestField> = {};
  (Object.keys(REQUEST_LABELS) as (keyof typeof REQUEST_LABELS)[]).forEach((k) => {
    if (!sanitizeText(i[k] as string)) e[k] = `กรุณากรอก "${REQUEST_LABELS[k]}"`;
  });
  if (!e.requester_email && !EMAIL_RE.test(i.requester_email!.trim())) e.requester_email = 'รูปแบบอีเมลไม่ถูกต้อง';
  if (!e.manager_email && !EMAIL_RE.test(i.manager_email!.trim())) e.manager_email = 'รูปแบบอีเมลหัวหน้างานไม่ถูกต้อง';
  // อีเมลหัวหน้างานซ้ำกับผู้แจ้งได้ (เช่น หัวหน้าแจ้งเอง) — เปิดใช้ตาม migration 004
  if (!e.required_date && isNaN(new Date(i.required_date!).getTime())) e.required_date = 'วันที่ไม่ถูกต้อง';
  if ((i.issue_detail || '').length > 500) e.issue_detail = 'ยาวเกิน 500 ตัวอักษร';
  if ((i.asset_id || '').length > 60) e.asset_id = 'รหัสทรัพย์สินยาวเกินไป';
  return e;
}

export function cleanRequest(i: NewTicketInput): NewTicketInput {
  return {
    ...i,
    requester_name: sanitizeText(i.requester_name, 120),
    department: sanitizeText(i.department, 60),
    location: sanitizeText(i.location, 160),
    asset_id: sanitizeText(i.asset_id, 60) || null,
    issue_detail: sanitizeText(i.issue_detail, 500),
    requester_email: sanitizeText(i.requester_email, 160).toLowerCase(),
    manager_email: sanitizeText(i.manager_email, 160).toLowerCase(),
  };
}

export function validateFile(f: { name: string; size: number }): string | null {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_UPLOAD_EXT.includes(ext)) return `ไม่รองรับไฟล์ .${ext} (${f.name})`;
  if (f.size > MAX_UPLOAD_MB * 1024 * 1024) return `ไฟล์ใหญ่เกิน ${MAX_UPLOAD_MB} MB (${f.name})`;
  return null;
}

export function validateEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export function validatePassword(p: string): string | null {
  if (p.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  return null;
}
