-- ═══════════════════════════════════════════════════════════════════════════
-- 002_track_lookup.sql — ผู้แจ้งค้นหางานของตัวเองด้วย "เลขที่งาน + อีเมลผู้แจ้ง"
--
-- ทำไมต้องมีอีเมลด้วย: เลขที่งานเรียงต่อกัน (ICT-2610-1, -2, …) เดาได้ ถ้าค้นด้วยเลขที่อย่างเดียว
-- ใครก็ไล่เปิดงานของคนอื่นได้ ฟังก์ชันนี้คืน track_token ก็ต่อเมื่ออีเมลตรงกับ requester_email
-- จากนั้นหน้าเว็บพาไป /track/<token> (ใช้ get_public_ticket('track', …) เดิม ไม่เปิดข้อมูลเพิ่ม)
--
-- กันการเดา: ไม่บอกว่า "ไม่มีเลขที่งานนี้" หรือ "อีเมลผิด" (คืน null เหมือนกัน)
-- และล็อกเลขที่งานนั้น 15 นาทีเมื่อค้นผิดครบ 5 ครั้ง
-- ต้องรันหลัง 001 · รันซ้ำได้
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ict_track_lookup_fail (
  id        bigserial primary key,
  ticket_no text not null,
  at        timestamptz not null default now()
);
create index if not exists ict_track_lookup_fail_no_at on public.ict_track_lookup_fail (ticket_no, at);
alter table public.ict_track_lookup_fail enable row level security;   -- ไม่มี policy = ไม่มีใครอ่าน/เขียนตรงได้
revoke all on public.ict_track_lookup_fail from public, anon, authenticated;
revoke all on sequence public.ict_track_lookup_fail_id_seq from public, anon, authenticated;

create or replace function public.find_track_token(p_ticket_no text, p_email text) returns text
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_no  text := upper(btrim(coalesce(p_ticket_no, '')));
  v_em  text := lower(btrim(coalesce(p_email, '')));
  v_tok text;
begin
  if v_no !~ '^ICT-\d{4}-\d{1,6}$' or v_em = '' or length(v_em) > 160 then
    return null;
  end if;

  if (select count(*) from public.ict_track_lookup_fail
       where ticket_no = v_no and at > now() - interval '15 minutes') >= 5 then
    raise exception 'ค้นหาไม่สำเร็จหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่' using errcode = '22023';
  end if;

  select track_token into v_tok
    from public.tickets
   where ticket_no = v_no and lower(btrim(requester_email)) = v_em;

  if v_tok is null then
    insert into public.ict_track_lookup_fail (ticket_no) values (v_no);
    delete from public.ict_track_lookup_fail where at < now() - interval '1 day';
    return null;
  end if;
  return v_tok;
end $$;

revoke all on function public.find_track_token(text, text) from public, anon, authenticated;
grant execute on function public.find_track_token(text, text) to anon, authenticated;
