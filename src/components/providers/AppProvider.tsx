'use client';
/**
 * AppProvider — จุดเดียวที่ประกอบ Services (Repository / Auth / Actions / Automation), Session, Theme, Toast, Confirm และ Snapshot store
 * หน้าทุกหน้าใช้ผ่าน hooks ใน src/hooks (useServices, useSession, useSnapshot, useToast, useConfirm, useTheme)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Profile } from '@/types';
import { getAutomation, type AutomationService } from '@/lib/automation';
import { configProblem, dataSource, getActions, getAuth, getRepository, type DataSource } from '@/lib/services';
import type { AuthService, Repository, Snapshot } from '@/lib/services/repository';
import type { TicketActions } from '@/lib/services/ticketActions';
import { ToastViewport, type ToastItem } from '@/components/ui/Toast';
import { ConfirmDialog, type ConfirmOptions } from '@/components/ui/ConfirmDialog';

export interface Services {
  repo: Repository;
  auth: AuthService;
  actions: TicketActions;
  automation: AutomationService;
  source: DataSource;
}

interface Ctx {
  services: Services | null;
  user: Profile | null | undefined; // undefined = กำลังตรวจสอบ session
  setUser: (u: Profile | null) => void;
  snapshot: Snapshot | null;
  snapshotError: string | null;
  loadingSnapshot: boolean;
  ensureSnapshot: () => void;
  refresh: () => Promise<void>;
  dark: boolean;
  toggleTheme: () => void;
  toasts: ToastItem[];
  pushToast: (kind: ToastItem['kind'], text: string) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const AppCtx = createContext<Ctx | null>(null);
export function useAppCtx(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppProvider missing');
  return c;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<Services | null>(null);
  const [user, setUser] = useState<Profile | null | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [loadingSnapshot, setLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const wanted = useRef(false);
  const seq = useRef(0);

  // สร้าง services ฝั่ง client เท่านั้น (Mock ใช้ localStorage)
  useEffect(() => {
    const problem = configProblem();
    if (problem) { setConfigError(problem); setUser(null); return; }
    const s: Services = { repo: getRepository(), auth: getAuth(), actions: getActions(), automation: getAutomation(), source: dataSource() };
    setServices(s);
    setDark(document.documentElement.classList.contains('dark'));
    s.auth.getSession().then(setUser).catch(() => setUser(null));
  }, []);

  const errRef = useRef(false);
  const snapRef = useRef<Snapshot | null>(null);
  const inflight = useRef(false);

  /** โหลด snapshot. ครั้งแรกแสดง loading; รอบหลัง (กลับเข้าแท็บ/ทุก 30 วิ/กดรีเฟรช) อัปเดตเงียบๆ ไม่ล้างหน้าจอ
   *  และไม่ set state ถ้าข้อมูลไม่เปลี่ยน เพื่อไม่ให้หน้า re-render/กะพริบโดยไม่จำเป็น */
  const refresh = useCallback(async () => {
    if (!services) return;
    const my = ++seq.current;
    const first = !snapRef.current;
    inflight.current = true;
    if (first) setLoading(true);
    try {
      const snap = await services.repo.snapshot();
      if (my !== seq.current) return; // มี refresh ใหม่กว่า — ทิ้งผลรอบนี้
      services.actions.wsMaster = snap.workStatus;
      const prev = snapRef.current;
      if (!prev || JSON.stringify(prev) !== JSON.stringify(snap)) { snapRef.current = snap; setSnapshot(snap); }
      errRef.current = false; setSnapshotError(null);
    } catch (e) {
      if (my === seq.current) { errRef.current = true; setSnapshotError(e instanceof Error ? e.message : String(e)); }
    } finally {
      if (my === seq.current) { inflight.current = false; setLoading(false); }
    }
  }, [services]);

  // เรียกซ้ำได้โดยไม่วนลูป: ไม่โหลดซ้ำถ้ามี snapshot แล้ว / กำลังโหลด / เพิ่งโหลดล้มเหลว (ให้กดรีเฟรชเองแทน)
  const ensureSnapshot = useCallback(() => {
    wanted.current = true;
    if (services && !snapRef.current && !inflight.current && !errRef.current) void refresh();
  }, [services, refresh]);

  // รีเฟรชเมื่อกลับมาที่แท็บ / เมื่อแท็บอื่นแก้ localStorage (Mock) / ทุก 30 วิ (ใช้กับ Supabase)
  useEffect(() => {
    if (!services) return;
    const onVis = () => { if (document.visibilityState === 'visible' && wanted.current) void refresh(); };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ict-mock-db-v1' && wanted.current) { location.reload(); }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('storage', onStorage);
    const iv = services.source === 'supabase' ? window.setInterval(() => { if (wanted.current && document.visibilityState === 'visible') void refresh(); }, 30000) : 0;
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', onStorage);
      if (iv) clearInterval(iv);
    };
  }, [services, refresh]);

  const toggleTheme = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('ict-theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
    setDark(next);
  }, []);

  const pushToast = useCallback((kind: ToastItem['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })), []);

  const value = useMemo<Ctx>(() => ({
    services, user, setUser, snapshot, snapshotError, loadingSnapshot, ensureSnapshot, refresh, dark, toggleTheme, toasts, pushToast, confirm,
  }), [services, user, snapshot, snapshotError, loadingSnapshot, ensureSnapshot, refresh, dark, toggleTheme, toasts, pushToast, confirm]);

  if (configError) return <ConfigErrorScreen message={configError} />;
  return (
    <AppCtx.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      {confirmState && (
        <ConfirmDialog
          {...confirmState}
          onResult={(v) => { confirmState.resolve(v); setConfirmState(null); }}
        />
      )}
    </AppCtx.Provider>
  );
}

/** แสดงเมื่อยังไม่ได้ตั้งค่าเชื่อม Supabase — ไม่แอบใช้ข้อมูลจำลอง */
function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-10" data-testid="config-error">
      <h1 className="text-xl font-semibold text-ink">ยังไม่ได้เชื่อมต่อฐานข้อมูล Supabase</h1>
      <p className="text-sm text-sub">{message}</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink">
        <li>คัดลอกไฟล์ <code className="rounded bg-surface-3 px-1.5 py-0.5">.env.example</code> เป็น <code className="rounded bg-surface-3 px-1.5 py-0.5">.env.local</code></li>
        <li>ใส่ <b>Project URL</b> และ <b>anon public key</b> จาก Supabase → Project Settings → API (ห้ามใช้ service_role key)</li>
        <li>รัน <code className="rounded bg-surface-3 px-1.5 py-0.5">npm run check:db</code> เพื่อตรวจว่าตารางและสิทธิ์พร้อมใช้งาน</li>
        <li>เริ่มระบบใหม่ด้วย <code className="rounded bg-surface-3 px-1.5 py-0.5">npm run dev</code></li>
      </ol>
    </main>
  );
}
