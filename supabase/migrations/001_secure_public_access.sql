-- ════════════════════════════════════════════════════════════════════════════
-- 001_secure_public_access.sql  (แทนที่ recommended-token-migration.sql เดิม — R1, R2, R4, R8, R12)
--
-- ปัญหาที่แก้:
--   • แอปใช้ anon key จากเบราว์เซอร์ → ถ้า anon อ่าน/เขียนตาราง tickets ได้ตรง ๆ ใครก็ select approve_token
--     ของทุกใบงานแล้วกดอนุมัติแทนหัวหน้าได้ (token ไม่ช่วยอะไรเลยถ้าไม่มี RLS)
--   • ไฟล์เดิม enable RLS แต่ไม่มี policy → ถ้ารันแล้วทั้งเจ้าหน้าที่และผู้แจ้งจะใช้งานไม่ได้ทันที
--
-- หลังรันไฟล์นี้:
--   anon (ผู้แจ้ง / หัวหน้างาน / ผู้ประเมิน)  → ไม่มีสิทธิ์ตารางใด ๆ ตรง ๆ ใช้ได้เฉพาะ RPC 4 ตัวที่ตรวจ token
--   authenticated + profiles.is_active       → อ่าน/แก้ตามบทบาท; การเปลี่ยน status ถูกตรวจด้วย trigger ตามลำดับสิทธิ์
--                                              ICO(1) < ITL(2) < ITM(3)
--   service_role / postgres (SQL editor)     → ไม่ถูกจำกัด (ใช้แก้ข้อมูลโดยผู้ดูแล)
--
-- ⚠ ไฟล์นี้ "ลบ policy เดิมทั้งหมด" ของตาราง tickets, ticket_services, tickets_log, ticket_survey,
--   comment_reads, profiles, work_status_master (รายชื่อที่ลบจะแสดงเป็น NOTICE) — ถ้ามีระบบอื่นใช้ตารางเหล่านี้
--   ให้ DBA ตรวจก่อน · ทดสอบอัตโนมัติด้วย supabase/tests/run.sh (Postgres ธรรมดา + stub ของ Supabase)
-- รันทั้งไฟล์ใน transaction เดียว: ถ้าขั้นใดล้มเหลวจะไม่มีอะไรเปลี่ยน
-- ════════════════════════════════════════════════════════════════════════════
begin;

-- ───────── 0) Token: 2×UUIDv4 = 64 hex (≈244 bit) — ใช้ gen_random_uuid() ซึ่งมีใน Postgres 13+
--            ไม่พึ่ง pgcrypto (บน Supabase อยู่ใน schema extensions ซึ่งฟังก์ชัน security definer มองไม่เห็น)
create or replace function public.ict_new_token() returns text
language sql volatile set search_path = pg_catalog as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

alter table public.tickets
  add column if not exists approve_token text,
  add column if not exists survey_token  text,
  add column if not exists track_token   text;

update public.tickets set approve_token = public.ict_new_token() where approve_token is null;
update public.tickets set survey_token  = public.ict_new_token() where survey_token  is null;
update public.tickets set track_token   = public.ict_new_token() where track_token   is null;

alter table public.tickets
  alter column approve_token set default public.ict_new_token(),
  alter column survey_token  set default public.ict_new_token(),
  alter column track_token   set default public.ict_new_token(),
  alter column approve_token set not null,
  alter column survey_token  set not null,
  alter column track_token   set not null;

create unique index if not exists tickets_approve_token_uq on public.tickets(approve_token);
create unique index if not exists tickets_survey_token_uq  on public.tickets(survey_token);
create unique index if not exists tickets_track_token_uq   on public.tickets(track_token);

