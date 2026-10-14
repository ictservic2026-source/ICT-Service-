'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, RotateCcw, Trash2, UserCog } from 'lucide-react';
import type { AutomationReceipt } from '@/types';
import { ROLE_LABEL, ROLE_PORTAL } from '@/lib/constants';
import { fmtDateTime } from '@/lib/utils/format';
import { useServices, useSession, useToast, useConfirm } from '@/hooks';
import { useAppCtx } from '@/components/providers/AppProvider';
import { StaffShell } from '@/components/layout/StaffShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

const STEPS = [
  ['1', 'ผู้แจ้ง (ไม่ต้อง Login)', 'ส่งคำขอที่ /request → ได้เลขที่ + ลิงก์ติดตาม', '/request'],
  ['2', 'หัวหน้างาน', 'เปิดลิงก์อนุมัติจากอีเมลจำลองด้านล่าง → อนุมัติ/ไม่อนุมัติ + ลายเซ็น', ''],
  ['3', 'ICO', 'บันทึกงาน → ส่ง ITL (หรือส่งตรง ITL)', '/ico'],
  ['4', 'ITL', 'ตรวจสอบ → อนุมัติ / ตีกลับ ICO', '/itl'],
  ['5', 'IT Manager', 'อนุมัติ / ยกเลิก / ตีกลับ', '/itm'],
  ['6', 'ICO ปิดงาน', 'ปิดงานแล้วระบบสร้างลิงก์แบบประเมิน', '/ico'],
  ['7', 'ผู้แจ้งประเมิน', 'เปิดลิงก์ประเมินจากอีเมลจำลอง', ''],
] as const;

export default function DemoPage() {
  const sv = useServices();
  const { user, setUser } = useSession();
  const { refresh } = useAppCtx();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [box, setBox] = useState<AutomationReceipt[]>([]);
  useEffect(() => {
    if (!sv) return;
    const load = () => setBox([...sv.automation.listOutbox()].reverse());
    load();
    return sv.automation.subscribe(load);
  }, [sv]);

  async function switchTo(email: string) {
    if (!sv) return;
    const u = await sv.auth.signIn(email, 'demo1234');
    setUser(u); router.push(ROLE_PORTAL[u.role]);
  }
  async function reset() {
    if (!sv?.repo.resetDemo) return;
    if (!(await confirm({ title: 'รีเซ็ตข้อมูลตัวอย่าง?', message: 'ข้อมูลที่ทดลองสร้างทั้งหมดจะถูกแทนที่ด้วยข้อมูลเริ่มต้น', confirmText: 'รีเซ็ต', tone: 'danger' }))) return;
    await sv.repo.resetDemo(); sv.automation.clearOutbox(); await refresh(); toast.success('รีเซ็ตข้อมูลตัวอย่างแล้ว');
  }
  const accounts = sv?.auth.demoAccounts?.() ?? [];

  return (
    <StaffShell roles={['ICO', 'ITL', 'ITM']} title="ศูนย์ทดสอบ (Demo)" subtitle="สลับบทบาท ดูอีเมลจำลอง และรีเซ็ตข้อมูล" wide>
      {sv?.source !== 'mock' ? <Card><EmptyState title="หน้านี้ใช้ได้เฉพาะโหมด Mock" hint="ตั้ง NEXT_PUBLIC_DATA_SOURCE=mock" /></Card> : (
        <div className="grid gap-4 lg:grid-cols-3" data-testid="demo-hub">
          <div className="space-y-4">
            <Card>
              <CardHeader icon={<UserCog className="size-4" />} title="สลับบทบาท" subtitle="รหัสผ่านทุกบัญชี: demo1234" />
              <ul className="divide-y divide-line">{accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.display_name}</p><p className="truncate text-xs text-mute">{a.email}</p></div>
                  <Badge tone={a.role === 'ITM' ? 'cyan' : a.role === 'ITL' ? 'orange' : 'purple'}>{ROLE_LABEL[a.role]}</Badge>
                  <Button size="sm" variant={user?.id === a.id ? 'ghost' : 'secondary'} disabled={user?.id === a.id} onClick={() => switchTo(a.email)} data-testid={`switch-${a.email.split('@')[0]}`}>{user?.id === a.id ? 'ปัจจุบัน' : 'สลับ'}</Button></li>))}</ul>
            </Card>
            <Card>
              <CardHeader title="ข้อมูลตัวอย่าง" />
              <div className="space-y-2 p-5"><Button variant="danger" block onClick={reset} data-testid="reset-demo"><RotateCcw className="size-4" />รีเซ็ตเป็นข้อมูลเริ่มต้น</Button>
                <Link href="/request" className="block"><Button variant="secondary" block>➕ สร้างคำขอใหม่ (ผู้แจ้ง)</Button></Link></div>
            </Card>
            <Card>
              <CardHeader title="ลำดับการทดสอบ Workflow" />
              <ol className="space-y-2.5 p-5">{STEPS.map(([n, who, what, href]) => (
                <li key={n} className="flex gap-3 text-sm"><span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-pale text-xs font-bold text-brand-d">{n}</span><span><b>{who}</b><br /><span className="text-sub">{what}</span>{href && <> · <Link href={href} className="text-brand-d underline">ไปหน้านี้</Link></>}</span></li>))}</ol>
            </Card>
          </div>
          <Card className="lg:col-span-2" data-testid="outbox">
            <CardHeader icon={<Mail className="size-4" />} title="Automation Outbox (อีเมล/แจ้งเตือนจำลอง)" subtitle={`โหมด: ${sv.automation.mode} · ${box.length} เหตุการณ์ · สลับเป็น n8n ได้ด้วย env โดยไม่แก้ UI`}
              action={<Button size="sm" variant="ghost" onClick={() => sv.automation.clearOutbox()} data-testid="clear-outbox"><Trash2 className="size-4" />ล้าง</Button>} />
            {box.length === 0 ? <EmptyState icon="📭" title="ยังไม่มีอีเมลจำลอง" hint="ลองส่งคำขอหรือดำเนินการในขั้นตอนต่างๆ" /> : (
              <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">{box.map((r) => (
                <li key={r.id} className="px-5 py-3" data-testid="outbox-item">
                  <div className="flex flex-wrap items-center gap-2 text-xs"><Badge tone="brand">{r.event}</Badge><Link href={`${ROLE_PORTAL[user?.role ?? 'ICO']}?open=${r.ticket_no}`} className="num font-bold text-brand-d">{r.ticket_no}</Link><span className="text-mute">{fmtDateTime(r.at)}</span><Badge tone={r.workflowStatus === 'Workflow Completed' ? 'green' : 'red'}>{r.workflowStatus}</Badge></div>
                  {r.messages.map((m, i) => (
                    <div key={i} className="mt-2 rounded-xl border border-line bg-surface-2 p-3 text-xs">
                      <p><b>{m.channel === 'email' ? '✉️' : '🔔'} {m.subject}</b> <span className="text-mute">→ {m.to}</span> <Badge tone="green">{m.statusLabel}</Badge></p>
                      <p className="mt-1 whitespace-pre-wrap text-sub">{m.body}</p>
                      {m.links?.map((l) => { let p = l.href; try { const u = new URL(l.href); p = u.pathname + u.search; } catch { /* relative */ } return <Link key={l.href} href={p} className="mt-1.5 mr-3 inline-block font-semibold text-brand-d underline">{l.label} →</Link>; })}
                    </div>))}
                </li>))}</ul>)}
          </Card>
        </div>
      )}
    </StaffShell>
  );
}
