-- ทดสอบ 001_secure_public_access.sql ในบทบาท anon / authenticated จริง (ผ่าน set role + jwt claims)
\set QUIET on
create schema t;
create table t.results (n serial, ok boolean, name text);
grant usage on schema t to anon, authenticated;
grant all on t.results, t.results_n_seq to anon, authenticated;

create function t.ok(c boolean, name text) returns void language plpgsql as $$
begin
  insert into t.results (ok, name) values (coalesce(c, false), name);
  if not coalesce(c, false) then raise warning 'FAIL: %', name; end if;
end $$;
-- คาดว่า sql ต้อง error และข้อความตรง pattern
create function t.err(sql text, pattern text, name text) returns void language plpgsql as $$
begin
  execute sql;
  perform t.ok(false, name || ' (no error)');
exception when others then
  perform t.ok(sqlerrm ~ pattern, name || ' [' || sqlerrm || ']');
end $$;
grant execute on all functions in schema t to anon, authenticated;

create function t.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid)::text end, false)
$$;
grant execute on function t.as_user(text) to anon, authenticated;

\set ICO   '00000000-0000-0000-0000-0000000000c1'
\set ITL   '00000000-0000-0000-0000-0000000000a1'
\set ITM   '00000000-0000-0000-0000-0000000000b1'
\set GONE  '00000000-0000-0000-0000-0000000000d1'
\set FILES 'https://abc.supabase.co/storage/v1/object/public/ticket-files'

-- ───── migration: backfill / ล้าง policy เดิม
select t.ok((select count(*) = 0 from public.tickets where approve_token is null or survey_token is null or track_token is null), 'legacy tickets backfilled with tokens');
select t.ok((select bool_and(approve_token ~ '^[a-f0-9]{64}$') from public.tickets), 'tokens are 64 hex');
select t.ok(not exists (select 1 from pg_policies where policyname = 'legacy allow all'), 'legacy permissive policy dropped');
select t.ok((select count(*) from public.comment_reads) = 1, 'duplicate read receipts removed before unique key');
select approve_token as legacy_approve, track_token as legacy_track from public.tickets where requester_name = 'Legacy' \gset
select survey_token as done_survey, track_token as done_track from public.tickets where ticket_no = 'ICT-2001-1' \gset

-- ───── anon: ตารางปิดหมด
set role anon;
select t.as_user(null);
select t.err('select * from public.tickets', 'permission denied', 'anon cannot select tickets');
select t.err('select * from public.tickets_log', 'permission denied', 'anon cannot select logs');
select t.err('select * from public.ticket_survey', 'permission denied', 'anon cannot select surveys');
select t.err($$update public.tickets set status = 'DONE'$$, 'permission denied', 'anon cannot update tickets');
select t.err($$insert into public.tickets_log (ticket_no, status) values ('ICT-2001-1', 'COMMENT')$$, 'permission denied', 'anon cannot insert logs');
select t.err('select public.ict_staff_rank()', 'permission denied', 'anon cannot call staff helpers');

-- get_public_ticket
select t.ok(public.get_public_ticket('approve', :'legacy_approve') -> 'ticket' ->> 'requester_name' = 'Legacy', 'approve token opens ticket');
select t.ok(public.get_public_ticket('approve', :'legacy_approve') -> 'ticket' ->> 'track_token' = :'legacy_track', 'approve view carries track token (for requester notice)');
select t.ok(public.get_public_ticket('track', :'legacy_track') -> 'ticket' -> 'approve_token' = 'null'::jsonb, 'track view hides approve token');
select t.ok(public.get_public_ticket('approve', :'legacy_approve') -> 'ticket' -> 'survey_token' = 'null'::jsonb, 'approve view hides survey token');
select t.ok(public.get_public_ticket('approve', :'legacy_track') is null, 'track token cannot open approve view');
select t.ok(public.get_public_ticket('approve', 'ICT-2001-1') is null, 'ticket_no is not a token');
select t.ok(public.get_public_ticket('nope', :'legacy_track') is null, 'unknown kind rejected');
select t.ok(jsonb_array_length(public.get_public_ticket('track', :'done_track') -> 'logs') = 1, 'track view excludes internal notes');
select t.ok(public.get_public_ticket('track', :'done_track') -> 'ticket' ->> 'survey_token' = :'done_survey', 'track view carries survey token');

-- create_ticket
select public.create_ticket(jsonb_build_object(
  'requester_name', ' สมชาย ', 'department', 'HR', 'location', 'A2', 'required_date', '2026-12-01',
  'issue_detail', 'จอดับ', 'requester_email', 'Req@X.co', 'manager_email', 'boss@x.co',
  'issue_img_url', jsonb_build_array(:'FILES' || '/images/1.png'))) as created \gset
