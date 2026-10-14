-- โครงสร้างตารางตามระบบเดิม (อนุมานจาก src/types/index.ts) + ข้อมูลเก่าที่ยังไม่มี token
create table public.profiles (id uuid primary key, display_name text, role text, is_active boolean default true, email text);

create table public.tickets (
  ticket_no text primary key, request_date timestamptz not null default now(), required_date date,
  requester_name text, department text, location text, asset_id text, issue_detail text,
  requester_email text, manager_email text, issue_img_url text[], attachment_url text[], status text not null,
  mgr_name text, mgr_signature_url text, mgr_status text, mgr_comment text, mgr_approved_at timestamptz,
  ico_name text, ico_comment text, ico_assigned_at timestamptz, ico_sig_url text, ico_received_at timestamptz, ico_submitted_at timestamptz,
  itl_name text, itl_comment text, itl_status text, itl_sig_url text, itl_approved_at timestamptz,
  itm_status text, itm_name text, itm_comment text, itm_approved_at timestamptz,
  closed_at timestamptz, survey_score int
);
create table public.ticket_services (
  ticket_no text primary key references public.tickets(ticket_no), work_owner text, staff_name text, received_date date,
  job_category text, priority text, inspection_detail text, action_detail text, spare_parts_detail text, repair_cost numeric,
  finish_date date, recommendations text, additional_notes text, attachment_urls text[], work_hours numeric,
  work_status text, work_status_note text, work_status_at timestamptz, close_summary text, close_result text, updated_at timestamptz
);
create table public.tickets_log (
  id bigserial primary key, ticket_no text references public.tickets(ticket_no), step_name text, status text,
  action_by text, comment text, mentioned_role text, created_at timestamptz not null default now()
);
create table public.ticket_survey (
  id uuid primary key default gen_random_uuid(), ticket_no text references public.tickets(ticket_no),
  score_q1 int, score_q2 int, score_q3 int, score_q4 int, score_q5 int,
  score_total int generated always as (score_q1 + score_q2 + score_q3 + score_q4 + score_q5) stored,
  chk_resolved boolean, chk_explained boolean, comment text, submitted_by text, signature_data text,
  created_at timestamptz not null default now()
);
create table public.comment_reads (
  log_id bigint references public.tickets_log(id), user_id uuid, reader_name text, reader_role text,
  read_at timestamptz default now()   -- ระบบเดิมบางชุดไม่มี unique (log_id, user_id)
);
create table public.work_status_master (code text primary key, name_th text, category text, category_th text, color text, icon text, sort_order int, is_active boolean default true);

-- ระบบเดิม: policy เปิดกว้างให้ anon ทำได้ทุกอย่าง (สิ่งที่ migration ต้องล้างทิ้ง)
alter table public.tickets enable row level security;
create policy "legacy allow all" on public.tickets for all to anon using (true) with check (true);

insert into public.profiles values
  ('00000000-0000-0000-0000-0000000000c1', 'ICO One', 'ICO', true,  'ico@test'),
  ('00000000-0000-0000-0000-0000000000a1', 'ITL One', 'ITL', true,  'itl@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'ITM One', 'ITM', true,  'itm@test'),
  ('00000000-0000-0000-0000-0000000000d1', 'Gone',    'ICO', false, 'gone@test');

insert into public.tickets (ticket_no, requester_name, department, location, issue_detail, requester_email, manager_email, status)
values ('ICT-' || to_char(now() at time zone 'Asia/Bangkok', 'YYMM') || '-7', 'Legacy', 'HR', 'A', 'old', 'a@x.co', 'b@x.co', 'OPEN'),
       ('ICT-2001-1', 'Older', 'HR', 'A', 'older', 'a@x.co', 'b@x.co', 'DONE');
insert into public.tickets_log (ticket_no, step_name, status, action_by, comment) values
  ('ICT-2001-1', 'ICT_ACTION', 'DONE', 'ICO One', 'ปิดงาน — เปลี่ยนสาย'),
  ('ICT-2001-1', 'ICO_CHECK', 'INTERNAL_NOTE', 'ICO One', 'internal: supplier price 900');

-- อ่านซ้ำ 2 แถว (เกิดได้เมื่อไม่มี unique key) — migration ต้องลบซ้ำก่อนสร้าง index
insert into public.comment_reads (log_id, user_id, reader_name, reader_role)
select id, '00000000-0000-0000-0000-0000000000c1', 'ICO One', 'ICO' from public.tickets_log where status = 'INTERNAL_NOTE';
insert into public.comment_reads (log_id, user_id, reader_name, reader_role)
select id, '00000000-0000-0000-0000-0000000000c1', 'ICO One', 'ICO' from public.tickets_log where status = 'INTERNAL_NOTE';
