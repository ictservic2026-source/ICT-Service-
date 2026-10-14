-- ════════════════════════════════════════════════════════════════════════════
-- RECOMMENDATION R1 — Secure random tokens สำหรับลิงก์สาธารณะ (approve / survey / track)
-- ระบบเดิมใช้ ticket_no (เดาได้: ICT-YYMM-N) เป็นกุญแจในลิงก์อนุมัติ/ประเมิน → ใครก็เดาลิงก์ได้
-- ไฟล์นี้ "ยังไม่ได้ถูกรันโดยโปรเจกต์" — ตรวจสอบกับ DBA ก่อนใช้กับฐานข้อมูลจริง
-- ════════════════════════════════════════════════════════════════════════════

-- 1) คอลัมน์ token (สุ่ม 32 hex = 128 bit)
alter table public.tickets
  add column if not exists approve_token text,
  add column if not exists survey_token  text,
  add column if not exists track_token   text;

update public.tickets
   set approve_token = coalesce(approve_token, encode(gen_random_bytes(16), 'hex')),
       survey_token  = coalesce(survey_token,  encode(gen_random_bytes(16), 'hex')),
       track_token   = coalesce(track_token,   encode(gen_random_bytes(16), 'hex'));

alter table public.tickets
  alter column approve_token set default encode(gen_random_bytes(16), 'hex'),
  alter column survey_token  set default encode(gen_random_bytes(16), 'hex'),
  alter column track_token   set default encode(gen_random_bytes(16), 'hex');

create unique index if not exists tickets_approve_token_uq on public.tickets(approve_token);
create unique index if not exists tickets_survey_token_uq  on public.tickets(survey_token);
create unique index if not exists tickets_track_token_uq   on public.tickets(track_token);

-- 2) RLS แนวทาง: anon "ห้าม" select/update ตาราง tickets ตรง ๆ — เข้าถึงผ่าน RPC ที่ตรวจ token เท่านั้น
--    (ตัวอย่างโครง — ปรับตาม policy จริงของโปรเจกต์)
alter table public.tickets enable row level security;

-- เจ้าหน้าที่ (authenticated + profiles.is_active) อ่าน/แก้ได้ตาม role
-- create policy staff_all on public.tickets for all to authenticated
--   using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active))
--   with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active));

-- 3) RPC สำหรับผู้ใช้ไม่ล็อกอิน (security definer → เห็นเฉพาะแถวที่ token ตรง)
create or replace function public.get_ticket_by_token(kind text, tok text)
returns setof public.tickets language sql security definer set search_path = public as $$
  select * from public.tickets
   where (kind = 'approve' and approve_token = tok)
      or (kind = 'survey'  and survey_token  = tok)
      or (kind = 'track'   and track_token   = tok)
   limit 1;
$$;
revoke all on function public.get_ticket_by_token(text, text) from public;
grant execute on function public.get_ticket_by_token(text, text) to anon, authenticated;

-- 4) (แนะนำต่อ) RPC manager_decide(tok, action, comment, name, signature_url) และ submit_survey(tok, ...)
--    ที่ตรวจสถานะ + ทำ update ใน transaction เดียว แทนการให้ anon update ตารางตรง ๆ
--    ปัจจุบัน Next.js (SupabaseRepository.commit) ยังเขียนผ่านตารางเหมือนระบบเดิม เพื่อไม่เปลี่ยนสถาปัตยกรรมโดยพลการ