-- แบบประเมิน 1 ใบต่อ 1 งาน (เดิมกันซ้ำแค่ฝั่ง client → กดพร้อมกัน 2 แท็บได้ 2 แถว)
do $$
begin
  if exists (select 1 from public.ticket_survey group by ticket_no having count(*) > 1) then
    raise exception 'ticket_survey มีแบบประเมินซ้ำในบางงาน — ลบแถวที่ซ้ำก่อน: select ticket_no, count(*) from ticket_survey group by 1 having count(*) > 1';
  end if;
end $$;
create unique index if not exists ticket_survey_ticket_no_uq on public.ticket_survey(ticket_no);

-- ───────── 1) สิทธิ์เจ้าหน้าที่ (อ่านจาก profiles ของผู้ใช้ที่ล็อกอิน)
create or replace function public.ict_staff_rank() returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case p.role when 'ICO' then 1 when 'ITL' then 2 when 'ITM' then 3 else 0 end
      from public.profiles p
     where p.id = auth.uid() and coalesce(p.is_active, true)
  ), 0)
$$;
create or replace function public.ict_is_staff() returns boolean
language sql stable set search_path = public, pg_temp as $$ select public.ict_staff_rank() > 0 $$;

-- Supabase ให้ EXECUTE แก่ anon/authenticated โดยตรงผ่าน default privileges → ต้อง revoke ระบุชื่อ role ด้วย ไม่ใช่แค่ public
revoke all on function public.ict_new_token()  from public, anon, authenticated;
revoke all on function public.ict_staff_rank() from public, anon, authenticated;
revoke all on function public.ict_is_staff()   from public, anon, authenticated;
grant execute on function public.ict_staff_rank() to authenticated;
grant execute on function public.ict_is_staff()   to authenticated;

-- ───────── 2) RLS — ล้าง policy เดิม แล้วสร้างชุดใหม่
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('tickets','ticket_services','tickets_log','ticket_survey','comment_reads','profiles','work_status_master')
  loop
    raise notice 'drop policy % on %.%', r.policyname, r.schemaname, r.tablename;
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.tickets         enable row level security;
alter table public.ticket_services enable row level security;
alter table public.tickets_log     enable row level security;
alter table public.ticket_survey   enable row level security;
alter table public.profiles        enable row level security;

-- anon ไม่ต้องแตะตารางเลย (ใช้ RPC) — ถอนสิทธิ์ระดับตารางซ้อนอีกชั้น
revoke all on public.tickets, public.ticket_services, public.tickets_log, public.ticket_survey, public.profiles from anon;

create policy ict_staff_select on public.tickets for select to authenticated using (public.ict_is_staff());
create policy ict_staff_update on public.tickets for update to authenticated
  using (public.ict_is_staff()) with check (public.ict_is_staff());

create policy ict_staff_select on public.ticket_services for select to authenticated using (public.ict_is_staff());
create policy ict_staff_insert on public.ticket_services for insert to authenticated with check (public.ict_is_staff());
create policy ict_staff_update on public.ticket_services for update to authenticated
  using (public.ict_is_staff()) with check (public.ict_is_staff());

-- log เป็น audit trail: เพิ่มได้ แก้/ลบไม่ได้
create policy ict_staff_select on public.tickets_log for select to authenticated using (public.ict_is_staff());
create policy ict_staff_insert on public.tickets_log for insert to authenticated with check (public.ict_is_staff());

create policy ict_staff_select on public.ticket_survey for select to authenticated using (public.ict_is_staff());

create policy ict_self_or_staff_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.ict_is_staff());

