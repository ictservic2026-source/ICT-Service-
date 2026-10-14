/** เลขตั๋วรูปแบบ ICT-YYMM-N (N = running ต่อเดือน) — ตรรกะเดียวกับ prefix()/nextSeq() ใน index.js เดิม */
export function ticketPrefix(now: Date = new Date()): string {
  return `ICT-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function nextTicketNo(existing: string[], now: Date = new Date()): string {
  const p = ticketPrefix(now);
  const max = existing
    .filter((n) => n.startsWith(p + '-'))
    .reduce((m, n) => Math.max(m, parseInt(n.split('-').pop() || '0', 10) || 0), 0);
  return `${p}-${max + 1}`;
}
