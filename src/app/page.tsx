import Link from 'next/link';
import { ArrowRight, LogIn, Plus, Search } from 'lucide-react';
import { PublicShell } from '@/components/layout/PublicShell';
import { TrackLookup } from '@/components/portal/TrackLookup';

/** ขั้นตอนหลังแจ้งปัญหา (ตาม workflow: OPEN → หัวหน้าอนุมัติ → ICO/ITL/ITM → DONE → แบบประเมิน) */
const STEPS = [
  { title: 'แจ้งปัญหา', desc: 'ได้เลขที่งานและลิงก์ติดตามทันที' },
  { title: 'หัวหน้างานอนุมัติ', desc: 'ผ่านลิงก์อนุมัติ' },
  { title: 'ทีม ICT ดำเนินการ', desc: 'ICO → ITL → IT Manager' },
  { title: 'ประเมินความพึงพอใจ', desc: 'หลังปิดงาน' },
];

/** หน้าแรกสาธารณะ — ผู้แจ้งเลือก "แจ้งปัญหาใหม่" หรืออ่านวิธีติดตามงาน; เจ้าหน้าที่เข้าสู่ระบบจากมุมขวาบน */
export default function HomePage() {
  return (
    <PublicShell
      right={
        <>
          <Link href="/request" className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-brand-d hover:bg-brand-pale sm:inline-flex">
            แจ้งปัญหา
          </Link>
          <Link href="/login" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:border-brand hover:text-brand-d">
            <LogIn className="size-4" aria-hidden />
            เจ้าหน้าที่ IT
          </Link>
        </>
      }
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12" data-testid="landing">
        {/* ───── Hero ───── */}
        <section>
          <span className="tone-blue inline-flex rounded-full px-3 py-0.5 text-xs font-semibold">แผนก ICT · ตอบกลับภายใน 1 วันทำการ</span>
          <h1 className="mt-4 text-[26px] leading-tight font-bold text-ink sm:text-[34px]">
            มีปัญหาเรื่องคอมพิวเตอร์ โปรแกรม หรือเครือข่าย
            <br className="hidden sm:block" /> แจ้งทีม ICT ได้ที่นี่
          </h1>
          <p className="mt-3 max-w-2xl text-base text-sub">
            กรอกแบบฟอร์ม 2 ขั้นตอน ระบบจะส่งคำขอให้หัวหน้างานอนุมัติ แล้วทีม ICT จะรับงานต่อ
            คุณติดตามสถานะได้ตลอดด้วยเลขที่งานและอีเมลของคุณ
          </p>
        </section>

        {/* ───── ทางเลือกหลัก ───── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/request"
            data-testid="landing-request"
            className="group flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-6 shadow-card transition hover:border-brand focus-visible:border-brand"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-brand text-on-brand"><Plus className="size-5" aria-hidden /></span>
            <span className="text-lg font-bold text-ink">แจ้งปัญหาใหม่</span>
            <span className="text-sub">ใช้เวลาประมาณ 2 นาที ไม่ต้องล็อกอิน</span>
            <span className="mt-auto inline-flex items-center gap-1 font-semibold text-brand-d">
              เริ่มกรอกแบบฟอร์ม <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>

          <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-6 shadow-card" data-testid="landing-track">
            <span className="flex size-11 items-center justify-center rounded-lg bg-brand-pale text-brand-d"><Search className="size-5" aria-hidden /></span>
            <span className="text-lg font-bold text-ink">ติดตามสถานะงาน</span>
            <span className="text-sub">กรอกเลขที่งานคู่กับอีเมลที่ใช้ตอนแจ้ง หรือเปิดลิงก์ติดตามที่ได้หลังส่งคำขอ</span>
            <TrackLookup />
          </div>
        </div>

        {/* ───── ขั้นตอน ───── */}
        <section className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="how-h">
          <h2 id="how-h" className="mb-4 text-base font-bold text-ink">ขั้นตอนหลังแจ้งปัญหา</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-pale text-sm font-bold text-brand-d">{i + 1}</span>
                <span>
                  <span className="block font-semibold text-ink">{s.title}</span>
                  <span className="text-[13px] text-sub">{s.desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PublicShell>
  );
}
