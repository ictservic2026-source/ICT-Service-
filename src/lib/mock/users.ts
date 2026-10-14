import type { Profile } from '@/types';

/** บัญชีเจ้าหน้าที่จำลอง (profiles) — รหัสผ่านทุกบัญชีใน Mock = demo1234 */
export const DEMO_PASSWORD = 'demo1234';

export const MOCK_USERS: Profile[] = [
  { id: 'u-ico-1', display_name: 'ธนากร ศรีสุข', role: 'ICO', is_active: true, email: 'ico@nissei.demo' },
  { id: 'u-ico-2', display_name: 'สุรชัย แก้วมณี', role: 'ICO', is_active: true, email: 'ico2@nissei.demo' },
  { id: 'u-itl-1', display_name: 'วรพงษ์ ตั้งใจดี', role: 'ITL', is_active: true, email: 'itl@nissei.demo' },
  { id: 'u-itm-1', display_name: 'ประสิทธิ์ มั่นคง', role: 'ITM', is_active: true, email: 'itm@nissei.demo' },
];

export interface MockRequester {
  name: string;
  department: string;
  email: string;
  managerEmail: string;
  location: string;
}

export const MOCK_REQUESTERS: MockRequester[] = [
  { name: 'สมชาย ใจดี', department: 'HR', email: 'somchai.j@nissei.demo', managerEmail: 'hr.manager@nissei.demo', location: 'อาคาร A ชั้น 2 ห้อง HR' },
  { name: 'วิภาวดี รักงาน', department: 'ACC/FN', email: 'wipawadee.r@nissei.demo', managerEmail: 'acc.manager@nissei.demo', location: 'อาคาร A ชั้น 3 ฝ่ายบัญชี' },
  { name: 'ณัฐพล สุขสวัสดิ์', department: 'QAQC', email: 'nattapon.s@nissei.demo', managerEmail: 'qa.manager@nissei.demo', location: 'อาคาร B ห้องแล็บ QC' },
  { name: 'พิมพ์ชนก ดวงดี', department: 'PD/Injection', email: 'pimchanok.d@nissei.demo', managerEmail: 'pd.manager@nissei.demo', location: 'โรงงาน 1 ไลน์ Injection' },
  { name: 'อนุชา พงษ์ไพร', department: 'Store', email: 'anucha.p@nissei.demo', managerEmail: 'store.manager@nissei.demo', location: 'คลังสินค้า โซน C' },
  { name: 'กัญญา มีสุข', department: 'การตลาด', email: 'kanya.m@nissei.demo', managerEmail: 'mkt.manager@nissei.demo', location: 'อาคาร A ชั้น 4 ฝ่ายการตลาด' },
  { name: 'ภาณุวัฒน์ เจริญผล', department: 'PE/MA', email: 'panuwat.c@nissei.demo', managerEmail: 'pe.manager@nissei.demo', location: 'โรงงาน 2 ห้อง MA' },
  { name: 'ศิริพร ทองคำ', department: 'PU', email: 'siriporn.t@nissei.demo', managerEmail: 'pu.manager@nissei.demo', location: 'อาคาร A ชั้น 2 จัดซื้อ' },
  { name: 'ธีรยุทธ ชัยมงคล', department: 'IM-EX', email: 'teerayut.c@nissei.demo', managerEmail: 'imex.manager@nissei.demo', location: 'อาคาร A ชั้น 1 Import-Export' },
  { name: 'ปรียา วงศ์สวัสดิ์', department: 'R&D', email: 'preeya.w@nissei.demo', managerEmail: 'rd.manager@nissei.demo', location: 'อาคาร B ห้อง R&D' },
  { name: 'ชัยวัฒน์ บุญมา', department: 'PD/Packing', email: 'chaiwat.b@nissei.demo', managerEmail: 'pd.manager@nissei.demo', location: 'โรงงาน 1 ไลน์ Packing' },
  { name: 'นภัสสร อินทร์แก้ว', department: 'GA', email: 'napatsorn.i@nissei.demo', managerEmail: 'ga.manager@nissei.demo', location: 'อาคาร A ชั้น 1 GA' },
];
