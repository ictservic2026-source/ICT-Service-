# ICT Service Desk — Next.js + Supabase
NISSEI TRADING (THAILAND) · ระบบแจ้งซ่อม ICT (Next.js App Router, TypeScript, Tailwind v4) ใช้ข้อมูลจริงจาก Supabase · UI สไตล์ A (Enterprise Modern)

## เริ่มใช้งาน (ข้อมูลจริง)
```bash
npm install
cp .env.example .env.local      # ใส่ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY (anon public เท่านั้น)
npm run check:db                # ตรวจตาราง/คอลัมน์/สิทธิ์อ่านของ Supabase (อ่านอย่างเดียว ไม่เขียนข้อมูล)
npm run dev                     # http://localhost:3000
```
ถ้ายังไม่ตั้งค่า `.env.local` หน้าเว็บจะแสดงหน้าแจ้งให้ตั้งค่า (ไม่แอบใช้ข้อมูลจำลอง)

### ก่อนใช้งานจริงต้องมี
1. **รัน `supabase/migrations/001_secure_public_access.sql`** (ให้ DBA ตรวจก่อน — ไฟล์นี้ลบ policy เดิมของตารางระบบนี้ทั้งหมด)
   - เพิ่ม/backfill approve_token · survey_token · track_token และกันแบบประเมินซ้ำด้วย unique index
   - RLS: ผู้ใช้ไม่ล็อกอินแตะตารางตรง ๆ ไม่ได้ — ใช้ได้เฉพาะ RPC `create_ticket` `get_public_ticket` `manager_decide` `submit_survey` ที่ตรวจ token
   - เจ้าหน้าที่: trigger ตรวจการเปลี่ยนสถานะตามบทบาท (ICO < ITL < ITM) — ซ่อนปุ่มอย่างเดียวไม่ใช่ความปลอดภัย
   - Storage: จำกัด 10 MB / ชนิดไฟล์ และโฟลเดอร์ที่อัปโหลดได้
   - ทดสอบ migration บน Postgres ในเครื่องได้ด้วย `npm run test:db` (ไม่แตะฐานข้อมูลจริง) · ตรวจของจริงหลังรันด้วย `npm run check:db`
2. **ข้อจำกัดที่ยังเหลือ** — ระหว่างที่ยังไม่มีอีเมลอัตโนมัติ ผู้แจ้งเห็นลิงก์อนุมัติเอง จึงกดอนุมัติแทนหัวหน้าได้ (ระบบบล็อกแค่กรณีกรอกอีเมลหัวหน้าเป็นอีเมลตัวเอง) — ปิดช่องนี้ได้เมื่อย้ายการส่งอีเมลไปฝั่งเซิร์ฟเวอร์ (R3)
3. ตาราง `profiles` (role = ICO | ITL | ITM) และ Storage bucket `ticket-files` ตามระบบเดิม
4. **อีเมลอัตโนมัติ**: n8n ยังไม่พร้อม ระบบจึง *ไม่ส่งอีเมล* — หลังส่งคำขอ หน้าจอจะแสดงลิงก์อนุมัติให้ผู้แจ้งคัดลอกส่งให้หัวหน้างานเอง,
   ลิงก์ประเมินความพึงพอใจคัดลอกได้จาก Modal ของงาน / Dashboard (ติดตามแบบประเมิน)
   เมื่อ n8n พร้อม ตั้ง `NEXT_PUBLIC_AUTOMATION_MODE=n8n` + `NEXT_PUBLIC_N8N_WEBHOOK_URL` (ดู `lib/automation/n8nAutomation.ts`)

| บทบาท | เข้าได้ |
|---|---|
| ICO | /ico /dashboard /reports |
| ITL | + /itl |
| ITM | + /itm |
| ผู้แจ้ง / หัวหน้างาน / ผู้ประเมิน (ไม่ต้อง login) | /request, /approve/[token], /survey/[token], /track/[token] |

## Dashboard
ตัวกรอง: ช่วงเวลา (เดือน / หลายเดือน / **กำหนดช่วงวันที่เอง** / ไตรมาส / ปี ฯลฯ) · แผนก · ประเภทงาน · ความเร่งด่วน · สถานะ · ผู้ดำเนินการ (ICO / Direct ITL)
KPI หลัก (ทั้งหมด / อยู่ระหว่างดำเนินการ / ปิดงานแล้ว / ไม่อนุมัติ-ยกเลิก / ค่าใช้จ่าย), วงกลมสถานะ, แท่ง 12 เดือน, แผนก/ประเภท/ความเร่งด่วน กดแล้วกรองรายการงาน และกดแถวเพื่อดูรายละเอียดได้
ไม่มี SLA / เวลาเฉลี่ยปิดงาน (ตามที่แจ้ง) — คอลัมน์ "SLA (วัน)" ในรายงาน Excel ถูกเอาออกแล้ว (เหลือ 25 คอลัมน์)

## โหมดทดสอบแบบไม่ต่อฐานข้อมูล (ไม่ใช่การใช้งานจริง)
ตั้ง `NEXT_PUBLIC_DATA_SOURCE=mock` จะใช้ข้อมูลตัวอย่างในเบราว์เซอร์ (บัญชี `*@nissei.demo` รหัส `demo1234`, หน้า `/demo`) — ใช้กับชุดทดสอบอัตโนมัติเท่านั้น

## เอกสาร
`docs/INVENTORY.md` (เทียบฟังก์ชันเดิม→ใหม่) · `ARCHITECTURE.md` · `RECOMMENDATIONS.md` · `TESTING.md`
