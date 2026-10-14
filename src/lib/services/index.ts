import { getAutomation } from '@/lib/automation';
import { SupabaseAuth, MockAuth } from './auth';
import { MockRepository } from './mockRepository';
import { SupabaseRepository } from './supabaseRepository';
import { TicketActions } from './ticketActions';
import type { AuthService, Repository } from './repository';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export type DataSource = 'mock' | 'supabase';

/**
 * ค่าเริ่มต้น = Supabase จริง — จะใช้ข้อมูลจำลอง (mock) ก็ต่อเมื่อตั้ง NEXT_PUBLIC_DATA_SOURCE=mock อย่างชัดเจนเท่านั้น
 * (ใช้กับชุดทดสอบอัตโนมัติ) ถ้าไม่ได้ตั้งค่า Supabase ระบบจะแจ้งให้ตั้งค่า ไม่แอบสลับไปใช้ข้อมูลจำลอง
 */
export function dataSource(): DataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock' ? 'mock' : 'supabase';
}

/** คืนข้อความปัญหาการตั้งค่า (null = พร้อมใช้งาน) */
export function configProblem(): string | null {
  if (dataSource() === 'supabase' && !isSupabaseConfigured())
    return 'ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ในไฟล์ .env.local';
  return null;
}

let repo: Repository | null = null;
let auth: AuthService | null = null;
let actions: TicketActions | null = null;

export function getRepository(): Repository {
  if (!repo) repo = dataSource() === 'supabase' ? new SupabaseRepository() : new MockRepository();
  return repo;
}
export function getAuth(): AuthService {
  if (!auth) auth = dataSource() === 'supabase' ? new SupabaseAuth() : new MockAuth();
  return auth;
}
export function getActions(): TicketActions {
  if (!actions) actions = new TicketActions(getRepository(), getAutomation());
  return actions;
}
