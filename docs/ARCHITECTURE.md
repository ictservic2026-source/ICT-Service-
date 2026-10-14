# ARCHITECTURE

```
UI (Next.js App Router, client components)
  └─ hooks (useServices/useSnapshot/…)  ──  AppProvider (services, session, snapshot store, theme, toast)
       └─ TicketActions  (use-case: machine + repository + automation)
            ├─ workflow/machine.ts      กติกาล้วน → คืน Transition {ticketPatch, servicePatch, logs, event}
            ├─ Repository (interface)   MockRepository (localStorage) | SupabaseRepository (ตารางเดิม)
            └─ AutomationService        MockAutomation (Outbox) | N8nAutomation (POST webhook)
```
หลักการ: UI ไม่รู้ว่าข้างหลังเป็น Mock/Supabase/n8n · สลับด้วย env เท่านั้น
`NEXT_PUBLIC_DATA_SOURCE` (ว่าง = supabase จริง · `mock` = ข้อมูลจำลองเฉพาะทดสอบ) · `NEXT_PUBLIC_AUTOMATION_MODE=mock|n8n` + `NEXT_PUBLIC_N8N_WEBHOOK_URL`

## โครงสร้างโฟลเดอร์
`src/app` routes · `src/components/{ui,layout,tickets,portal,dashboard,forms,survey}` · `src/lib/{workflow,services,automation,analytics,reports,validation,mock,supabase,utils}` · `src/types` · `supabase/` · `docs/` · `scripts/`

## Mock data (`lib/mock/`)
seed ถูกสร้างโดย "เล่นซ้ำ" workflow machine จริง (ไม่ใช่ข้อมูลที่เขียนมือ) → log/สถานะ/คะแนนสอดคล้องกัน (≈117 ตั๋ว, 76 แบบประเมิน, หลายแผนก/ประเภท/ค่าใช้จ่าย, กรณีตีกลับ/Direct ITL/ยกเลิก/ไม่อนุมัติ) · เก็บใน localStorage · `/demo` รีเซ็ตได้

## Automation Service (พร้อมสลับ n8n)
`dispatch(event, ticket, origin) → AutomationReceipt` ส่ง payload รูปแบบเดียวกับ webhook เดิม (event, action, new_status, ticket_no, requester/manager email, …, approve_link/survey_link/track_link)
- Mock: สร้างอีเมล/แจ้งเตือนจำลองจาก `templates.ts` → Outbox (+ statusLabel "Email Sent", "Workflow Completed")
- n8n: `POST` ไป webhook; ล้มเหลวไม่ทำให้ workflow หลักล้ม (fire-and-forget เหมือนเดิม) ดู R3
- ปัจจุบัน**ไม่พึ่ง n8n**: ปล่อย mode=mock

## Security
- ลิงก์สาธารณะ: token 64 hex (สร้างใน DB) · `/approve` `/survey` `/track` เรียก `Repository.getPublicTicket(kind, token)` → RPC `get_public_ticket` คืนเฉพาะข้อมูลที่ลิงก์นั้นใช้ (`lib/services/publicView.ts` คือกติกาเดียวกันฝั่ง mock)
- ผู้ใช้ไม่ล็อกอินเขียนข้อมูลผ่าน RPC เท่านั้น (`create_ticket`, `manager_decide`, `submit_survey`) — machine.ts ยังตรวจกติกาฝั่ง client เพื่อ UX และสร้าง automation event; SQL ตรวจซ้ำเป็นด่านจริง
- เจ้าหน้าที่: RLS (`ict_is_staff()`) + trigger ตรวจการเปลี่ยนสถานะตามบทบาท — ตาราง transition ใน SQL ต้องแก้คู่กับ `workflow/machine.ts`
- ป้องกันกดซ้ำ: `commit(..., guardStatuses)` อัปเดตเฉพาะเมื่อสถานะยังอยู่ในชุดที่อนุญาต
- XSS: React escape ทุกข้อความ (ไม่ใช้ dangerouslySetInnerHTML); ลิงก์ไฟล์/ลายเซ็นตรวจ scheme (`http(s):`/`data:image`)
- Validation: ตัวตรวจสอบเขียนเอง ใน `validation/index.ts` (ชื่อ/อีเมล/วันที่/ความยาว/อีเมลหัวหน้า ≠ ผู้แจ้ง)
- Upload: ตรวจนามสกุล whitelist + ขนาด ≤ 10 MB ฝั่ง client และฝั่ง bucket (migration 001) · anon อัปโหลดได้เฉพาะ images/ attachments/ signatures/
- Route guard: `StaffShell roles` ใช้เพื่อ UX — สิทธิ์จริงอยู่ที่ RLS/trigger
- Excel: ป้องกัน formula injection (`safeCell`)
- anon key เท่านั้นในฝั่ง client; ห้ามใส่ service_role

## Theme / UI
Tailwind v4 (`@theme inline`) + CSS variables, light/dark (`.dark`), ฟอนต์ Prompt + Inter, responsive (ทดสอบ 390px), a11y: focus trap/Esc ใน Modal, aria-live, label ครบ, คีย์บอร์ดเปิดแถว
กราฟ Dashboard เป็น SVG/CSS (ทดสอบอัตโนมัติได้, พิมพ์ได้) — `chart.js`/`react-chartjs-2` ยังอยู่ใน package.json เผื่อสลับในอนาคต
