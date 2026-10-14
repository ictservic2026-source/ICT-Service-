# RECOMMENDATIONS (ข้อเสนอแนะ — ยังไม่ได้เปลี่ยนสถาปัตยกรรมโดยพลการ)

| # | เรื่อง | รายละเอียด | ผลกระทบ |
|---|---|---|---|
| R1 | Secure token + RLS | token 64 hex + RLS ปิด anon ทุกตาราง (`supabase/migrations/001_secure_public_access.sql`) — ไฟล์เดิมเปิด RLS แต่ไม่มี policy (รันแล้วระบบใช้ไม่ได้) และแอปยังอ่าน token ผ่านตารางตรง ๆ | **ทำแล้ว** (รอรันบน DB จริง) |
| R2 | RPC แทนการให้ anon เขียนตาราง | `create_ticket`, `get_public_ticket`, `manager_decide`, `submit_survey` (security definer, ตรวจ token+สถานะ+ข้อมูลใน transaction เดียว) — แอปเรียกผ่าน `Repository.getPublicTicket/managerDecide/submitSurvey` | **ทำแล้ว** |
| R3 | เรียก webhook ฝั่ง server | ปัจจุบัน n8n URL เป็น `NEXT_PUBLIC_*` (เห็นได้ในเบราว์เซอร์). ควรย้ายไป Route Handler/Edge Function ที่ใส่ secret + retry + dead-letter | กลาง |
| R4 | Storage policy | จำกัด 10 MB + MIME + โฟลเดอร์ที่ anon อัปโหลดได้ (images/attachments/signatures) **ทำแล้ว** · ที่เหลือ: สแกนไวรัส, signed URL สำหรับไฟล์ภายใน (bucket ยังเป็น public) | กลาง |
| R5 | รวม config | ค่า Supabase/webhook กระจาย 13+ ไฟล์ในเดิม (Issue #9) → ตอนนี้อยู่ `.env` ที่เดียว | ทำแล้ว |
| R6 | ลบ legacy | คอลัมน์ตายใน tickets (Issue #7), สถานะ MGR_WAIT (Issue #8), ตาราง itl_services ถ้าไม่ใช้ | ต่ำ |
| R7 | webhook ngrok | เปลี่ยนเป็นโดเมนถาวรเมื่อ n8n พร้อม (Issue #10) | ต่ำ |
| R8 | Server-side authorization | trigger `ict_enforce_ticket_update` ตรวจการเปลี่ยนสถานะตามบทบาท ICO<ITL<ITM, ห้ามแก้ token/ผลอนุมัติหัวหน้า/คะแนนประเมิน, log แก้/ลบไม่ได้ | **ทำแล้ว** |
| R9 | หน้าจัดการผู้ใช้/แผนก/ตั้งค่า | ระบบเดิมไม่มี (จัดการใน Supabase) — ถ้าต้องการให้เป็นงานแยก | — |
| R10 | Excel | `xlsx@0.18.5` บน npm ไม่ได้รับการอัปเดตความปลอดภัย (ใช้เฉพาะ *เขียน* ไฟล์ จึงความเสี่ยงต่ำ) — พิจารณา `exceljs` ภายหลัง | ต่ำ |
| R11 | Rate limit / CAPTCHA | ฟอร์มแจ้งปัญหาเปิดสาธารณะ ควรมี Turnstile/hCaptcha + rate limit | กลาง |
| R12 | Sequence เลขที่ตั๋ว | `create_ticket` ออกเลขภายใต้ advisory lock (เวลาไทย) | **ทำแล้ว** |
| R14 | อนุมัติแทนหัวหน้า | ระหว่างยังไม่มีอีเมลอัตโนมัติ ผู้แจ้งเห็นลิงก์อนุมัติเอง → ต้องส่งลิงก์จากฝั่งเซิร์ฟเวอร์ (R3) จึงจะปิดได้ · ตอนนี้บล็อกเฉพาะอีเมลหัวหน้า = อีเมลผู้แจ้ง | สูง |
| R13 | Audit | เก็บ IP/UA ของผู้อนุมัติผ่านลิงก์ (ตอนนี้บันทึกเฉพาะชื่อ/ลายเซ็น) | ต่ำ |

## ความแตกต่างจากระบบเดิม (ตั้งใจ)
1. ลิงก์ใช้ token แทน ticket_no (R1) · ตัด `NEXT_PUBLIC_ALLOW_LEGACY_LINKS` ออก (หน้าเว็บปฏิเสธ token ที่ไม่ใช่ hex อยู่แล้ว จึงไม่เคยทำงาน)
6. ลิงก์หัวหน้างานใช้ได้ครั้งเดียว — เดิมถ้า ICO รับงานก่อนหัวหน้าอนุมัติ (สถานะ ICO_WORK) ลิงก์เดิมยังกด "ไม่อนุมัติ" ซ้ำได้
7. อีเมลหัวหน้างานต้องไม่ซ้ำกับอีเมลผู้แจ้ง (เอกสารเดิมระบุไว้ แต่โค้ดยังไม่ตรวจ)
2. priority ใน Report อ่านจาก ticket_services (เดิมอ้างคอลัมน์ที่ไม่มี)
3. แก้คีย์ reset-password ที่พิมพ์ผิด
4. banner ตีกลับ ITM→ITL (เดิม dashboard ไม่ตรวจ)
5. Dashboard ใช้ SVG แทน Chart.js
