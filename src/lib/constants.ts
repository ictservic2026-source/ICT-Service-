import type { JobCategory, Priority, Role, TicketStatus, WorkStatusMaster } from '@/types';

/** รายการฝ่าย/แผนก — คัดลอกจาก <select id="department"> ของ index.html เดิม */
export const DEPARTMENTS = [
  'EOP', 'ACC/FN', 'QAQC', 'ST', 'QS', 'Store', 'การตลาด', 'Sale&EN', 'R&D', 'PU', 'PC', 'HR', 'GA',
  'IM-EX', 'ICT', 'PD/Injection', 'PD/Dip molding', 'PD/Extrusion', 'PD/Packing', 'PD/Dip coating',
  'PE', 'PE/MA', 'Other',
] as const;

export const JOB_CATEGORIES: { value: JobCategory; label: string }[] = [
  { value: 'Hardware', label: 'Hardware' },
  { value: 'Software', label: 'Software' },
  { value: 'Network', label: 'Network' },
  { value: 'Other', label: 'อื่นๆ' },
];

export const PRIORITIES: { value: Priority; label: string; hint: string }[] = [
  { value: 'NORMAL', label: 'ปกติ', hint: 'NORMAL' },
  { value: 'URGENT', label: 'ด่วน', hint: 'URGENT' },
];

export const CLOSE_RESULTS = [
  { value: 'RESOLVED', label: '✅ แก้ไขสำเร็จ' },
  { value: 'PARTIAL', label: '⚡ แก้ไขบางส่วน' },
  { value: 'REPLACED', label: '🔄 เปลี่ยนอุปกรณ์' },
  { value: 'OUTSOURCE', label: '🏭 ส่งซ่อมภายนอก' },
] as const;

/** สถานะตั๋ว — label/สีตามระบบเดิม (OPEN=ฟ้า, ICO=ม่วง, ITL=ส้ม, ITM=teal, DONE=เขียว, แดง=ปฏิเสธ/ยกเลิก) */
export const STATUS_META: Record<
  TicketStatus,
  { label: string; short: string; tone: 'blue' | 'amber' | 'purple' | 'orange' | 'cyan' | 'teal' | 'green' | 'red' | 'slate'; pending: boolean }
> = {
  OPEN: { label: 'รอหัวหน้างานอนุมัติ', short: 'คำขอใหม่', tone: 'blue', pending: true },
  MGR_WAIT: { label: 'รอหัวหน้างานอนุมัติ', short: 'รอหัวหน้า', tone: 'amber', pending: true },
  ICO_WORK: { label: 'ICO กำลังดำเนินการ', short: 'ICO ดำเนินการ', tone: 'purple', pending: true },
  ITL_WAIT: { label: 'รอ ITL ตรวจสอบ', short: 'รอ ITL', tone: 'orange', pending: true },
  ITM_WAIT: { label: 'รอ IT Manager อนุมัติ', short: 'รอ IT MGR', tone: 'cyan', pending: true },
  ICO_FINAL: { label: 'รอ ICO ปิดงาน', short: 'รอปิดงาน', tone: 'teal', pending: true },
  DONE: { label: 'ปิดงานแล้ว', short: 'เสร็จสิ้น', tone: 'green', pending: false },
  REJECTED: { label: 'หัวหน้างานไม่อนุมัติ', short: 'ไม่อนุมัติ', tone: 'red', pending: false },
  CANCELLED: { label: 'ยกเลิกงาน', short: 'ยกเลิก', tone: 'slate', pending: false },
};

export const STATUS_ORDER: TicketStatus[] = [
  'OPEN', 'MGR_WAIT', 'ICO_WORK', 'ITL_WAIT', 'ITM_WAIT', 'ICO_FINAL', 'DONE', 'REJECTED', 'CANCELLED',
];

/** ขั้นตอนใน stepper (ตาม TK_STEPS ของ dashboard.js เดิม) */
export const TICKET_STEPS: { status: TicketStatus; label: string }[] = [
  { status: 'OPEN', label: 'แจ้งงาน' },
  { status: 'ICO_WORK', label: 'ICO ทำงาน' },
  { status: 'ITL_WAIT', label: 'ITL ตรวจ' },
  { status: 'ITM_WAIT', label: 'IT MGR อนุมัติ' },
  { status: 'ICO_FINAL', label: 'รอปิดงาน' },
  { status: 'DONE', label: 'เสร็จสิ้น' },
];

export const ROLE_LABEL: Record<Role, string> = {
  ICO: 'ICO',
  ITL: 'ITL (หัวหน้า ICO)',
  ITM: 'IT Manager',
};
export const ROLE_PORTAL: Record<Role, string> = { ICO: '/ico', ITL: '/itl', ITM: '/itm' };

/** ชื่อขั้นตอนใน tickets_log (step_name) → ป้ายภาษาไทย */
export const STEP_LABEL: Record<string, string> = {
  MANAGER_APPROVE: 'หัวหน้างาน',
  ICO_CHECK: 'ICO',
  ICT_ACTION: 'ICO/ช่าง',
  ITL_WORK: 'ITL (บันทึกงาน)',
  ITL_APPROVE: 'ITL',
  IT_MGR_APPROVE: 'IT Manager',
  WORK_STATUS: 'สถานะงาน',
};

