'use client';
/**
 * TicketModal — หน้าต่างรายละเอียด/ดำเนินการตั๋วเดียวสำหรับ 3 พอร์ทัล (ICO / ITL / ITM)
 * รวม openModal() ของ admin-ico.js, admin-itl.js, admin-itm.js ไว้ที่เดียว: แท็บ คำขอ / งาน / ผลพิจารณา / ประวัติ
 * ปุ่มดำเนินการขึ้นกับ role + สถานะ (ดู workflow/machine.ts → availableActions)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Check, ChevronDown, CircleAlert, Copy, CornerUpLeft, Link2, Save, Send, Undo2, XCircle } from 'lucide-react';
import type { CloseResult, CommentRead, Role, Ticket, TicketLog } from '@/types';
import { CLOSE_RESULTS } from '@/lib/constants';
import { fmtBaht, fmtDate, fmtDateTime, toArray } from '@/lib/utils/format';
import * as W from '@/lib/workflow/machine';
import type { ActionResult } from '@/lib/services/ticketActions';
import { useConfirm, useSession, useSnapshot, useToast } from '@/hooks';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge, UrgentBadge, Badge } from '@/components/ui/Badge';
import { Stepper } from '@/components/ui/Stepper';
import { KV, Section } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PageLoading } from '@/components/ui/Spinner';
import { Attachments } from './Attachments';
import { LogThread, type SendInput } from './LogThread';
import { readReceipts, unreadNotifications } from '@/lib/notifications';
import { SurveyBody } from './SurveyDetail';
import { WorkStatusBar } from './WorkStatus';
import { CaseDocButton } from '@/components/reports/CaseDocs';
import { WorkForm, WorkView, toWorkInput, workMissing, workStateFrom, workSummary, type WorkFormState } from './WorkForm';

type Tab = 'req' | 'work' | 'results' | 'log';

export function TicketModal({ ticketNo, portal, onClose, initialTab }: {
  ticketNo: string; portal: Role; onClose: () => void; initialTab?: Tab;
}) {
  const { user } = useSession();
  const { snapshot, services, refresh, loading } = useSnapshot();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>(initialTab ?? 'req');
  const [busy, setBusy] = useState(false);
  const [reads, setReads] = useState<CommentRead[]>([]);
  const [decision, setDecision] = useState('');
  /** แผงลิงก์อนุมัติ/ประเมินที่เปิดอยู่ — ซ่อนไว้เป็นค่าเริ่มต้น กันกดส่งผิดคน */
  const [openFU, setOpenFU] = useState<string | null>(null);
  const [form, setForm] = useState<WorkFormState | null>(null);
  const [formErr, setFormErr] = useState<Partial<Record<keyof WorkFormState, string>>>({});
  const [close, setClose] = useState({ summary: '', result: '' as CloseResult | '', finish: new Date().toISOString().slice(0, 10) });

  const ticket: Ticket | undefined = snapshot?.tickets.find((t) => t.ticket_no === ticketNo);
  const svc = useMemo(() => snapshot?.services.find((s) => s.ticket_no === ticketNo) ?? null, [snapshot, ticketNo]);
  const logs: TicketLog[] = useMemo(
    () => (snapshot?.logs.filter((l) => l.ticket_no === ticketNo) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id),
    [snapshot, ticketNo],
  );
  const survey = snapshot?.surveys.find((s) => s.ticket_no === ticketNo) ?? null;
  const master = snapshot?.workStatus ?? [];
  const me = user?.display_name ?? '';

  // ฟอร์มงานเริ่มต้นจากข้อมูลที่บันทึกไว้ — โหลดใหม่เฉพาะเมื่อเปลี่ยนตั๋ว/มี service เปลี่ยน
  const svcStamp = svc?.updated_at ?? '';
  useEffect(() => { setForm(workStateFrom(svc, me, ticket?.asset_id)); setFormErr({}); setDecision(''); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ticketNo, svcStamp, me]);
  useEffect(() => { setOpenFU(null); setTab(initialTab ?? 'req'); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ticketNo]);

  // read receipts: โหลดและทำเครื่องหมาย "อ่านแล้ว" เมื่อเปิดแท็บประวัติ
  const logIds = logs.map((l) => l.id).join(',');
  const loadReads = useCallback(async () => {
    if (!services || !logs.length) return setReads([]);
    try { setReads(await services.repo.getReads(logs.map((l) => l.id))); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, logIds]);
  useEffect(() => { void loadReads(); }, [loadReads]);
  useEffect(() => {
    if (tab !== 'log' || !services || !user) return;
    const mine = new Set(reads.filter((r) => r.user_id === user.id).map((r) => r.log_id));
    const toMark = unreadNotifications(logs, user, mine);
    if (!toMark.length) return;
    services.repo.markRead(readReceipts(toMark, user))
      .then(async () => { await loadReads(); await refresh(); })
      .catch((e) => { console.error('[notify] markRead', e); toast.error('บันทึกสถานะ "อ่านแล้ว" ไม่สำเร็จ'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, logIds, reads.length]);

  if (!user || !services) return null;
  if (!ticket) {
    return <Modal open onClose={onClose} title={ticketNo} size="sm">{loading ? <PageLoading /> : <p className="py-6 text-center text-sm text-mute">ไม่พบรายการ {ticketNo}</p>}</Modal>;
  }

  const A = W.availableActions(ticket, svc);
  const latest = W.latestStepLog(logs);
  const bounced = W.isBounced(ticket, latest);
  const bouncedItl = W.isBouncedToItl(ticket, latest);
  const lastBack = [...logs].reverse().find((l) => l.status === 'BACK_TO_ICO' || l.status === 'BACK_TO_ITL');

  // สิทธิ์แก้ไขฟอร์มงานตาม portal
  const icoEdit = portal === 'ICO' && A.icoCanWork;
  const itlEdit = portal === 'ITL' && A.itlCanSaveWork;
  const formEditable = icoEdit || itlEdit;
  const canSetStatus = !!svc && ((portal === 'ICO' && !A.isDirectItl) || (portal === 'ITL') || portal === 'ITM');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const surveyUrl = ticket.survey_token ? `${origin}/survey/${ticket.survey_token}` : '';
  // ลิงก์ให้เจ้าหน้าที่ส่งตามงาน (LINE / Teams / อีเมล) — อนุมัติ: ตอนรอหัวหน้าตัดสิน · ประเมิน: หลังปิดงานแล้วผู้แจ้งยังไม่ประเมิน
  const approveUrl = A.managerCanDecide && ticket.approve_token ? `${origin}/approve/${ticket.approve_token}` : '';
  const needSurvey = ticket.status === 'DONE' && !!surveyUrl && !survey && ticket.survey_score == null;
  const followUps = [
    ...(approveUrl ? [{
      key: 'approve', title: 'รอหัวหน้างานอนุมัติ — ส่งลิงก์ตามได้', to: ticket.manager_email, url: approveUrl,
      subject: `[ICT] ขออนุมัติคำขอ ${ticket.ticket_no}`,
      msg: `เรียนหัวหน้างาน\nรบกวนพิจารณาอนุมัติคำขอ ICT ${ticket.ticket_no}\nผู้แจ้ง: ${ticket.requester_name} (${ticket.department})\nเรื่อง: ${ticket.issue_detail.slice(0, 120)}\nกดอนุมัติได้ที่ลิงก์นี้ (ไม่ต้องเข้าสู่ระบบ):\n${approveUrl}`,
      note: 'ลิงก์ใช้ได้จนกว่าหัวหน้าจะตัดสิน (ส่งซ้ำได้ ไม่มีหมดอายุ)',
    }] : []),
    ...(needSurvey ? [{
      key: 'survey', title: 'ผู้แจ้งยังไม่ได้ประเมิน — ส่งลิงก์แบบประเมินได้', to: ticket.requester_email, url: surveyUrl,
      subject: `[ICT] ขอความร่วมมือประเมินความพึงพอใจ งาน ${ticket.ticket_no}`,
      msg: `เรียนคุณ ${ticket.requester_name}\nงานแจ้ง ICT ${ticket.ticket_no} ดำเนินการเสร็จเรียบร้อยแล้ว\nรบกวนประเมินความพึงพอใจ (ใช้เวลาประมาณ 1 นาที ไม่ต้องเข้าสู่ระบบ):\n${surveyUrl}\nขอบคุณครับ/ค่ะ`,
      note: 'ประเมินได้ครั้งเดียว ส่งซ้ำได้จนกว่าผู้แจ้งจะประเมิน',
    }] : []),
  ];
  const copy = (text: string, ok: string) => { navigator.clipboard?.writeText(text).then(() => toast.success(ok)).catch(() => toast.info(text)); };

  /** เลื่อนไปที่ช่องในฟอร์มแล้ววางเคอร์เซอร์ (รอให้แท็บงานแสดงก่อน) */
  function jumpTo(id: string) {
    setTab('work');
    window.setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }, 60);
  }

  async function run(fn: () => Promise<ActionResult>, ok: string, closeAfter = true) {
    setBusy(true);
    try {
      const r = await fn();
      const lbl = r.receipt?.messages?.[0]?.statusLabel;
      toast.success(lbl ? `${ok} · ${lbl}` : ok);
      await refresh();
      if (closeAfter) onClose();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      return false;
    } finally { setBusy(false); }
  }

  function validateForm(): boolean {
    if (!form) return false;
    const e: typeof formErr = {};
    if (!form.staff_name.trim()) e.staff_name = 'กรุณาระบุชื่อเจ้าหน้าที่';
    if (!form.action_detail.trim()) e.action_detail = 'กรุณาระบุการให้บริการ';
    if (form.repair_cost && (!Number.isFinite(Number(form.repair_cost)) || Number(form.repair_cost) < 0)) e.repair_cost = 'ค่าใช้จ่ายไม่ถูกต้อง';
    setFormErr(e);
    if (Object.keys(e).length) {
      setTab('work'); toast.error(Object.values(e)[0]!);
      const first = workMissing(form)[0];
      if (first) jumpTo(first.id);
      return false;
    }
    return true;
  }

  const icoSave = (send: boolean) => async () => {
    if (!form || !validateForm()) return;
    if (send && !(await confirm({ title: 'ส่งต่อให้ ITL ตรวจสอบ?', message: 'หลังส่งแล้วจะแก้ไขรายละเอียดงานไม่ได้จนกว่า ITL/ITM จะตีกลับ', confirmText: 'ส่งต่อ ITL' }))) return;
    await run(() => services.actions.icoSave(ticket.ticket_no, toWorkInput(form), send, form.files),
      send ? 'ส่งต่อ ITL เรียบร้อย' : 'บันทึกร่างแล้ว');
  };
  const icoDirect = async () => {
    if (!(await confirm({ title: 'ส่งต่อให้ ITL ดำเนินการโดยตรง?', message: 'ICO จะไม่บันทึกรายละเอียดงาน — ITL เป็นผู้ดำเนินการเองและ ICO ปิดงานหลัง ITM อนุมัติ', confirmText: 'ส่งตรง ITL' }))) return;
    await run(() => services.actions.icoDirect(ticket.ticket_no, me), 'ส่งต่อ ITL (Direct) เรียบร้อย');
  };
  const icoClose = async () => {
    if (!A.isDirectItl && !close.summary.trim()) { toast.error('กรุณากรอกสรุปผลการดำเนินงานก่อนปิด'); setTab('work'); return; }
    if (!(await confirm({ title: 'ยืนยันปิดงาน?', message: 'ระบบจะส่งลิงก์แบบประเมินความพึงพอใจให้ผู้แจ้ง', confirmText: 'ปิดงาน' }))) return;
    await run(() => services.actions.icoClose(ticket.ticket_no, { staff: me, summary: close.summary, result: close.result, finish_date: close.finish }), 'ปิดงานเรียบร้อย');
  };
  const itlSave = async () => {
    if (!form || !validateForm()) return;
    await run(() => services.actions.itlSave(ticket.ticket_no, toWorkInput(form), decision, form.files), 'บันทึกงาน ITL แล้ว', false);
  };
  const itlDecide = (a: W.ItlAction) => async () => {
    if (a === 'BACK_TO_ICO' && !decision.trim()) { toast.error('กรุณาระบุเหตุผลก่อนตีกลับ'); return; }
    await run(() => services.actions.itlDecide(ticket.ticket_no, a, decision, me), a === 'ITL_APPROVE' ? 'อนุมัติแล้ว — ส่งต่อ IT Manager' : 'ตีกลับให้ ICO แล้ว');
  };
  const itmDecide = (a: W.ItmAction) => async () => {
    if (a !== 'ITM_APPROVE' && !decision.trim()) { toast.error('กรุณาระบุเหตุผล'); return; }
    if (a === 'CANCELLED' && !(await confirm({ title: 'ยืนยันยกเลิกงาน?', message: 'การยกเลิกไม่สามารถย้อนกลับได้', confirmText: 'ยกเลิกงาน', tone: 'danger' }))) return;
    const ok = { ITM_APPROVE: 'อนุมัติแล้ว — ส่งกลับ ICO ปิดงาน', CANCELLED: 'ยกเลิกงานแล้ว', BACK_TO_ITL: 'ตีกลับให้ ITL แล้ว', BACK_TO_ICO: 'ตีกลับให้ ICO แล้ว' }[a];
    await run(() => services.actions.itmDecide(ticket.ticket_no, a, decision, me), ok);
  };

  const sendChat = async (i: SendInput): Promise<boolean> => {
    if (i.wsCode) return run(() => services.actions.setWorkStatus(ticket.ticket_no, i.wsCode, i.text, portal, me, i.mention), 'อัปเดตสถานะงานแล้ว', false);
    if (!i.text.trim()) { toast.error('กรุณาพิมพ์ความเห็นก่อน'); return false; }
    return run(() => services.actions.comment(ticket.ticket_no, portal, me, i.text, i.internal, i.mention), 'ส่งความเห็นแล้ว', false);
  };

  /* ───── footer ───── */
  const showDecisionBox = (portal === 'ITL' && A.itlCanDecide) || (portal === 'ITM' && A.itmCanDecide) || (portal === 'ITL' && A.itlCanSaveWork);
  const footer = (
    <div className="flex w-full flex-col gap-3">
      {showDecisionBox && (
        <Textarea value={decision} onChange={(e) => setDecision(e.target.value)} rows={2} maxLength={1000} data-testid="decision-comment" aria-label="ความเห็นประกอบการพิจารณา"
          placeholder={portal === 'ITM' ? 'ความเห็น IT Manager (จำเป็นเมื่อตีกลับ/ยกเลิก)…' : 'ความเห็นหัวหน้า ICO (จำเป็นเมื่อตีกลับ)…'} />
      )}
      {formEditable && form && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]" data-testid="work-summary" aria-live="polite">
          <span className="text-sub">สรุปที่จะบันทึก:</span>
          {workSummary(form).map((x) => <span key={x} className="rounded-full bg-surface px-2.5 py-0.5 text-ink ring-1 ring-line">{x}</span>)}
          {workMissing(form).length > 0
            ? workMissing(form).map((m) => (
              <button key={m.id} type="button" onClick={() => jumpTo(m.id)} data-testid={`missing-${m.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--err-bg)] px-2.5 py-0.5 font-medium text-[var(--err-fg)] hover:underline">
                <CircleAlert className="size-3.5" aria-hidden />ยังไม่ได้กรอก: {m.label}
              </button>))
            : <span className="inline-flex items-center gap-1 font-medium text-ok"><Check className="size-3.5" aria-hidden />กรอกช่องบังคับครบแล้ว</span>}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>ปิดหน้าต่าง</Button>
        {portal === 'ICO' && icoEdit && <>
          <Button variant="secondary" onClick={icoSave(false)} loading={busy} data-testid="btn-save-draft"><Save className="size-4" />บันทึกร่าง</Button>
          <Button onClick={icoSave(true)} loading={busy} data-testid="btn-send-itl"><Send className="size-4" />บันทึกและส่ง ITL</Button>
        </>}
        {portal === 'ICO' && A.icoCanDirectForward && <Button variant="warn" onClick={icoDirect} loading={busy} data-testid="btn-direct"><ArrowLeftRight className="size-4" />ส่งตรง ITL</Button>}
        {portal === 'ICO' && A.icoCanClose && <Button variant="success" onClick={icoClose} loading={busy} data-testid="btn-close-work"><Check className="size-4" />ปิดงาน</Button>}
        {portal === 'ITL' && A.itlCanSaveWork && <Button variant="secondary" onClick={itlSave} loading={busy} data-testid="btn-itl-save"><Save className="size-4" />บันทึกงาน</Button>}
        {portal === 'ITL' && A.itlCanDecide && <>
          <Button variant="danger" onClick={itlDecide('BACK_TO_ICO')} loading={busy} data-testid="btn-itl-back"><Undo2 className="size-4" />ตีกลับ ICO</Button>
          <Button variant="success" onClick={itlDecide('ITL_APPROVE')} loading={busy} data-testid="btn-itl-approve"><Check className="size-4" />อนุมัติ</Button>
        </>}
        {portal === 'ITM' && A.itmCanDecide && <>
          <Button variant="ghost" onClick={itmDecide('CANCELLED')} loading={busy} data-testid="btn-itm-cancel" className="text-err"><XCircle className="size-4" />ยกเลิกงาน</Button>
          {A.itmCanBackToIco && <Button variant="danger" onClick={itmDecide('BACK_TO_ICO')} loading={busy} data-testid="btn-itm-back-ico"><Undo2 className="size-4" />ตีกลับ ICO</Button>}
          <Button variant="warn" onClick={itmDecide('BACK_TO_ITL')} loading={busy} data-testid="btn-itm-back-itl"><CornerUpLeft className="size-4" />ตีกลับ ITL</Button>
          <Button variant="success" onClick={itmDecide('ITM_APPROVE')} loading={busy} data-testid="btn-itm-approve"><Check className="size-4" />อนุมัติ</Button>
        </>}
      </div>
    </div>
  );

  const chatCount = logs.filter((l) => l.status === 'COMMENT' || l.status === 'INTERNAL_NOTE').length;

  return (
    <Modal open onClose={onClose} size="xl" title={<span className="flex items-center gap-2"><span className="num">{ticket.ticket_no}</span><StatusBadge status={ticket.status} bounced={bounced} />{svc?.priority === 'URGENT' && <UrgentBadge />}{A.isDirectItl && <Badge tone="orange">Direct ITL</Badge>}</span>}
      subtitle={`${ticket.requester_name} · ${ticket.department} · แจ้งเมื่อ ${fmtDateTime(ticket.request_date)}`} footer={footer}>
      <div data-testid="ticket-modal" data-ticket={ticket.ticket_no} data-status={ticket.status}>
        <Stepper status={ticket.status} bounced={bounced} />
        <div className="mt-3 space-y-2">
          {bounced && <Banner tone="err" icon={<AlertTriangle className="size-4" />} testId="banner-bounce"><b>ถูกตีกลับ — รอ ICO แก้ไข</b>{lastBack?.comment ? <> · เหตุผล: {lastBack.comment}</> : null}{lastBack?.action_by ? <span className="text-mute"> (โดย {lastBack.action_by})</span> : null}</Banner>}
          {bouncedItl && <Banner tone="warn" icon={<AlertTriangle className="size-4" />} testId="banner-bounce-itl"><b>IT Manager ตีกลับให้ ITL แก้ไข</b>{lastBack?.comment ? <> · เหตุผล: {lastBack.comment}</> : null}</Banner>}
          {A.isDirectItl && <Banner tone="info" icon={<Link2 className="size-4" />} testId="banner-direct"><b>งาน Direct ITL</b> — ICO ส่งต่อให้ ITL ดำเนินการโดยตรง ICO ไม่ต้องบันทึกรายละเอียดงาน (ปิดงานได้หลัง ITM อนุมัติ)</Banner>}
          {svc && (svc.repair_cost ?? 0) > 0 && <Banner tone="info" testId="banner-cost">ค่าใช้จ่ายรวมของงานนี้ <b className="num">{fmtBaht(svc.repair_cost)}</b> · ผู้รับผิดชอบ {svc.work_owner}</Banner>}
          {portal === 'ICO' && icoEdit && ticket.status === 'ICO_WORK' && !bounced && <></>}
          {followUps.map((f) => {
            const open = openFU === f.key;
            return (
              <div key={f.key} className="rounded-xl border border-[var(--warn)]/40 bg-[var(--warn-bg)] px-3 py-2.5 text-sm" data-testid={`followup-${f.key}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="font-semibold text-[var(--warn-fg)]">{f.title}</p>
                  <button type="button" onClick={() => setOpenFU(open ? null : f.key)} aria-expanded={open} data-testid={`show-${f.key}`}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-[var(--warn-fg)] hover:bg-surface/60">
                    {open ? 'ซ่อนลิงก์' : 'แสดงลิงก์'}<ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                </div>
                {open && <>
                  <p className="mt-1 text-xs text-sub">ส่งถึง <b className="text-ink">{f.to}</b> เท่านั้น · {f.note}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-xs">{f.url}</code>
                    <Button size="sm" variant="secondary" data-testid={`copy-${f.key}`} onClick={() => copy(f.url, 'คัดลอกลิงก์แล้ว')}><Copy className="size-4" />คัดลอกลิงก์</Button>
                    <Button size="sm" variant="secondary" data-testid={`copy-${f.key}-msg`} onClick={() => copy(f.msg, 'คัดลอกข้อความพร้อมลิงก์แล้ว')}><Copy className="size-4" />คัดลอกข้อความ</Button>
                    <a href={`https://line.me/R/share?text=${encodeURIComponent(f.msg)}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="secondary" data-testid={`line-${f.key}`}>ส่งทาง LINE</Button></a>
                    <a href={`mailto:${f.to}?subject=${encodeURIComponent(f.subject)}&body=${encodeURIComponent(f.msg)}`}><Button size="sm" variant="ghost">อีเมล</Button></a>
                  </div>
                </>}
              </div>
            );
          })}
        </div>

        <Tabs className="mt-4" value={tab} onChange={setTab} tabs={[
          { id: 'req', label: 'คำขอ' }, { id: 'work', label: 'งานที่ดำเนินการ' }, { id: 'results', label: 'ผลพิจารณา' },
          { id: 'log', label: 'ประวัติ / ทีม', count: chatCount },
        ]} />

        <div className="pt-4">
          {tab === 'req' && (
            <>
            <div className="mb-3 flex justify-end"><CaseDocButton t={ticket} svc={svc} label="ดาวน์โหลดเอกสารรวม (ใบงาน + ไฟล์แนบ)" /></div>
            <div className="grid gap-x-8 gap-y-2 lg:grid-cols-2" data-testid="tab-req">
              <div>
                <Section title="ข้อมูลผู้แจ้ง">
                  <KV k="ผู้แจ้ง" v={ticket.requester_name} /><KV k="แผนก" v={ticket.department} /><KV k="สถานที่" v={ticket.location} />
                  <KV k="อีเมลผู้แจ้ง" v={ticket.requester_email} /><KV k="อีเมลหัวหน้า" v={ticket.manager_email} />
                  <KV k="Asset ID" v={ticket.asset_id} /><KV k="ต้องการภายใน" v={fmtDate(ticket.required_date)} />
                </Section>
              </div>
              <div>
                <Section title="รายละเอียดปัญหา"><p className="rounded-xl bg-surface-2 p-3 text-sm break-words whitespace-pre-wrap" data-testid="issue-detail">{ticket.issue_detail}</p></Section>
                {(toArray(ticket.issue_img_url).length > 0 || toArray(ticket.attachment_url).length > 0) &&
                  <Section title="ไฟล์แนบ"><Attachments images={ticket.issue_img_url} docs={ticket.attachment_url} /></Section>}
              </div>
            </div>
            </>
          )}

          {tab === 'work' && (
            <div className="space-y-4" data-testid="tab-work">
              <WorkStatusBar svc={svc} logs={logs} master={master} />
              {A.icoCanClose && portal === 'ICO' && !A.isDirectItl && (
                <div className="rounded-xl border border-ok/40 bg-[var(--ok-bg)] p-4">
                  <h4 className="mb-3 text-sm font-semibold text-ok">สรุปปิดงาน</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="สรุปผลการดำเนินงาน" required className="sm:col-span-2"><Textarea data-testid="close-summary" rows={3} value={close.summary} onChange={(e) => setClose({ ...close, summary: e.target.value })} /></Field>
                    <Field label="ผลลัพธ์"><Select data-testid="close-result" value={close.result} onChange={(e) => setClose({ ...close, result: e.target.value as CloseResult | '' })}><option value="">— เลือก —</option>{CLOSE_RESULTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select></Field>
                    <Field label="วันที่เสร็จ"><Input type="date" value={close.finish} onChange={(e) => setClose({ ...close, finish: e.target.value })} /></Field>
                  </div>
                </div>
              )}
              {A.icoCanClose && portal === 'ICO' && A.isDirectItl && <Banner tone="info">งาน Direct ITL — ปิดงานได้ทันที (ไม่ต้องกรอกสรุป)</Banner>}
              {formEditable && form
                ? <WorkForm value={form} onChange={setForm} errors={formErr} requesterAsset={ticket.asset_id} />
                : (portal === 'ICO' && !A.icoCanWork && ticket.status === 'OPEN')
                  ? <p className="py-6 text-center text-sm text-mute">รอหัวหน้างานอนุมัติก่อนจึงจะบันทึกงานได้</p>
                  : <WorkView svc={svc} />}
            </div>
          )}

          {tab === 'results' && (
            <div className="grid gap-4 lg:grid-cols-2" data-testid="tab-results">
              <Result title="หัวหน้างาน / ต้นสังกัด" name={ticket.mgr_name} status={ticket.mgr_status} comment={ticket.mgr_comment} at={ticket.mgr_approved_at} sig={ticket.mgr_signature_url} />
              {svc?.work_owner === 'ITL' ? (
                <div className="rounded-xl border border-dashed border-line-strong bg-surface-2 p-4 text-sm text-sub" data-testid="result-ico-direct">
                  <h4 className="mb-1 text-sm font-semibold text-ink">ICO</h4>
                  งาน Direct ITL — ICO ส่งต่อให้ ITL โดยตรง ไม่มีการบันทึกงานและลงชื่อของ ICO
                  {ticket.ico_submitted_at && <p className="mt-1 text-xs text-mute">ส่งต่อเมื่อ {fmtDateTime(ticket.ico_submitted_at)}</p>}
                </div>
              ) : (
                <Result title="ICO" name={ticket.ico_name || svc?.staff_name || null} status={ticket.ico_submitted_at ? 'SUBMITTED' : null} pending="ยังไม่ส่งต่อ" comment={ticket.ico_comment} at={ticket.ico_submitted_at} sig={ticket.ico_sig_url} />
              )}
              <Result title="ITL" name={ticket.itl_name} status={ticket.itl_status} comment={ticket.itl_comment} at={ticket.itl_approved_at} sig={ticket.itl_sig_url} />
              <Result title="IT Manager" name={ticket.itm_name} status={ticket.itm_status} comment={ticket.itm_comment} at={ticket.itm_approved_at} />
              {(ticket.status === 'DONE' || ticket.status === 'ICO_FINAL') && (
                <div className="rounded-xl border border-line p-4 lg:col-span-2" data-testid="survey-box">
                  <h4 className="mb-2 text-sm font-semibold">แบบประเมินความพึงพอใจ</h4>
                  {survey ? <SurveyBody s={survey} /> : (
                    <div className="text-sm text-sub">
                      {ticket.status === 'DONE' ? 'ผู้แจ้งยังไม่ได้ประเมิน' : 'จะส่งลิงก์แบบประเมินเมื่อปิดงาน'}
                      {ticket.status === 'DONE' && surveyUrl && (
                        <div className="mt-2 flex items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded bg-surface-3 px-2 py-1 text-xs">{surveyUrl}</code>
                          <Button size="sm" variant="secondary" data-testid="copy-survey" onClick={() => { navigator.clipboard?.writeText(surveyUrl).then(() => toast.success('คัดลอกลิงก์แล้ว')).catch(() => toast.info(surveyUrl)); }}><Copy className="size-4" />คัดลอก</Button>
                          <a href={surveyUrl} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost">เปิด</Button></a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {ticket.status === 'DONE' && svc?.close_summary && <div className="rounded-xl border border-line p-4 lg:col-span-2"><h4 className="mb-1 text-sm font-semibold">สรุปปิดงาน ({fmtDate(ticket.closed_at)})</h4><p className="text-sm whitespace-pre-wrap">{svc.close_summary}</p></div>}
            </div>
          )}

          {tab === 'log' && (
            <LogThread logs={logs} reads={reads} me={me} role={portal} svc={svc} master={master} canSetStatus={canSetStatus} onSend={sendChat} busy={busy} />
          )}
        </div>
      </div>
    </Modal>
  );
}

function Banner({ tone, icon, children, testId }: { tone: 'err' | 'warn' | 'info'; icon?: React.ReactNode; children: React.ReactNode; testId?: string }) {
  const c = tone === 'err' ? 'border-err/40 bg-[var(--err-bg)] text-err' : tone === 'warn' ? 'border-warn/40 bg-[var(--warn-bg)] text-warn' : 'border-brand-line bg-brand-pale text-brand-d';
  return <div data-testid={testId} className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] ${c}`}>{icon && <span className="mt-0.5 shrink-0">{icon}</span>}<div className="min-w-0 text-ink [&_b]:font-semibold">{children}</div></div>;
}

function Result({ title, name, status, comment, at, sig, pending }: { title: string; name: string | null; status: string | null; comment: string | null; at: string | null; sig?: string | null; pending?: string }) {
  const tone = !status ? 'slate' : /REJECT|CANCEL|BACK/.test(status) ? 'red' : 'green';
  const label = !status ? (pending ?? 'ยังไม่พิจารณา') : ({ SUBMITTED: 'ส่งต่อ ITL แล้ว', APPROVED: 'อนุมัติ', ITL_APPROVE: 'อนุมัติ', ITM_APPROVE: 'อนุมัติ', REJECTED: 'ไม่อนุมัติ', CANCELLED: 'ยกเลิกงาน', BACK_TO_ICO: 'ตีกลับ ICO', BACK_TO_ITL: 'ตีกลับ ITL' } as Record<string, string>)[status] ?? status;
  return (
    <div className="rounded-xl border border-line p-4" data-testid={`result-${title}`}>
      <div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-semibold">{title}</h4><Badge tone={tone}>{label}</Badge></div>
      <KV k="ผู้พิจารณา" v={name} /><KV k="เวลา" v={at ? fmtDateTime(at) : null} /><KV k="ความเห็น" v={comment} />
      {sig && /^https?:|^data:image/.test(sig) && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={sig} alt={`ลายเซ็น ${name ?? ''}`} className="mt-2 h-14 rounded border border-line bg-white p-1" />)}
    </div>
  );
}
