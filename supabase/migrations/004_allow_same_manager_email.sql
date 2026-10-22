-- ═══════════════════════════════════════════════════════════════════════════
-- 004_allow_same_manager_email.sql — อนุญาตให้ "อีเมลหัวหน้างาน" ซ้ำกับ "อีเมลผู้แจ้ง"
-- เช่น หัวหน้างานแจ้งปัญหาเอง หรือผู้แจ้งเป็นผู้อนุมัติของตัวเอง (บริษัทยอมรับความเสี่ยงนี้แล้ว)
-- เปลี่ยนเฉพาะ create_ticket(): ตัดบรรทัดตรวจอีเมลซ้ำออก ส่วนอื่นเหมือน 001 ทุกบรรทัด
-- ต้องรันหลัง 001 · รันซ้ำได้
-- ═══════════════════════════════════════════════════════════════════════════

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
  -- (004) อนุญาตให้อีเมลหัวหน้างานซ้ำกับอีเมลผู้แจ้ง
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

revoke all on function public.create_ticket(jsonb) from public, anon, authenticated;
grant execute on function public.create_ticket(jsonb) to anon, authenticated;
