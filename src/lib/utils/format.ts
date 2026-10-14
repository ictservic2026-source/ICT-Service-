/** Utilities รูปแบบวันที่/ตัวเลขแบบไทย — ย้ายจาก fmtD / fmtDT / v2n เดิม */

export function fmtDate(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function fmtShortDate(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

/** dd/mm/พ.ศ. hh:mm น. — เหมือน fmtDT ใน admin-ico.js */
export function fmtDateTime(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear() + 543} ${p(d.getHours())}:${p(d.getMinutes())} น.`;
}

export function fmtMoney(n?: number | string | null): string {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

export function fmtBaht(n?: number | string | null): string {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (v == null || isNaN(v) || v === 0) return '฿ 0';
  return '฿' + v.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

export function initials(name?: string | null): string {
  return (name || '?').split(' ').map((w) => w[0] || '').slice(0, 2).join('').toUpperCase() || '?';
}

export function daysBetween(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function hoursBetween(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.max(0, (b - a) / 3600000);
}

/** แปลง Postgres array literal "{a,b}" (ที่ PostgREST อาจส่งมาเป็น string) → string[] — ย้ายจาก toArr/toArray เดิม */
export function toArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean) as string[];
  if (typeof v === 'string') {
    if (v.startsWith('{')) {
      return v.slice(1, -1).split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    }
    return [v];
  }
  return [];
}

export function fileNameFromUrl(url: string): string {
  try {
    // data:/blob: URL (โหมด Mock) แนบชื่อเดิมไว้ท้ายสุดในรูป "#name=<ชื่อ>"
    const m = url.match(/#name=(.+)$/);
    if (m) return decodeURIComponent(m[1]);
    return decodeURIComponent(url.split('#')[0].split('?')[0].split('/').pop() || url);
  } catch {
    return url;
  }
}

export function fileKind(name: string): 'image' | 'pdf' | 'office' | 'other' {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
  return 'other';
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** ปีงบ/เดือนแบบย่อภาษาไทย */
export const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export function gradeOf(total: number): { label: string; tone: 'green' | 'amber' | 'red' } {
  if (total >= 90) return { label: '🏆 ดีเยี่ยม', tone: 'green' };
  if (total >= 75) return { label: '🎯 ดีมาก', tone: 'green' };
  if (total >= 60) return { label: '👍 ดี', tone: 'amber' };
  if (total >= 50) return { label: '😐 พอใช้', tone: 'amber' };
  return { label: '⚠️ ควรปรับปรุง', tone: 'red' };
}
