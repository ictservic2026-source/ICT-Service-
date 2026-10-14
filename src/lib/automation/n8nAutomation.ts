import type { AutomationEvent, AutomationReceipt, Ticket } from '@/types';
import { buildMessages } from './templates';
import type { AutomationService } from './types';

/**
 * n8n: POST payload "เดิม" (รูปแบบเดียวกับ Make.com webhook ของระบบเดิม) ไปที่ NEXT_PUBLIC_N8N_WEBHOOK_URL
 * - fire-and-forget แบบเดิม: ถ้า webhook ล้มเหลวจะไม่ทำให้ workflow หลักล้ม แต่คืน receipt ที่มี error ให้ UI เตือน
 *   (แก้จุดอ่อนเดิมที่ webhook ตายเงียบๆ โดยไม่มีใครรู้ — ดู REVIEW-ISSUES #10)
 * - Recommendation: ย้ายการเรียกนี้ไปไว้ฝั่งเซิร์ฟเวอร์ (Route Handler) เพื่อไม่เปิดเผย webhook URL — ดู docs/RECOMMENDATIONS.md
 */
export class N8nAutomation implements AutomationService {
  readonly mode = 'n8n' as const;
  private box: AutomationReceipt[] = [];
  private subs = new Set<() => void>();
  constructor(private url: string) {}

  async dispatch(event: AutomationEvent, ticket: Ticket, origin: string): Promise<AutomationReceipt> {
    const receipt: AutomationReceipt = {
      id: `n8n-${Date.now().toString(36)}`, event: event.event, ticket_no: event.ticket_no,
      at: new Date().toISOString(), mode: 'n8n',
      messages: buildMessages(event, ticket, { origin }).map((m) => ({ ...m, statusLabel: 'Queued to n8n' })),
      workflowStatus: 'Workflow Completed',
    };
    try {
      const res = await fetch(this.url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event.payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      receipt.workflowStatus = 'Workflow Failed';
      receipt.error = e instanceof Error ? e.message : String(e);
    }
    this.box = [receipt, ...this.box].slice(0, 100);
    this.subs.forEach((f) => f());
    return receipt;
  }
  listOutbox() { return this.box; }
  clearOutbox() { this.box = []; this.subs.forEach((f) => f()); }
  subscribe(fn: () => void) { this.subs.add(fn); return () => { this.subs.delete(fn); }; }
}
