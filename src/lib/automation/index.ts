import { MockAutomation } from './mockAutomation';
import { N8nAutomation } from './n8nAutomation';
import type { AutomationService } from './types';

export type { AutomationService } from './types';

let instance: AutomationService | null = null;

/** เลือก implementation ตาม NEXT_PUBLIC_AUTOMATION_MODE (ค่าเริ่มต้น mock) */
export function getAutomation(): AutomationService {
  if (instance) return instance;
  const mode = process.env.NEXT_PUBLIC_AUTOMATION_MODE;
  const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
  instance = mode === 'n8n' && url ? new N8nAutomation(url) : new MockAutomation(process.env.NEXT_PUBLIC_DATA_SOURCE !== 'mock');
  return instance;
}

/** สำหรับ unit test */
export function setAutomation(a: AutomationService) { instance = a; }
