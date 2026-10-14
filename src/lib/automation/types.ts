import type { AutomationEvent, AutomationReceipt, Ticket } from '@/types';

/**
 * Automation Service Interface — UI เรียกผ่านตัวนี้เท่านั้น
 *   Next.js → AutomationService → (Mock | n8n webhook)
 * เปลี่ยน NEXT_PUBLIC_AUTOMATION_MODE=n8n แล้ว UI ไม่ต้องแก้
 */
export interface AutomationService {
  readonly mode: 'mock' | 'n8n';
  dispatch(event: AutomationEvent, ticket: Ticket, origin: string): Promise<AutomationReceipt>;
  listOutbox(): AutomationReceipt[];
  clearOutbox(): void;
  /** subscribe เพื่อ refresh UI เมื่อมี receipt ใหม่ */
  subscribe(fn: () => void): () => void;
}
