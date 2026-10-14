'use client';
import Link from 'next/link';
import { BarChart3, ClipboardList, Clock, FlaskConical, LogIn, Mail, ShieldCheck, Wrench } from 'lucide-react';
import { PublicShell } from '@/components/layout/PublicShell';
import { useServices } from '@/hooks';

export default function Home() {
  const s = useServices();
  return (
    <PublicShell wide right={<Link href="/login" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-sub hover:bg-surface-3 hover:text-ink sm:inline-flex"><LogIn className="size-4" />เจ้าหน้าที่</Link>}>
      <section className="bg-gradient-to-br from-navy to-navy-2 px-5 pt-14 pb-20 text-center">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs text-slate-200"><Wrench className="size-3.5" />ICT Service / Repair Request System</p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">แจ้งปัญหาการใช้งาน IT</h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-300">กรอกข้อมูลให้ครบถ้วน ทีม ICT จะติดต่อกลับภายใน 1 วันทำการ</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5 text-[13px] text-slate-300">
          {[[Clock, 'ตอบกลับภายใน 1 วัน'], [Mail, 'ได้รับอีเมลยืนยันทันที'], [ShieldCheck, 'ข้อมูลปลอดภัย']].map(([I, t]) => {
            const Icon = I as typeof Clock;
            return <span key={t as string} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1"><Icon className="size-3.5" />{t as string}</span>;
          })}
        </div>
        <Link href="/request" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-7 text-[15px] font-semibold text-on-brand shadow-pop transition hover:brightness-110">
          <ClipboardList className="size-5" />แจ้งปัญหา / ขอรับบริการ
        </Link>
      </section>

      <section className="mx-auto -mt-10 grid max-w-5xl gap-4 px-4 pb-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
        <Card href="/login" icon={<LogIn />} title="เจ้าหน้าที่ ICT / ITL / IT Manager" text="เข้าสู่ระบบเพื่อรับงาน บันทึกผล อนุมัติ และปิดงาน" />
        <Card href="/dashboard" icon={<BarChart3 />} title="Dashboard & รายงาน" text="ภาพรวมงาน ค่าใช้จ่าย ความพึงพอใจ และส่งออก Excel" />
        {s?.source === 'mock' && <Card href="/demo" icon={<FlaskConical />} title="ศูนย์ทดสอบ (Demo Hub)" text="สลับบทบาท ดูอีเมลจำลอง ทดสอบ workflow ทุกเส้นทาง" accent />}
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-8">
        <h2 className="mb-4 text-center text-sm font-semibold tracking-wide text-sub uppercase">ขั้นตอนการทำงาน</h2>
        <ol className="grid gap-3 sm:grid-cols-5">
          {['ผู้แจ้งส่งคำขอ', 'หัวหน้างานอนุมัติ (ลิงก์ในอีเมล)', 'ICO ดำเนินการ', 'ITL ตรวจ → IT Manager อนุมัติ', 'ปิดงาน + ประเมินความพึงพอใจ'].map((t, i) => (
            <li key={t} className="rounded-xl border border-line bg-surface p-4 text-center text-sm">
              <span className="num mx-auto mb-2 flex size-8 items-center justify-center rounded-full bg-brand-pale font-semibold text-brand-d">{i + 1}</span>{t}
            </li>
          ))}
        </ol>
      </section>
    </PublicShell>
  );
}

function Card({ href, icon, title, text, accent }: { href: string; icon: React.ReactNode; title: string; text: string; accent?: boolean }) {
  return (
    <Link href={href} className={`group rounded-2xl border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop ${accent ? 'border-warn/50' : 'border-line'}`}>
      <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-brand-pale text-brand-d [&>svg]:size-5">{icon}</span>
      <h3 className="font-semibold text-ink group-hover:text-brand-d">{title}</h3>
      <p className="mt-1 text-sm text-sub">{text}</p>
    </Link>
  );
}
