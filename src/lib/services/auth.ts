import type { Profile } from '@/types';
import { DEMO_PASSWORD, MOCK_USERS } from '@/lib/mock/users';
import { validateEmail, validatePassword } from '@/lib/validation';
import { getSupabase } from '@/lib/supabase/client';
import type { AuthService } from './repository';

const SESSION_KEY = 'ict-mock-session-v1';
const PW_KEY = 'ict-mock-passwords-v1';
const RESET_KEY = 'ict-mock-reset-v1';

function ls(): Storage | null { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }
function readJson<T>(k: string, d: T): T { try { return JSON.parse(ls()?.getItem(k) || '') as T; } catch { return d; } }
function writeJson(k: string, v: unknown) { try { ls()?.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }

/** Mock auth — บัญชีตัวอย่างรหัสผ่าน demo1234 (เปลี่ยนรหัสผ่านใน Mock ได้ผ่านหน้า reset) */
export class MockAuth implements AuthService {
  readonly kind = 'mock' as const;
  demoAccounts() { return MOCK_USERS; }
  async getSession() {
    const id = ls()?.getItem(SESSION_KEY);
    return MOCK_USERS.find((u) => u.id === id && u.is_active) ?? null;
  }
  async signIn(email: string, password: string): Promise<Profile> {
    const u = MOCK_USERS.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    const pw = readJson<Record<string, string>>(PW_KEY, {})[u?.id ?? ''] ?? DEMO_PASSWORD;
    if (!u || password !== pw) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    if (!u.is_active) throw new Error('บัญชีนี้ถูกปิดการใช้งาน');
    ls()?.setItem(SESSION_KEY, u.id);
    return u;
  }
  async signOut() { ls()?.removeItem(SESSION_KEY); }
  async requestPasswordReset(email: string) {
    if (!validateEmail(email)) throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
    // เพื่อความปลอดภัย: ตอบสำเร็จเสมอ ไม่บอกว่ามีอีเมลนี้หรือไม่ — Mock จำอีเมลไว้เพื่อให้หน้า reset ใช้งานได้
    const u = MOCK_USERS.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (u) ls()?.setItem(RESET_KEY, u.id);
  }
  async hasRecoverySession() { return !!ls()?.getItem(RESET_KEY); }
  async updatePassword(newPassword: string) {
    const err = validatePassword(newPassword);
    if (err) throw new Error(err);
    const id = ls()?.getItem(RESET_KEY) || ls()?.getItem(SESSION_KEY);
    if (!id) throw new Error('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ');
    const m = readJson<Record<string, string>>(PW_KEY, {});
    m[id] = newPassword;
    writeJson(PW_KEY, m);
    ls()?.removeItem(RESET_KEY);
  }
}

/** Supabase Auth (email+password) + ตาราง profiles(role: ICO|ITL|ITM) เหมือนระบบเดิม */
export class SupabaseAuth implements AuthService {
  readonly kind = 'supabase' as const;
  private async profileFor(userId: string, email: string): Promise<Profile> {
    const { data, error } = await getSupabase().from('profiles').select('id, display_name, role, is_active').eq('id', userId).maybeSingle();
    if (error || !data) throw new Error('ไม่พบสิทธิ์ผู้ใช้งาน (profiles) — ติดต่อผู้ดูแลระบบ');
    if (data.is_active === false) throw new Error('บัญชีนี้ถูกปิดการใช้งาน');
    if (!['ICO', 'ITL', 'ITM'].includes(data.role)) throw new Error('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน');
    return { id: data.id, display_name: data.display_name || email, role: data.role, is_active: true, email };
  }
  async getSession() {
    const { data } = await getSupabase().auth.getSession();
    const u = data.session?.user;
    if (!u) return null;
    try { return await this.profileFor(u.id, u.email ?? ''); } catch { return null; }
  }
  async signIn(email: string, password: string) {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    try { return await this.profileFor(data.user.id, data.user.email ?? email); }
    catch (e) { await getSupabase().auth.signOut(); throw e; }
  }
  async signOut() { await getSupabase().auth.signOut(); }
  async requestPasswordReset(email: string, redirectTo: string) {
    if (!validateEmail(email)) throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
    await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo });
  }
  async hasRecoverySession() { const { data } = await getSupabase().auth.getSession(); return !!data.session; }
  async updatePassword(newPassword: string) {
    const err = validatePassword(newPassword);
    if (err) throw new Error(err);
    const { error } = await getSupabase().auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }
}
