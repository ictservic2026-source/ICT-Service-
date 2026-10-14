/**
 * กติกาเดียวของ "ข้อความที่ต้องแจ้งเตือน" — ใช้ทั้งกระดิ่ง (นับ) และ TicketModal (ทำเครื่องหมายอ่านแล้ว)
 * เดิมสองที่เขียนเงื่อนไขแยกกัน ถ้าไม่ตรงกันตัวเลขบนกระดิ่งจะค้างถาวร
 */
import type { CommentRead, Profile, TicketLog } from '@/types';

/** คอมเมนต์/บันทึกภายในของคนอื่น ที่ส่งถึงทั้งทีม หรือแท็กถึงบทบาทของเรา */
export function isNotificationFor(l: TicketLog, user: Pick<Profile, 'display_name' | 'role'>): boolean {
  return (l.status === 'COMMENT' || l.status === 'INTERNAL_NOTE')
    && l.action_by !== user.display_name
    && (!l.mentioned_role || l.mentioned_role === user.role);
}

export function unreadNotifications(
  logs: TicketLog[], user: Pick<Profile, 'display_name' | 'role'>, readIds: ReadonlySet<number>,
): TicketLog[] {
  return logs.filter((l) => isNotificationFor(l, user) && !readIds.has(l.id));
}

export function readReceipts(logs: TicketLog[], user: Profile): Omit<CommentRead, 'read_at'>[] {
  return logs.map((l) => ({ log_id: l.id, user_id: user.id, reader_name: user.display_name, reader_role: user.role }));
}
