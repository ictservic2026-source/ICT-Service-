/**
 * สร้าง Secure Random Token สำหรับลิงก์สาธารณะ (/approve/[token], /survey/[token], /track/[token])
 * ใช้ Web Crypto (ทำงานทั้งใน browser และ Node 19+) — 24 ไบต์ = 192 bit entropy → เดาไม่ได้
 */
export function makeToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  const c: Crypto | undefined = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) c.getRandomValues(arr);
  else throw new Error('Secure random generator not available');
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isWellFormedToken(t: string): boolean {
  return /^[a-f0-9]{32,96}$/.test(t);
}