do $$
begin
  if to_regclass('public.comment_reads') is not null then
    -- markRead ใช้ upsert onConflict (log_id,user_id) → ต้องมี unique key นี้ ไม่อย่างนั้นบันทึก "อ่านแล้ว" ล้มเหลวทุกครั้ง
    if not exists (
      select 1 from pg_index i
       where i.indrelid = 'public.comment_reads'::regclass and i.indisunique
         and (select array_agg(a.attname::text order by a.attname) from pg_attribute a
               where a.attrelid = i.indrelid and a.attnum = any(i.indkey)) = array['log_id', 'user_id']
    ) then
      delete from public.comment_reads c using public.comment_reads d
       where c.log_id = d.log_id and c.user_id = d.user_id and c.ctid > d.ctid;
      execute 'create unique index comment_reads_log_user_uq on public.comment_reads(log_id, user_id)';
    end if;
    execute 'alter table public.comment_reads enable row level security';
    execute 'revoke all on public.comment_reads from anon';
    execute 'create policy ict_staff_select on public.comment_reads for select to authenticated using (public.ict_is_staff())';
    -- บันทึก "อ่านแล้ว" ได้เฉพาะของตัวเอง
    execute 'create policy ict_own_insert on public.comment_reads for insert to authenticated
               with check (public.ict_is_staff() and user_id::text = auth.uid()::text)';
  end if;
  if to_regclass('public.work_status_master') is not null then
    execute 'alter table public.work_status_master enable row level security';
    execute 'revoke all on public.work_status_master from anon';
    execute 'create policy ict_staff_select on public.work_status_master for select to authenticated using (public.ict_is_staff())';
  end if;
end $$;

-- ───────── 3) ตรวจการเปลี่ยนสถานะตามบทบาท (R8) — ตรงกับ src/lib/workflow/machine.ts
create or replace function public.ict_enforce_ticket_update() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  rank int;
  need int;
begin
  -- RPC (security definer → current_user = เจ้าของฟังก์ชัน), service_role และ SQL editor ไม่ถูกจำกัด
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.ticket_no     is distinct from old.ticket_no
  or new.approve_token is distinct from old.approve_token
  or new.survey_token  is distinct from old.survey_token
  or new.track_token   is distinct from old.track_token then
    raise exception 'ไม่อนุญาตให้แก้เลขที่งานหรือ token' using errcode = '42501';
  end if;

  -- ผลอนุมัติของหัวหน้างานและคะแนนประเมิน เขียนได้เฉพาะผ่านลิงก์ (manager_decide / submit_survey)
  if new.mgr_status         is distinct from old.mgr_status
  or new.mgr_name           is distinct from old.mgr_name
  or new.mgr_comment        is distinct from old.mgr_comment
  or new.mgr_signature_url  is distinct from old.mgr_signature_url
  or new.mgr_approved_at    is distinct from old.mgr_approved_at
  or new.survey_score       is distinct from old.survey_score then
    raise exception 'ข้อมูลการอนุมัติของหัวหน้างานและคะแนนประเมินแก้ไขจากหน้าเจ้าหน้าที่ไม่ได้' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    need := case
      when old.status in ('OPEN', 'MGR_WAIT', 'ICO_WORK') and new.status in ('ICO_WORK', 'ITL_WAIT')            then 1
      when old.status = 'ICO_FINAL' and new.status = 'DONE'                                                     then 1
      when old.status = 'ITL_WAIT'  and new.status in ('ITM_WAIT', 'ICO_WORK')                                  then 2
      when old.status = 'ITM_WAIT'  and new.status in ('ICO_FINAL', 'CANCELLED', 'ITL_WAIT', 'ICO_WORK')        then 3
    end;
    if need is null then
      raise exception 'ไม่อนุญาตให้เปลี่ยนสถานะจาก % เป็น %', old.status, new.status using errcode = '42501';
    end if;
    rank := public.ict_staff_rank();
    if rank < need then
      raise exception 'สิทธิ์ของบัญชีนี้ไม่พอสำหรับการเปลี่ยนสถานะจาก % เป็น %', old.status, new.status using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

revoke all on function public.ict_enforce_ticket_update() from public, anon, authenticated;
drop trigger if exists ict_enforce_ticket_update on public.tickets;
create trigger ict_enforce_ticket_update before update on public.tickets
  for each row execute function public.ict_enforce_ticket_update();