select t.ok((:'created'::jsonb ->> 'ticket_no') = 'ICT-' || to_char(now() at time zone 'Asia/Bangkok', 'YYMM') || '-8', 'ticket_no continues monthly sequence (' || (:'created'::jsonb ->> 'ticket_no') || ')');
select t.ok((:'created'::jsonb ->> 'requester_name') = 'สมชาย' and (:'created'::jsonb ->> 'requester_email') = 'req@x.co', 'input trimmed + email lowercased');
select t.ok((:'created'::jsonb ->> 'approve_token') ~ '^[a-f0-9]{64}$' and (:'created'::jsonb ->> 'status') = 'OPEN', 'creator receives tokens, status OPEN');
select (:'created'::jsonb ->> 'approve_token') as new_approve, (:'created'::jsonb ->> 'survey_token') as new_survey, (:'created'::jsonb ->> 'ticket_no') as new_no \gset
select t.err($$select public.create_ticket('{"requester_name":"a","department":"b","location":"c","required_date":"2026-12-01","issue_detail":"d","requester_email":"same@x.co","manager_email":"SAME@x.co"}')$$, 'ต้องไม่ใช่อีเมลของผู้แจ้ง', 'manager email must differ from requester');
select t.err($$select public.create_ticket('{"requester_name":"a","department":"b","location":"c","required_date":"2026-12-01","issue_detail":"d","requester_email":"a@x.co","manager_email":"b@x.co","attachment_url":["https://evil.example/x.pdf"]}')$$, 'ลิงก์ไฟล์แนบไม่ถูกต้อง', 'external attachment URL rejected');
select t.err($$select public.create_ticket('{"requester_name":"a","department":"b","location":"c","required_date":"not-a-date","issue_detail":"d","requester_email":"a@x.co","manager_email":"b@x.co"}')$$, 'วันที่ไม่ถูกต้อง', 'bad date rejected');
select t.err($$select public.create_ticket('{"requester_name":"","department":"b"}')$$, 'กรุณากรอก', 'missing fields rejected');

-- manager_decide
select t.err(format($$select public.manager_decide(%L, 'REJECTED')$$, :'new_approve'), 'เหตุผล', 'reject needs a reason');
select t.err(format($$select public.manager_decide(%L, 'APPROVED')$$, :'new_approve'), 'ลายเซ็น', 'decision needs name or signature');
select t.err(format($$select public.manager_decide(%L, 'APPROVED', null, null, 'https://evil.example/s.png')$$, :'new_approve'), 'ลายเซ็นไม่ถูกต้อง', 'foreign signature URL rejected');
select t.ok(public.manager_decide(:'new_approve', 'APPROVED', 'ok', 'หัวหน้า') ->> 'status' = 'ICO_WORK', 'manager approves → ICO_WORK');
select t.err(format($$select public.manager_decide(%L, 'REJECTED', 'เปลี่ยนใจ', 'หัวหน้า')$$, :'new_approve'), 'ถูกดำเนินการไปแล้ว', 'manager cannot decide twice');

-- submit_survey ก่อนปิดงาน
select t.err(format($$select public.submit_survey(%L, array[30,30,20,10,10], true, true, null, 'ผู้แจ้ง')$$, :'new_survey'), 'ยังไม่ได้ปิด', 'survey blocked before DONE');

-- storage
insert into storage.objects (bucket_id, name) values ('ticket-files', 'images/a.png');
select t.ok(true, 'anon may upload to images/');
select t.err($$insert into storage.objects (bucket_id, name) values ('ticket-files', 'services/ICT-1/a.png')$$, 'row-level security', 'anon cannot upload to services/');
select t.err($$insert into storage.objects (bucket_id, name) values ('ticket-files', 'a.png')$$, 'row-level security', 'anon cannot upload to bucket root');
reset role;

-- ───── เจ้าหน้าที่
set role authenticated;
select t.as_user(:'GONE');
select t.ok((select count(*) from public.tickets) = 0, 'inactive staff sees nothing');

