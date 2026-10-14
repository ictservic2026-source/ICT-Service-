'use client';
import { useEffect, useMemo } from 'react';
import { useAppCtx, type Services } from '@/components/providers/AppProvider';
import { buildDashData } from '@/lib/analytics/dashboard';

export function useServices(): Services | null { return useAppCtx().services; }
export function useSession() {
  const { user, setUser, services } = useAppCtx();
  return {
    user, setUser,
    async signOut() { await services?.auth.signOut(); setUser(null); },
  };
}
export function useTheme() { const { dark, toggleTheme } = useAppCtx(); return { dark, toggleTheme }; }
export function useToast() {
  const { pushToast } = useAppCtx();
  return useMemo(() => ({
    success: (t: string) => pushToast('success', t),
    error: (t: string) => pushToast('error', t),
    info: (t: string) => pushToast('info', t),
  }), [pushToast]);
}
export function useConfirm() { return useAppCtx().confirm; }

/** โหลด snapshot ทั้งระบบ (ตั๋ว/งาน/log/ประเมิน) สำหรับหน้า staff, dashboard, report */
export function useSnapshot() {
  const { snapshot, snapshotError, loadingSnapshot, ensureSnapshot, refresh, services } = useAppCtx();
  useEffect(() => { ensureSnapshot(); }, [ensureSnapshot]);
  return { snapshot, error: snapshotError, loading: loadingSnapshot || (!snapshot && !snapshotError), refresh, services };
}

export function useDashData() {
  const { snapshot, ...rest } = useSnapshot();
  const data = useMemo(() => snapshot ? buildDashData(snapshot.tickets, snapshot.services, snapshot.logs, snapshot.surveys) : null, [snapshot]);
  return { data, snapshot, ...rest };
}