-- ───────── 4) RPC สำหรับผู้ใช้ไม่ล็อกอิน (security definer — ตรวจ token + สถานะใน transaction เดียว)

-- มุมมองตั๋วที่ปลอดภัยสำหรับลิงก์สาธารณะ: ไม่ส่ง token อื่น และไม่ส่งความเห็นภายในของ ICO/ITL/ITM
create or replace function public.ict_public_ticket(t public.tickets, kind text) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select to_jsonb(t) || jsonb_build_object(
    'approve_token', case when kind in ('approve', 'create')         then t.approve_token end,
    'survey_token',  case when kind in ('survey', 'track', 'create') then t.survey_token  end,
    -- approve ได้ track_token ด้วย: อีเมลแจ้งผู้แจ้งหลังหัวหน้าอนุมัติแนบลิงก์ติดตามสถานะ
    'track_token',   case when kind in ('approve', 'track', 'create') then t.track_token  end,
    'ico_comment', null, 'itl_comment', null, 'itm_comment', null,
    'ico_sig_url', null, 'itl_sig_url', null
  )
$$;
revoke all on function public.ict_public_ticket(public.tickets, text) from public, anon, authenticated;

drop function if exists public.get_ticket_by_token(text, text);  -- ตัวเดิมคืนทุกคอลัมน์รวม token อื่น

create or replace function public.get_public_ticket(kind text, tok text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  t public.tickets;
begin
  if kind not in ('approve', 'survey', 'track') or tok is null or tok !~ '^[a-f0-9]{32,96}$' then
    return null;
  end if;
  select * into t from public.tickets
   where (kind = 'approve' and approve_token = tok)
      or (kind = 'survey'  and survey_token  = tok)
      or (kind = 'track'   and track_token   = tok);
  if not found then return null; end if;

  return jsonb_build_object(
    'ticket', public.ict_public_ticket(t, kind),
    'service', case when kind = 'approve' then null else (
      select jsonb_build_object('staff_name', s.staff_name, 'action_detail', s.action_detail,
                                'finish_date', s.finish_date, 'work_owner', s.work_owner)
        from public.ticket_services s where s.ticket_no = t.ticket_no) end,
    'logs', case when kind = 'track' then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', l.id, 'ticket_no', l.ticket_no, 'step_name', l.step_name, 'status', l.status,
               'action_by', l.action_by, 'created_at', l.created_at, 'mentioned_role', null,
               'comment', case when l.step_name = 'WORK_STATUS' then null else l.comment end)
             order by l.created_at, l.id), '[]'::jsonb)
        from public.tickets_log l
       where l.ticket_no = t.ticket_no and l.status not in ('INTERNAL_NOTE', 'COMMENT')) else '[]'::jsonb end,
    'survey', (
      select jsonb_build_object('score_total', sv.score_total, 'created_at', sv.created_at)
        from public.ticket_survey sv where sv.ticket_no = t.ticket_no
       order by sv.created_at desc limit 1)
  );
end $$;

