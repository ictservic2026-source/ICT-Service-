'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Target } from 'lucide-react';
import { ROLE_PORTAL } from '@/lib/constants';
import { fmtDateTime } from '@/lib/utils/format';
import { unreadNotifications, readReceipts } from '@/lib/notifications';
import { useSession, useSnapshot, useToast } from '@/hooks';
import type { TicketLog } from '@/types';

/** กระดิ่งแจ้งเตือนคอมเมนต์ใหม่ (notify.js เดิม): ข้อความของคนอื่นที่แท็กถึงเรา/ทั้งทีม และเรายังไม่อ่าน */
export function NotifyBell() {
  const { user } = useSession();
  const { snapshot, services } = useSnapshot();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setReadIds(new Set()); }, [user?.id]); // สลับบัญชี → เริ่มนับใหม่

  useEffect(() => {
    if (!user || !services) return;
    let alive = true;
    // รวมกับค่าเดิม (ไม่แทนที่): การอ่านไม่มีวันถูกลบ และกันรีเฟรชเบื้องหลังทับการกดอ่านที่ยังบันทึกไม่เสร็จ
    services.repo.getMyReadLogIds(user.id)
      .then((ids) => { if (alive) setReadIds((prev) => new Set([...prev, ...ids])); })
      .catch((e) => console.error('[notify] load reads', e));
    return () => { alive = false; };
  }, [user, services, snapshot]);

  useEffect(() => {
    const on = (e: MouseEvent) => { if (open && box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, [open]);

  const unread = useMemo(() => {
    if (!snapshot || !user) return [];
    return unreadNotifications(snapshot.logs, user, readIds).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [snapshot, user, readIds]);

  /** ทำเครื่องหมายอ่านแล้วทันที (ตัวเลขลดลงก่อนรอเครือข่าย) — ถ้าบันทึกไม่สำเร็จจะคืนค่าและแจ้งผู้ใช้ */
  const markRead = useCallback(async (logs: TicketLog[]) => {
    if (!user || !services || !logs.length) return;
    const ids = logs.map((l) => l.id);
    setReadIds((prev) => new Set([...prev, ...ids]));
    try {
      await services.repo.markRead(readReceipts(logs, user));
    } catch (e) {
      setReadIds((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
      console.error('[notify] markRead', e);
      toast.error('บันทึกสถานะ "อ่านแล้ว" ไม่สำเร็จ กรุณาลองใหม่');
    }
  }, [user, services, toast]);

  if (!user) return null;
  const shown = unread.slice(0, 50);

  function openTicket(no: string) {
    setOpen(false);
    void markRead(unread.filter((l) => l.ticket_no === no));
    router.push(`${ROLE_PORTAL[user!.role]}?open=${encodeURIComponent(no)}&tab=log`);
  }

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label={`การแจ้งเตือน ${unread.length} รายการ`} data-testid="bell"
        className="relative rounded-lg p-2 text-sub transition hover:bg-surface-3 hover:text-ink">
        <Bell className="size-5" />
        {unread.length > 0 && (
          <span data-testid="bell-badge" className="num absolute top-0.5 right-0.5 min-w-4 rounded-full bg-err px-1 text-center text-[10px] leading-4 font-bold text-white">{unread.length > 99 ? '99+' : unread.length}</span>
        )}
      </button>
      {open && (
        <div className="anim-pop absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-line bg-surface shadow-modal" role="menu">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-xs font-semibold">🔔 ข้อความใหม่ ({unread.length})</p>
            {unread.length > 0 && (
              <button type="button" onClick={() => void markRead(unread)} data-testid="bell-read-all"
                className="rounded text-xs font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">อ่านทั้งหมด</button>
            )}
          </div>
          {shown.length === 0 ? <p className="px-4 py-8 text-center text-sm text-mute">ไม่มีข้อความใหม่ 🎉</p> : shown.map((l) => (
            <button key={l.id} role="menuitem" onClick={() => openTicket(l.ticket_no)}
              className="block w-full border-b border-line/60 px-4 py-2.5 text-left hover:bg-surface-2">
              <p className="num text-xs font-bold text-brand-d">{l.ticket_no}{l.mentioned_role && <span className="ml-2 inline-flex items-center gap-0.5 text-err"><Target className="size-3" />ถึง {l.mentioned_role}</span>}</p>
              <p className="mt-0.5 line-clamp-2 text-[13px]"><b>{l.action_by}</b>: {l.comment}</p>
              <p className="mt-0.5 text-[11px] text-mute">{fmtDateTime(l.created_at)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