export const LOG_STATUS_TH: Record<string, string> = {
  APPROVED: 'อนุมัติ', REJECTED: 'ปฏิเสธ', DRAFT: 'บันทึกร่าง', DONE: 'ปิดงาน', CANCELLED: 'ยกเลิก',
  BACK_TO_ICO: 'ตีกลับให้ ICO', BACK_TO_ITL: 'ตีกลับให้ ITL', DIRECT_FORWARD_ITL: 'ICO ส่งให้ ITL ทำเอง',
  COMMENT: 'คอมเมนต์', INTERNAL_NOTE: 'บันทึกภายใน', SUBMITTED: 'ส่งต่อ', WORK_STATUS: 'สถานะงาน',
};

/** work_status_master — ค่า fallback เดียวกับ WS_FALLBACK ในโค้ดเดิม (admin-ico.js) */
export const WORK_STATUS_FALLBACK: WorkStatusMaster[] = [
  { code: 'WS_DIAG', name_th: 'กำลังตรวจสอบอาการ', category: 'PROGRESS', category_th: 'กำลังดำเนินการ', icon: '🔍', color: '#2563eb', sort_order: 1 },
  { code: 'WS_REPAIR', name_th: 'กำลังซ่อม', category: 'PROGRESS', category_th: 'กำลังดำเนินการ', icon: '🔧', color: '#2563eb', sort_order: 2 },
  { code: 'WS_TEST', name_th: 'กำลังทดสอบ', category: 'PROGRESS', category_th: 'กำลังดำเนินการ', icon: '🧪', color: '#2563eb', sort_order: 3 },
  { code: 'WS_QUOTE', name_th: 'รอใบเสนอราคา', category: 'PROCUREMENT', category_th: 'จัดซื้อ/จัดหา', icon: '📄', color: '#f59e0b', sort_order: 4 },
  { code: 'WS_PO', name_th: 'รออนุมัติ PO', category: 'PROCUREMENT', category_th: 'จัดซื้อ/จัดหา', icon: '📝', color: '#f59e0b', sort_order: 5 },
  { code: 'WS_PART', name_th: 'รออะไหล่/เครื่อง', category: 'PROCUREMENT', category_th: 'จัดซื้อ/จัดหา', icon: '📦', color: '#f59e0b', sort_order: 6 },
  { code: 'WS_USER', name_th: 'รอผู้ใช้ตอบกลับ', category: 'WAITING', category_th: 'รอ/ค้าง', icon: '👤', color: '#8b5cf6', sort_order: 7 },
  { code: 'WS_VENDOR', name_th: 'รอผู้ขาย/ช่างนอก', category: 'WAITING', category_th: 'รอ/ค้าง', icon: '🏢', color: '#8b5cf6', sort_order: 8 },
  { code: 'WS_HOLD', name_th: 'พักงานชั่วคราว', category: 'WAITING', category_th: 'รอ/ค้าง', icon: '⏸️', color: '#8b5cf6', sort_order: 9 },
  { code: 'WS_DONE', name_th: 'ซ่อมเสร็จ', category: 'CLOSED', category_th: 'ปิดงาน', icon: '✅', color: '#16a34a', sort_order: 10 },
  { code: 'WS_REPLACE', name_th: 'เปลี่ยนเครื่องใหม่', category: 'CLOSED', category_th: 'ปิดงาน', icon: '🔄', color: '#16a34a', sort_order: 11 },
  { code: 'WS_CANCEL', name_th: 'ยกเลิกงาน', category: 'CLOSED', category_th: 'ปิดงาน', icon: '❌', color: '#6b7280', sort_order: 12 },
];

export const WS_CATEGORY_ORDER = ['PROGRESS', 'PROCUREMENT', 'WAITING', 'CLOSED'] as const;
export const WS_CATEGORY_TH: Record<string, string> = {
  PROGRESS: 'กำลังดำเนินการ', PROCUREMENT: 'จัดซื้อ/จัดหา', WAITING: 'รอ/ค้าง', CLOSED: 'ปิดงาน',
};

/** แบบประเมินความพึงพอใจ — เกณฑ์คะแนนจาก survey.js (Q1=30, Q2=30, Q3=20, Q4=10, Q5=10 รวม 100) */
export const SURVEY_ITEMS = [
  { n: 1, max: 30, label: 'แก้ไขตรงตามรายการที่แจ้ง', short: 'แก้ไขตรงรายการ' },
  { n: 2, max: 30, label: 'ระยะเวลาดำเนินการ (ตรงตามเวลา)', short: 'ตรงตามเวลา' },
  { n: 3, max: 20, label: 'การอธิบาย / ให้คำแนะนำ', short: 'การอธิบาย' },
  { n: 4, max: 10, label: 'ความสุภาพ / มารยาทของเจ้าหน้าที่', short: 'ความสุภาพ' },
  { n: 5, max: 10, label: 'ความพึงพอใจโดยรวม', short: 'พึงพอใจรวม' },
] as const;
export const SURVEY_MAX_TOTAL = 100;
/** ต่ำกว่านี้ถือว่าไม่ถึง KPI (dashboard.js: SURVEY_KPI_THRESHOLD) */
export const SURVEY_KPI_THRESHOLD = 96;

export const MENTION_OPTIONS: { value: '' | Role; label: string }[] = [
  { value: '', label: '💬 ทั้งทีม (ไม่ระบุ)' },
  { value: 'ICO', label: '🎯 ถึง ICO' },
  { value: 'ITL', label: '🎯 ถึง ITL' },
  { value: 'ITM', label: '🎯 ถึง IT Manager' },
];

export const MAX_UPLOAD_MB = 10;
export const ALLOWED_UPLOAD_EXT = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip',
];