-- ส่งคำขอใหม่ (R12: เลขที่งานออกภายใต้ advisory lock → ไม่ชนกันเมื่อส่งพร้อมกัน)
create or replace function public.create_ticket(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  email_re constant text := '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$';
  v_name   text := btrim(coalesce(p->>'requester_name', ''));
  v_dept   text := btrim(coalesce(p->>'department', ''));
  v_loc    text := btrim(coalesce(p->>'location', ''));
  v_issue  text := btrim(coalesce(p->>'issue_detail', ''));
  v_asset  text := nullif(btrim(coalesce(p->>'asset_id', '')), '');
  v_remail text := lower(btrim(coalesce(p->>'requester_email', '')));
  v_memail text := lower(btrim(coalesce(p->>'manager_email', '')));
  v_req    date;
  v_imgs   text[];
  v_docs   text[];
  v_prefix text;
  v_seq    int;
  typed    public.tickets;
  t        public.tickets;
begin
  if v_name = '' or v_dept = '' or v_loc = '' or v_issue = '' or v_remail = '' or v_memail = '' or coalesce(p->>'required_date', '') = '' then
    raise exception 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ' using errcode = '22023';
  end if;
  if length(v_name) > 120 or length(v_dept) > 60 or length(v_loc) > 160 or length(v_issue) > 500
     or length(coalesce(v_asset, '')) > 60 or length(v_remail) > 160 or length(v_memail) > 160 then
    raise exception 'ข้อมูลบางช่องยาวเกินกำหนด' using errcode = '22023';
  end if;
  if v_remail !~ email_re then raise exception 'รูปแบบอีเมลไม่ถูกต้อง' using errcode = '22023'; end if;
  if v_memail !~ email_re then raise exception 'รูปแบบอีเมลหัวหน้างานไม่ถูกต้อง' using errcode = '22023'; end if;
  if v_memail = v_remail then raise exception 'อีเมลหัวหน้างานต้องไม่ใช่อีเมลของผู้แจ้ง' using errcode = '22023'; end if;
  begin
    v_req := (p->>'required_date')::date;
  exception when others then
    raise exception 'วันที่ไม่ถูกต้อง' using errcode = '22023';
  end;

  -- ไฟล์แนบต้องเป็นไฟล์ที่อัปโหลดเข้า bucket ticket-files (ไม่รับลิงก์ภายนอก/javascript:/data:)
  select array_agg(x) into v_imgs from jsonb_array_elements_text(coalesce(p->'issue_img_url', '[]'::jsonb)) x;
  select array_agg(x) into v_docs from jsonb_array_elements_text(coalesce(p->'attachment_url', '[]'::jsonb)) x;
  if coalesce(array_length(v_imgs, 1), 0) > 10 or coalesce(array_length(v_docs, 1), 0) > 10 then
    raise exception 'แนบไฟล์ได้ไม่เกิน 10 ไฟล์ต่อประเภท' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(coalesce(v_imgs, '{}') || coalesce(v_docs, '{}')) u
              where u !~ '^https://[^/]+/storage/v1/object/public/ticket-files/(images|attachments)/' or length(u) > 1000) then
    raise exception 'ลิงก์ไฟล์แนบไม่ถูกต้อง' using errcode = '22023';
  end if;

  -- แปลงค่าให้ตรงชนิดคอลัมน์จริง (issue_img_url/attachment_url อาจเป็น text[] หรือ jsonb, required_date อาจเป็น date หรือ text)
  typed := jsonb_populate_record(null::public.tickets, jsonb_build_object(
    'required_date', v_req, 'issue_img_url', to_jsonb(v_imgs), 'attachment_url', to_jsonb(v_docs)));

  perform pg_advisory_xact_lock(hashtext('public.tickets.ticket_no'));
  v_prefix := 'ICT-' || to_char(now() at time zone 'Asia/Bangkok', 'YYMM') || '-';
  select coalesce(max(substring(ticket_no from '^ICT-\d{4}-(\d+)$')::int), 0) + 1 into v_seq
    from public.tickets where ticket_no like v_prefix || '%';

  insert into public.tickets (
    ticket_no, request_date, required_date, requester_name, department, location, asset_id, issue_detail,
    requester_email, manager_email, issue_img_url, attachment_url, status
  ) values (
    v_prefix || v_seq, now(), typed.required_date, v_name, v_dept, v_loc, v_asset, v_issue,
    v_remail, v_memail, typed.issue_img_url, typed.attachment_url, 'OPEN'
  ) returning * into t;

  return public.ict_public_ticket(t, 'create');
end $$;

