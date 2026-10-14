# INVENTORY — ระบบเดิม → Next.js (Function Mapping)

ต้นฉบับ: HTML/CSS/JS + Supabase REST (NISSEI TRADING (THAILAND)) · ปลายทาง: Next.js App Router + TypeScript
สถานะ: ✅ ย้ายแล้วและทดสอบ · ➕ เพิ่มจากเดิม (Recommendation) · ⚠️ ข้อสังเกต

## 1) หน้า / Route
| หน้าเดิม | Route ใหม่ | ผู้ใช้ | สถานะ |
|---|---|---|---|
| index.html (แจ้งปัญหา) | `/` (landing) + `/request` | ผู้แจ้ง (ไม่ login) | ✅ |
| approve.html?no= | `/approve/[token]` | หัวหน้างาน (secure token) | ✅ ➕ token |
| survey.html?no= | `/survey/[token]` | ผู้แจ้ง | ✅ ➕ token |
| (ไม่มี) | `/track/[token]` ติดตามสถานะ | ผู้แจ้ง | ➕ |
| login.html / forgot-password.html / reset-password.html | `/login` `/forgot-password` `/reset-password` | เจ้าหน้าที่ | ✅ (⚠️ แก้ key พิมพ์ผิดของเดิม — Issue #1) |
| admin-ico.html | `/ico` (ภาพรวม + รายการ + Modal) | ICO/ITL/ITM | ✅ |
| admin-itl.html | `/itl` | ITL/ITM | ✅ |
| admin-itm.html | `/itm` | ITM | ✅ |
| dashboard.html | `/dashboard` | ICO/ITL/ITM | ✅ |
| report-export.html | `/reports` | ICO/ITL/ITM | ✅ (เดิมไฟล์ JS หาย — เขียนใหม่ตามสเปก) |
| (ไม่มี) | `/demo` ศูนย์ทดสอบ (เฉพาะ mock) | ทุกบทบาท | ➕ |

หน้า Users / Departments / Settings **ไม่มีในระบบเดิม** จึงไม่สร้าง (ไม่เพิ่มฟังก์ชันนอกขอบเขต) — ดู RECOMMENDATIONS ข้อ R9

## 2) Workflow / สถานะ
`OPEN → ICO_WORK → ITL_WAIT → ITM_WAIT → ICO_FINAL → DONE → survey` พร้อมเส้นทางอื่น: REJECTED, BACK_TO_ICO (ITL/ITM), BACK_TO_ITL (ITM), CANCELLED (ITM), Direct ITL (ICO ส่งตรง; ITM ตีกลับ ICO ไม่ได้), MGR_WAIT (legacy)
โค้ด: `src/lib/workflow/machine.ts` (pure) — ครอบคลุมด้วย `scripts/test-workflow.ts` (49 assertions)

## 3) ฟังก์ชันเดิม → โค้ดใหม่
| ฟังก์ชันเดิม | ที่ใหม่ |
|---|---|
| index.js submitForm (+validate/upload) | `validation/index.ts`, `TicketActions.submitRequest`, `/request` |
| approve.js doAction / ลายเซ็น (พิมพ์/วาด) / ล็อกกดซ้ำ `status=in.(…)` | `machine.managerDecision`, `SignaturePad`, `Repository.commit(guard)` |
| admin-ico.js saveService / sendToITL / directForward / closeWork | `icoSaveWork`, `icoDirectForward`, `icoClose`, `TicketModal` |
| admin-itl.js saveITLWork / doAction | `itlSaveWork`, `itlDecision` |
| admin-itm.js doAction (4 ทาง, Direct ห้าม BACK_TO_ICO) | `itmDecision` |
| bounce detection (loadBounceMap) | `latestStepLog`, `isBounced`, แถวสีแดง + banner |
| isTeamChat / log 5 ต่อหน้า / @mention / INTERNAL_NOTE | `LogThread.tsx` |
| read receipts (comment_reads) / notify.js กระดิ่ง | `markRead`, `getMyReadLogIds`, `NotifyBell` |
| ws-bar.js (work_status_master, quick update) | `WorkStatus.tsx`, `updateWorkStatus` |
| survey.js (5 ข้อ 30/30/20/10/10, KPI 96) | `/survey/[token]`, `surveySubmit`, `SURVEY_KPI_THRESHOLD` |
| dashboard.js v2: 10 โหมดช่วงเวลา, กลุ่ม KPI, queue, cost ICO/ITL, satisfaction, หมวด/แผนก, 12 เดือน, survey tracking, drilldown | `analytics/dashboard.ts` + `/dashboard` |
| report-export.js (4 ชีต, SheetJS) | `reports/report.ts` + `/reports` |
| protected-page.js (data-roles) | `StaffShell roles=[…]` |
| Make.com/ngrok webhook | `AutomationService` (Mock / n8n) |
| อีเมลอนุมัติ/ยืนยัน/แจ้งสถานะ/ลิงก์ประเมิน | `automation/templates.ts` (แสดงใน Outbox) |

## 4) ตาราง Supabase ที่ใช้ (ไม่เปลี่ยนโครงสร้าง ยกเว้น migration 001: คอลัมน์ token, unique index แบบประเมิน, RLS/RPC/trigger)
tickets · ticket_services (work_owner ICO|ITL) · tickets_log · ticket_survey (score_total เป็น generated column — ไม่เขียนค่า) · work_status_master · comment_reads · profiles · Storage `ticket-files`

## 5) Gap / ข้อสังเกต
- ความสำคัญ (priority): เดิม report กรองที่ `tickets.priority` ซึ่งไม่มีจริง → ใหม่อ่านจาก `ticket_services.priority` (Issue #5)
- itl_services (Issue #3): ระบบปัจจุบันใช้ `ticket_services.work_owner='ITL'` แทน — dashboard/report ใหม่รวมให้แล้ว
- Dashboard ใหม่แสดง priority + work_status แล้ว (Issue #4)
- ตีกลับ ITM→ITL: ใหม่มี banner ใน Modal (`isBouncedToItl`) — เดิม dashboard ไม่ตรวจ (Issue #11)
