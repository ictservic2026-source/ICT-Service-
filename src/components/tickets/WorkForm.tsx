'use client';
import clsx from 'clsx';
import type { JobCategory, Priority, TicketService } from '@/types';
import type { WorkInput } from '@/lib/workflow/machine';
import { JOB_CATEGORIES, PRIORITIES } from '@/lib/constants';
import { fmtBaht, fmtDate } from '@/lib/utils/format';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { KV } from '@/components/ui/Card';
import { FileInput } from '@/components/forms/FileInput';
import { Attachments } from './Attachments';

export interface WorkFormState {
  staff_name: string; received_date: string; job_category: JobCategory | ''; priority: Priority; asset_id: string;
  inspection_detail: string; action_detail: string; spare_parts_detail: string; repair_cost: string;
  finish_date: string; recommendations: string; additional_notes: string; files: File[];
}

const today = () => new Date().toISOString().slice(0, 10);

/** ticketAsset = รหัสที่ผู้แจ้งกรอก ใช้เป็นค่าเริ่มต้นจนกว่าเจ้าหน้าที่จะบันทึกค่าของตัวเอง */
export function workStateFrom(svc: TicketService | null, staff: string, ticketAsset?: string | null): WorkFormState {
  return {
    staff_name: svc?.staff_name || staff,
    received_date: svc?.received_date || today(),
    job_category: svc?.job_category || '',
    priority: svc?.priority || 'NORMAL',
    asset_id: svc?.asset_id || (ticketAsset ?? '').trim().toUpperCase(),
    inspection_detail: svc?.inspection_detail || '',
    action_detail: svc?.action_detail || '',
    spare_parts_detail: svc?.spare_parts_detail || '',
    repair_cost: svc?.repair_cost != null ? String(svc.repair_cost) : '',
    finish_date: svc?.finish_date || '',
    recommendations: svc?.recommendations || '',
    additional_notes: svc?.additional_notes || '',
    files: [],
  };
}

export function toWorkInput(s: WorkFormState): WorkInput {
  const cost = s.repair_cost.trim() === '' ? null : Math.max(0, Number(s.repair_cost));
  return {
    staff_name: s.staff_name, received_date: s.received_date || null, job_category: s.job_category,
    priority: s.priority, asset_id: s.asset_id, inspection_detail: s.inspection_detail, action_detail: s.action_detail,
    spare_parts_detail: s.spare_parts_detail, repair_cost: Number.isFinite(cost as number) ? cost : null,
    finish_date: s.finish_date || null, recommendations: s.recommendations, additional_notes: s.additional_notes,
  };
}