-- หัวหน้างานอนุมัติ/ไม่อนุมัติ — ตัดสินได้ครั้งเดียว
create or replace function public.manager_decide(
  tok text, decision text, note text default null, signer_name text default null, signature_url text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  t      public.tickets;
  v_note text := nullif(btrim(coalesce(note, '')), '');
  v_name text := nullif(btrim(coalesce(signer_name, '')), '');
  v_sig  text := nullif(btrim(coalesce(signature_url, '')), '');
  v_new  text;
begin
  if tok is null or tok !~ '^[a-f0-9]{32,96}$' then
    raise exception 'ลิงก์ไม่ถูกต้องหรือหมดอายุ' using errcode = '22023';
  end if;
  select * into t from public.tickets where approve_token = tok for update;
  if not found then raise exception 'ลิงก์ไม่ถูกต้องหรือหมดอายุ' using errcode = '22023'; end if;

  if decision not in ('APPROVED', 'REJECTED') then raise exception 'คำสั่งไม่ถูกต้อง' using errcode = '22023'; end if;
  if t.mgr_status is not null or t.status not in ('OPEN', 'MGR_WAIT', 'ICO_WORK') then
    raise exception 'ใบงานนี้ถูกดำเนินการไปแล้ว หรือไม่ได้อยู่ในสถานะรออนุมัติ' using errcode = '22023';
  end if;
  if decision = 'REJECTED' and v_note is null then raise exception 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' using errcode = '22023'; end if;
  if v_name is null and v_sig is null then raise exception 'กรุณาพิมพ์ชื่อหรือวาดลายเซ็นก่อนยืนยัน' using errcode = '22023'; end if;
  if length(coalesce(v_note, '')) > 500 or length(coalesce(v_name, '')) > 120 then
    raise exception 'ข้อความยาวเกินกำหนด' using errcode = '22023';
  end if;
  if v_sig is not null and v_sig !~ '^https://[^/]+/storage/v1/object/public/ticket-files/signatures/' then
    raise exception 'ลิงก์ลายเซ็นไม่ถูกต้อง' using errcode = '22023';
  end if;

  v_new := case decision when 'APPROVED' then 'ICO_WORK' else 'REJECTED' end;
  update public.tickets
     set status = v_new, mgr_status = decision, mgr_name = v_name, mgr_signature_url = v_sig,
         mgr_approved_at = now(), mgr_comment = coalesce(v_note, mgr_comment)
   where ticket_no = t.ticket_no
  returning * into t;

  insert into public.tickets_log (ticket_no, step_name, status, action_by, comment, created_at)
  values (t.ticket_no, 'MANAGER_APPROVE', decision, coalesce(v_name, 'วาดลายเซ็น'), v_note, now());

  return public.ict_public_ticket(t, 'approve');
end $$;

-- ผู้แจ้งส่งแบบประเมิน — 1 ครั้งต่อ 1 งาน
create or replace function public.submit_survey(
  tok text, scores int[], chk_resolved boolean, chk_explained boolean,
  note text default null, submitted_by text default null, signature_data text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  t       public.tickets;
  maxes   constant int[] := array[30, 30, 20, 10, 10];
  v_total int := 0;
  v_by    text := nullif(btrim(coalesce(submitted_by, '')), '');
  v_note  text := nullif(btrim(coalesce(note, '')), '');
  v_sig   text := nullif(signature_data, '');
  sv      public.ticket_survey;
begin
  if tok is null or tok !~ '^[a-f0-9]{32,96}$' then
    raise exception 'ลิงก์ไม่ถูกต้องหรือหมดอายุ' using errcode = '22023';
  end if;
  select * into t from public.tickets where survey_token = tok for update;
  if not found then raise exception 'ลิงก์ไม่ถูกต้องหรือหมดอายุ' using errcode = '22023'; end if;
  if t.status not in ('DONE', 'ICO_FINAL') then raise exception 'งานนี้ยังไม่ได้ปิด จึงยังประเมินไม่ได้' using errcode = '22023'; end if;
  if exists (select 1 from public.ticket_survey where ticket_no = t.ticket_no) then
    raise exception 'คุณส่งแบบประเมินแล้ว ขอบคุณ!' using errcode = '22023';
  end if;

  if scores is null or array_length(scores, 1) is distinct from 5 then
    raise exception 'คะแนนไม่ครบ 5 ข้อ' using errcode = '22023';
  end if;
  for i in 1..5 loop
    if scores[i] is null or scores[i] < 0 or scores[i] > maxes[i] then
      raise exception 'คะแนนข้อ % ไม่ถูกต้อง', i using errcode = '22023';
    end if;
    v_total := v_total + scores[i];
  end loop;
  if v_total = 0 then raise exception 'กรุณาให้คะแนนอย่างน้อย 1 หัวข้อก่อน' using errcode = '22023'; end if;
  if v_by is null then raise exception 'กรุณาระบุชื่อผู้ประเมิน' using errcode = '22023'; end if;
  if length(v_by) > 120 or length(coalesce(v_note, '')) > 1000 then
    raise exception 'ข้อความยาวเกินกำหนด' using errcode = '22023';
  end if;
  if v_sig is not null and (v_sig !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(v_sig) > 400000) then
    raise exception 'ลายเซ็นไม่ถูกต้องหรือใหญ่เกินไป' using errcode = '22023';
  end if;

  insert into public.ticket_survey (
    ticket_no, score_q1, score_q2, score_q3, score_q4, score_q5,
    chk_resolved, chk_explained, comment, submitted_by, signature_data, created_at
  ) values (
    t.ticket_no, scores[1], scores[2], scores[3], scores[4], scores[5],
    coalesce(chk_resolved, false), coalesce(chk_explained, false), v_note, v_by, v_sig, now()
  ) returning * into sv;

  update public.tickets set survey_score = v_total where ticket_no = t.ticket_no;
  return to_jsonb(sv);
end $$;

revoke all on function public.get_public_ticket(text, text) from public, anon, authenticated;
revoke all on function public.create_ticket(jsonb) from public, anon, authenticated;
revoke all on function public.manager_decide(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.submit_survey(text, int[], boolean, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.get_public_ticket(text, text) to anon, authenticated;
grant execute on function public.create_ticket(jsonb) to anon, authenticated;
grant execute on function public.manager_decide(text, text, text, text, text) to anon, authenticated;
grant execute on function public.submit_survey(text, int[], boolean, boolean, text, text, text) to anon, authenticated;

-- ───────── 5) Storage bucket ticket-files (R4)
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'ไม่พบ storage.objects — ข้ามการตั้งค่า Storage';
    return;
  end if;
  -- จำกัดขนาด 10 MB และชนิดไฟล์ให้ตรงกับ ALLOWED_UPLOAD_EXT ใน src/lib/constants.ts
  update storage.buckets
     set file_size_limit = 10485760,
         allowed_mime_types = array[
           'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
           'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
           'text/plain', 'text/csv', 'application/zip', 'application/x-zip-compressed'
         ]
   where id = 'ticket-files';

  execute 'drop policy if exists ict_public_upload on storage.objects';
  execute 'drop policy if exists ict_staff_upload on storage.objects';
  -- ผู้แจ้ง/หัวหน้างาน: อัปโหลดได้เฉพาะ 3 โฟลเดอร์ และเพิ่มได้อย่างเดียว (แก้/ลบ/ทับไม่ได้)
  execute $p$create policy ict_public_upload on storage.objects for insert to anon, authenticated
            with check (bucket_id = 'ticket-files' and (storage.foldername(name))[1] in ('images', 'attachments', 'signatures'))$p$;
  -- เจ้าหน้าที่: แนบไฟล์งานซ่อม
  execute $p$create policy ict_staff_upload on storage.objects for insert to authenticated
            with check (bucket_id = 'ticket-files' and (storage.foldername(name))[1] in ('services', 'itl-services')
                        and public.ict_is_staff())$p$;
end $$;

commit;