select t.as_user(:'ICO');
select t.ok((select count(*) from public.tickets) = 3, 'ICO sees all tickets');
select t.ok((select count(*) from public.profiles) = 4, 'staff can read profiles');
select t.err(format($$update public.tickets set approve_token = 'x' where ticket_no = %L$$, :'new_no'), 'token', 'staff cannot change tokens');
select t.err(format($$update public.tickets set mgr_status = 'REJECTED' where ticket_no = %L$$, :'new_no'), 'หัวหน้างาน', 'staff cannot forge manager decision');
select t.err(format($$update public.tickets set status = 'DONE' where ticket_no = %L$$, :'new_no'), 'ไม่อนุญาตให้เปลี่ยนสถานะ', 'illegal jump ICO_WORK → DONE blocked');
insert into public.ticket_services (ticket_no, work_owner, staff_name, action_detail) values (:'new_no', 'ICO', 'ICO One', 'fix');
update public.tickets set status = 'ITL_WAIT' where ticket_no = :'new_no';
select t.ok((select status from public.tickets where ticket_no = :'new_no') = 'ITL_WAIT', 'ICO: ICO_WORK → ITL_WAIT');
select t.err(format($$update public.tickets set status = 'ITM_WAIT' where ticket_no = %L$$, :'new_no'), 'สิทธิ์ของบัญชีนี้ไม่พอ', 'ICO cannot do ITL approval');
insert into public.tickets_log (ticket_no, step_name, status, action_by, comment) values (:'new_no', 'ICO_CHECK', 'INTERNAL_NOTE', 'ICO One', 'note');
select id as note_id from public.tickets_log where ticket_no = :'new_no' and status = 'INTERNAL_NOTE' \gset
delete from public.tickets_log where id = :note_id;
update public.tickets_log set comment = 'edited' where id = :note_id;
select t.ok((select comment from public.tickets_log where id = :note_id) = 'note', 'logs are append-only (update/delete no-op)');
insert into public.comment_reads (log_id, user_id, reader_name, reader_role) values (:note_id, :'ICO', 'ICO One', 'ICO');
select t.ok(true, 'staff can mark own read');
-- เหมือน markRead (upsert ignoreDuplicates): กดอ่านซ้ำต้องไม่ error
insert into public.comment_reads (log_id, user_id, reader_name, reader_role) values (:note_id, :'ICO', 'ICO One', 'ICO')
  on conflict (log_id, user_id) do nothing;
select t.ok((select count(*) from public.comment_reads where log_id = :note_id) = 1, 'marking read twice is a no-op (upsert ignore-duplicates)');
select t.err(format($$insert into public.comment_reads (log_id, user_id, reader_name, reader_role) values (%s, %L, 'x', 'ITL')$$, :note_id, :'ITL'), 'row-level security', 'staff cannot mark read for someone else');
insert into storage.objects (bucket_id, name) values ('ticket-files', 'services/ICT-1/a.png');
select t.ok(true, 'staff may upload to services/');

select t.as_user(:'ITL');
update public.tickets set status = 'ITM_WAIT' where ticket_no = :'new_no';
select t.ok((select status from public.tickets where ticket_no = :'new_no') = 'ITM_WAIT', 'ITL: ITL_WAIT → ITM_WAIT');
select t.err(format($$update public.tickets set status = 'ICO_FINAL' where ticket_no = %L$$, :'new_no'), 'สิทธิ์ของบัญชีนี้ไม่พอ', 'ITL cannot do ITM approval');

select t.as_user(:'ITM');
update public.tickets set status = 'ICO_FINAL' where ticket_no = :'new_no';
select t.as_user(:'ICO');
update public.tickets set status = 'DONE', closed_at = now() where ticket_no = :'new_no';
select t.ok((select status from public.tickets where ticket_no = :'new_no') = 'DONE', 'ITM approve then ICO close → DONE');
reset role;

-- ───── anon ประเมินหลังปิดงาน
set role anon;
select t.as_user(null);
select t.err(format($$select public.submit_survey(%L, array[31,30,20,10,10], true, true, null, 'ผู้แจ้ง')$$, :'new_survey'), 'คะแนนข้อ 1', 'score above max rejected');
select t.err(format($$select public.submit_survey(%L, array[0,0,0,0,0], true, true, null, 'ผู้แจ้ง')$$, :'new_survey'), 'อย่างน้อย 1', 'all-zero survey rejected');
select t.err(format($$select public.submit_survey(%L, array[30,30,20,10], true, true, null, 'ผู้แจ้ง')$$, :'new_survey'), 'ไม่ครบ 5', 'four scores rejected');
select t.ok((public.submit_survey(:'new_survey', array[25,30,20,10,10], true, false, 'ดีมาก', 'ผู้แจ้ง') ->> 'score_total')::int = 95, 'survey stored with generated total');
select t.err(format($$select public.submit_survey(%L, array[30,30,20,10,10], true, true, null, 'ผู้แจ้ง')$$, :'new_survey'), 'ส่งแบบประเมินแล้ว', 'second survey rejected');
reset role;
select t.ok((select survey_score from public.tickets where ticket_no = :'new_no') = 95, 'tickets.survey_score updated');

-- ───── สรุป
\set QUIET off
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
select name as failed_test from t.results where not ok;
