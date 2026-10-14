import type { AutomationEvent, AutomationReceipt, Ticket } from '@/types';
import { buildMessages } from './templates';
import type { AutomationService } from './types';

const KEY = 'ict-mock-outbox-v1';
const CAP = 300;

function load(): AutomationReceipt[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    return JSON.parse(localStorage.getItem(KEY) || '[]') as AutomationReceipt[];
  } catch {
    return [];
  }
}

/** Mock: ไม่ส่งอะไรออกนอกระบบ — สร้าง receipt จำลอง ("Email Sent", "Notification Sent", "Workflow Completed") เก็บใน Outbox */
export class MockAutomation implements AutomationService {
  readonly mode = 'mock' as const;
  /** manual = ใช้กับ Supabase จริงที่ n8n ยังไม่พร้อม: ไม่ส่งอะไรออกนอกระบบ และระบุสถานะตามจริงว่า "ยังไม่ได้ส่ง" */
  constructor(private manual = false) {}
  private box: AutomationReceipt[] = load();
  private subs = new Set<() => void>();
  private seq = this.box.length;

  async dispatch(event: AutomationEvent, ticket: Ticket, origin: string): Promise<AutomationReceipt> {
    const receipt: AutomationReceipt = {
      id: `mock-${Date.now().toString(36)}-${++this.seq}`,
      event: event.event, ticket_no: event.ticket_no, at: new Date().toISOString(), mode: 'mock',
      messages: buildMessages(event, ticket, { origin }).map((m) => (this.manual ? { ...m, statusLabel: 'ยังไม่ได้ส่ง (รอเชื่อม n8n)' } : m)), workflowStatus: 'Workflow Completed',
    };
    this.box = [receipt, ...this.box].slice(0, CAP);
    if (!this.manual) this.persist();
    this.subs.forEach((f) => f());
    return receipt;
  }
  listOutbox() { return this.box; }
  clearOutbox() { this.box = []; this.persist(); this.subs.forEach((f) => f()); }
  subscribe(fn: () => void) { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
  private persist() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(this.box)); } catch { /* quota */ }
  }
}
