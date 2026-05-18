import type { ApplicantFieldDef } from '@/types/form';

// 語意鍵 → 輸入欄位定義的映射表
export const FIELD_DEF_MAP: Record<string, Omit<ApplicantFieldDef, 'required'>> = {
  applicant_name: { key: 'applicant_name', label: '申請人姓名', type: 'text' },
  applicant_id_number: { key: 'applicant_id_number', label: '身分證字號', type: 'id' },
  applicant_birth_date: { key: 'applicant_birth_date', label: '出生日期', type: 'date' },
  applicant_phone: { key: 'applicant_phone', label: '聯絡電話', type: 'tel' },
  applicant_address: { key: 'applicant_address', label: '戶籍地址', type: 'text' },
  applicant_email: { key: 'applicant_email', label: 'E-mail', type: 'text' },
  institution_name: { key: 'institution_name', label: '機構/公司名稱', type: 'text' },
  institution_tax_id: { key: 'institution_tax_id', label: '統一編號', type: 'text' },
};