/** ฟอร์มบันทึกงาน (ICO / Direct ITL) — ฟิลด์ตามฟอร์มเดิมใน admin-ico.js */
export function WorkForm({ value, onChange, errors, requesterAsset }: { value: WorkFormState; onChange: (v: WorkFormState) => void; errors?: Partial<Record<keyof WorkFormState, string>>; requesterAsset?: string | null }) {
  const set = <K extends keyof WorkFormState>(k: K, v: WorkFormState[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="work-form">
      <Field label="เจ้าหน้าที่ผู้ดำเนินการ" required htmlFor="wf-staff" error={errors?.staff_name}>
        <Input id="wf-staff" data-testid="wf-staff" value={value.staff_name} readOnly className="bg-surface-3" />
      </Field>
      <Field label="วันที่รับงาน" htmlFor="wf-recv"><Input id="wf-recv" type="date" value={value.received_date} onChange={(e) => set('received_date', e.target.value)} /></Field>
      <Field label="ประเภทงาน" htmlFor="wf-cat">
        <Select id="wf-cat" data-testid="wf-cat" value={value.job_category} onChange={(e) => set('job_category', e.target.value as JobCategory | '')}>
          <option value="">— เลือก —</option>
          {JOB_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </Field>
      <Field label={<>รหัสทรัพย์สิน (Asset) <span className="text-xs font-normal text-mute">ไม่บังคับ</span></>} htmlFor="wf-asset" error={errors?.asset_id}
        hint={requesterAsset && requesterAsset.toUpperCase() !== value.asset_id ? `ผู้แจ้งระบุ: ${requesterAsset}` : 'ดูจากสติ๊กเกอร์ทรัพย์สินบนเครื่อง'}>
        <Input id="wf-asset" data-testid="wf-asset" value={value.asset_id} maxLength={60} autoComplete="off" spellCheck={false}
          className="num uppercase" placeholder="เช่น ICT-NB-0123" invalid={!!errors?.asset_id}
          onChange={(e) => set('asset_id', e.target.value.toUpperCase())} />
      </Field>
      <Field label="ความเร่งด่วน">
        <div className="flex gap-2" role="radiogroup" aria-label="ความเร่งด่วน">
          {PRIORITIES.map((p) => (
            <label key={p.value} className={clsx('flex flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium transition',
              value.priority === p.value ? (p.value === 'URGENT' ? 'border-err bg-[var(--err-bg)] text-err' : 'border-brand bg-brand-pale text-brand-d') : 'border-line-strong text-sub hover:bg-surface-2')}>
              <input type="radio" name="wf-prio" className="sr-only" checked={value.priority === p.value} onChange={() => set('priority', p.value)} data-testid={`wf-prio-${p.value}`} />{p.label}
            </label>
          ))}
        </div>
      </Field>
      <Field label="ผลการตรวจสอบ" className="sm:col-span-2" htmlFor="wf-insp"><Textarea id="wf-insp" rows={3} maxLength={2000} value={value.inspection_detail} onChange={(e) => set('inspection_detail', e.target.value)} /></Field>
      <Field label="การให้บริการ / วิธีแก้ไข" required className="sm:col-span-2" htmlFor="wf-act" error={errors?.action_detail}>
        <Textarea id="wf-act" data-testid="wf-action" rows={3} maxLength={2000} invalid={!!errors?.action_detail} value={value.action_detail} onChange={(e) => set('action_detail', e.target.value)} />
      </Field>
      <Field label="การแก้ไขเพิ่มเติม" className="sm:col-span-2" htmlFor="wf-parts"><Textarea id="wf-parts" rows={2} maxLength={1000} value={value.spare_parts_detail} onChange={(e) => set('spare_parts_detail', e.target.value)} /></Field>
      <Field label="ค่าใช้จ่าย (บาท)" htmlFor="wf-cost"><Input id="wf-cost" data-testid="wf-cost" type="number" min={0} step="0.01" inputMode="decimal" value={value.repair_cost} onChange={(e) => set('repair_cost', e.target.value)} /></Field>
      <Field label="วันที่เสร็จ" htmlFor="wf-fin"><Input id="wf-fin" type="date" value={value.finish_date} onChange={(e) => set('finish_date', e.target.value)} /></Field>
      <Field label="ข้อเสนอแนะ" className="sm:col-span-2" htmlFor="wf-rec"><Textarea id="wf-rec" rows={2} maxLength={1000} value={value.recommendations} onChange={(e) => set('recommendations', e.target.value)} /></Field>
      <Field label="หมายเหตุเพิ่มเติม" className="sm:col-span-2" htmlFor="wf-note"><Textarea id="wf-note" rows={2} maxLength={1000} value={value.additional_notes} onChange={(e) => set('additional_notes', e.target.value)} /></Field>
      <div className="sm:col-span-2"><FileInput files={value.files} onChange={(f) => set('files', f)} label="แนบไฟล์ผลการดำเนินงาน" max={5} testId="wf-files" /></div>
    </div>
  );
}

/** มุมมองอ่านอย่างเดียว */
export function WorkView({ svc }: { svc: TicketService | null }) {
  if (!svc) return <p className="py-6 text-center text-sm text-mute">ยังไม่มีการบันทึกรายละเอียดงาน</p>;
  return (
    <div data-testid="work-view">
      <KV k="ผู้ดำเนินการ" v={`${svc.staff_name || '—'} (${svc.work_owner === 'ITL' ? 'Direct ITL' : 'ICO'})`} />
      <KV k="วันที่รับงาน" v={fmtDate(svc.received_date)} />
      <KV k="ประเภทงาน" v={svc.job_category} />
      <KV k="รหัสทรัพย์สิน (Asset)" v={svc.asset_id} />
      <KV k="ความเร่งด่วน" v={svc.priority === 'URGENT' ? 'ด่วน' : 'ปกติ'} />
      <KV k="ผลการตรวจสอบ" v={svc.inspection_detail} />
      <KV k="การให้บริการ" v={svc.action_detail} />
      <KV k="การแก้ไขเพิ่มเติม" v={svc.spare_parts_detail} />
      <KV k="ค่าใช้จ่าย" v={fmtBaht(svc.repair_cost)} />
      <KV k="วันที่เสร็จ" v={fmtDate(svc.finish_date)} />
      <KV k="ข้อเสนอแนะ" v={svc.recommendations} />
      <KV k="หมายเหตุ" v={svc.additional_notes} />
      {svc.close_summary && <KV k="สรุปปิดงาน" v={svc.close_summary} />}
      {svc.attachment_urls && svc.attachment_urls.length > 0 && <div className="mt-3"><Attachments docs={svc.attachment_urls} /></div>}
    </div>
  );
}
