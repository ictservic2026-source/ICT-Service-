# TESTING
- `npm test` → `scripts/test-workflow.ts` (66 assertions: กระดิ่งแจ้งเตือนอ่านแล้วต้องหาย, ทุกเส้นทางสถานะ, กติกา reason/guard/Direct ITL, ลิงก์หัวหน้าใช้ได้ครั้งเดียว, มุมมองลิงก์สาธารณะไม่รั่ว token/บันทึกภายใน, survey คะแนน, automation payload)
- `npm run test:db` → `supabase/tests/run.sh` (57 assertions บน Postgres ในเครื่อง + stub ของ Supabase): รัน migration 2 รอบ (idempotent) แล้วทดสอบในบทบาท anon/authenticated จริง — anon อ่าน/เขียนตารางไม่ได้, RPC ตรวจ token/สถานะ/ข้อมูล, ลำดับสิทธิ์ ICO<ITL<ITM, log แก้ไม่ได้, Storage โฟลเดอร์
- `npm run typecheck`
- E2E (Playwright) ที่ใช้ตรวจระหว่างพัฒนา: public flow 15 · auth 5 · staff lifecycle 29 · dashboard/report 39 · demo hub 4
  ครอบคลุม: ส่งคำขอ+validation+XSS+upload, อนุมัติ/ไม่อนุมัติ, ICO→ITL→ITM→ปิดงาน→ประเมิน, ตีกลับ, Direct ITL, ยกเลิก, @mention+กระดิ่ง, role guard, ฟิลเตอร์ทุกโหมด + ช่วงวันที่เอง + KPI/วงกลม/แท่งเดือนกดกรองรายการ, export 4 ชีต (25 คอลัมน์ ไม่มี SLA), มือถือไม่ล้นจอ, dark mode
- สคริปต์ e2e รันบน harness esbuild ชั่วคราว เพราะสภาพแวดล้อมที่สร้างโปรเจกต์ติดตั้ง Next.js ไม่ได้ — **ควรรัน `npm install && npm run build` จริงบนเครื่องคุณก่อนใช้งาน**

- `npm run check:db` — ตรวจ Supabase จริง (อ่านอย่างเดียว) ชุดทดสอบข้างต้นรันบนโหมด mock; **การเชื่อม Supabase จริงยังไม่เคยทดสอบจากสภาพแวดล้อมของผู้พัฒนา** (ไม่มีเครือข่าย/คีย์) ให้ทดสอบเองด้วยบัญชีจริงตามลำดับ: check:db → ส่งคำขอ → อนุมัติด้วยลิงก์ → ICO → ITL → ITM → ปิดงาน → ประเมิน


## หน้า ICO (ภาพรวมแบบแดชบอร์ดย่อม)
- ตัวกรองเดือน (`filter-month`, `ov-month`) กรองตามวันที่แจ้ง
- การ์ด `card-mgr` / ไทล์ `ov-open` = งานรอหัวหน้างานอนุมัติ (OPEN/MGR_WAIT) และคอลัมน์ "ต้องการภายใน" เรียงได้ (`sort-req`)
