-- ═══════════════════════════════════════════════════════════════════════════
-- 003_service_asset_id.sql — รหัสทรัพย์สิน (Asset) ที่ ICO / ITL ยืนยันในงานซ่อม
--
-- tickets.asset_id    = ค่าที่ "ผู้แจ้ง" กรอกเอง (ไม่บังคับ อาจผิด) — ไม่แก้
-- ticket_services.asset_id = ค่าที่ "เจ้าหน้าที่" ตรวจแล้ว ใช้ต่อยอดระบบทะเบียนทรัพย์สิน
-- เก็บเป็นตัวพิมพ์ใหญ่ ไม่มีช่องว่างหน้า/หลัง ยาวไม่เกิน 60 ตัวอักษร
--
-- ต้องรันก่อน deploy โค้ดที่ส่ง asset_id (ไม่เช่นนั้นการบันทึกงานของ ICO/ITL จะล้ม) · รันซ้ำได้
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.ticket_services add column if not exists asset_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticket_services_asset_id_chk') then
    alter table public.ticket_services
      add constraint ticket_services_asset_id_chk
      check (asset_id is null or (length(asset_id) between 1 and 60 and asset_id = upper(btrim(asset_id))));
  end if;
end $$;

-- ค้นประวัติซ่อมของทรัพย์สินชิ้นเดียวกัน (ต่อยอด: ทะเบียนทรัพย์สิน / ประวัติการซ่อมต่อเครื่อง)
create index if not exists ticket_services_asset_id_idx on public.ticket_services (asset_id) where asset_id is not null;

comment on column public.ticket_services.asset_id is 'รหัสทรัพย์สินที่เจ้าหน้าที่ ICO/ITL ยืนยัน (ตัวพิมพ์ใหญ่) — tickets.asset_id คือค่าที่ผู้แจ้งกรอก';
