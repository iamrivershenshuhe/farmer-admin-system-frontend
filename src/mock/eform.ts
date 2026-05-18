import type { EFormTemplate, FormFieldCoord, FormSessionRecord } from '@/types/form';

// 模板 ID 前綴遵循 FT_<BT_ID>_<序號> 命名，businessTypeId 指向組織 BT（BT001…）

export function coord(
  id: string,
  templateId: string,
  fieldKey: string,
  label: string,
  required = true,
  page = 1
): FormFieldCoord {
  return {
    id,
    templateId,
    fieldKey,
    label,
    page,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    fontSize: 10,
    required,
  };
}

// --- 模板資料（掛載到組織業務別 ID）---
// 信用部 BT001（放款業務）→ 3 個模板
// 信用部 BT002（存款業務）→ 2 個模板
// 供銷部 BT004（農產品銷售）→ 2 個模板
// 推廣部 BT006（農業推廣）→ 2 個模板

export const MOCK_TEMPLATES: EFormTemplate[] = [
  // ── 信用部・放款業務（BT001）──────────────────────────────────────────────────
  {
    id: 'FT_BT001_APPLY',
    businessTypeId: 'BT001',
    pdfFileName: '汐止區農會授信申請書.pdf',
    active: true,
    fields: [
      coord('F001', 'FT_BT001_APPLY', 'applicant_name', '申請人姓名', true),
      coord('F002', 'FT_BT001_APPLY', 'applicant_id_number', '身分證字號', true),
      coord('F003', 'FT_BT001_APPLY', 'applicant_birth_date', '出生（設立）日期', true),
      coord('F004', 'FT_BT001_APPLY', 'applicant_address', '住址（營業處所）', true),
    ],
  },
  {
    id: 'FT_BT001_PERSONAL',
    businessTypeId: 'BT001',
    pdfFileName: '個人資料表.pdf',
    active: true,
    fields: [
      coord('F005', 'FT_BT001_PERSONAL', 'applicant_name', '姓名', true),
      coord('F006', 'FT_BT001_PERSONAL', 'applicant_id_number', '身分證統一編號', true),
      coord('F007', 'FT_BT001_PERSONAL', 'applicant_birth_date', '出生日期', true),
      coord('F008', 'FT_BT001_PERSONAL', 'applicant_address', '戶籍地', true),
      coord('F009', 'FT_BT001_PERSONAL', 'applicant_phone', '電話（手機）', false),
      coord('F010', 'FT_BT001_PERSONAL', 'applicant_email', 'E-mail', false),
    ],
  },
  {
    id: 'FT_BT001_RELATION',
    businessTypeId: 'BT001',
    pdfFileName: '汐止區農會同一關係人資料表.pdf',
    active: true,
    fields: [
      coord('F011', 'FT_BT001_RELATION', 'applicant_name', '姓名', true),
      coord('F012', 'FT_BT001_RELATION', 'applicant_id_number', '身分證統一編號', true),
      coord('F013', 'FT_BT001_RELATION', 'applicant_phone', '聯絡電話', false),
    ],
  },
  // ── 信用部・存款業務（BT002）──────────────────────────────────────────────────
  {
    id: 'FT_BT002_OPEN',
    businessTypeId: 'BT002',
    pdfFileName: '開戶申請書.pdf',
    active: true,
    fields: [
      coord('F020', 'FT_BT002_OPEN', 'applicant_name', '姓名', true),
      coord('F021', 'FT_BT002_OPEN', 'applicant_id_number', '身分證字號', true),
      coord('F022', 'FT_BT002_OPEN', 'applicant_birth_date', '出生日期', true),
      coord('F023', 'FT_BT002_OPEN', 'applicant_address', '戶籍地址', true),
    ],
  },
  {
    id: 'FT_BT002_SEAL',
    businessTypeId: 'BT002',
    pdfFileName: '印鑑卡.pdf',
    active: true,
    fields: [
      coord('F024', 'FT_BT002_SEAL', 'applicant_name', '姓名', true),
      coord('F025', 'FT_BT002_SEAL', 'applicant_phone', '聯絡電話', false),
    ],
  },
  // ── 供銷部・農產品銷售（BT004）────────────────────────────────────────────────
  {
    id: 'FT_BT004_CONSIGN',
    businessTypeId: 'BT004',
    pdfFileName: '農產品委託銷售申請書.pdf',
    active: true,
    fields: [
      coord('F030', 'FT_BT004_CONSIGN', 'applicant_name', '委託人姓名', true),
      coord('F031', 'FT_BT004_CONSIGN', 'applicant_id_number', '身分證字號', true),
      coord('F032', 'FT_BT004_CONSIGN', 'applicant_phone', '聯絡電話', false),
    ],
  },
  {
    id: 'FT_BT004_RECEIPT',
    businessTypeId: 'BT004',
    pdfFileName: '收購收據.pdf',
    active: true,
    fields: [
      coord('F033', 'FT_BT004_RECEIPT', 'applicant_name', '姓名', true),
      coord('F034', 'FT_BT004_RECEIPT', 'applicant_address', '地址', true),
    ],
  },
  // ── 推廣部・農業推廣（BT006）──────────────────────────────────────────────────
  {
    id: 'FT_BT006_COURSE',
    businessTypeId: 'BT006',
    pdfFileName: '農業課程報名表.pdf',
    active: true,
    fields: [
      coord('F040', 'FT_BT006_COURSE', 'applicant_name', '姓名', true),
      coord('F041', 'FT_BT006_COURSE', 'applicant_phone', '聯絡電話', false),
      coord('F042', 'FT_BT006_COURSE', 'applicant_email', 'E-mail', false),
    ],
  },
  {
    id: 'FT_BT006_SUBSIDY',
    businessTypeId: 'BT006',
    pdfFileName: '農業補助申請書.pdf',
    active: true,
    fields: [
      coord('F043', 'FT_BT006_SUBSIDY', 'applicant_name', '申請人姓名', true),
      coord('F044', 'FT_BT006_SUBSIDY', 'applicant_id_number', '身分證字號', true),
      coord('F045', 'FT_BT006_SUBSIDY', 'applicant_address', '戶籍地址', true),
    ],
  },
];

// --- 歷程 mock 資料（跨帳號跨部門，供 RBAC 三角色測試）---
// USER001(admin)、USER002(manager 信用部)、USER003(user 信用部 BT001)、
// USER004(user 供銷部 BT004)、USER006(manager 推廣部)

let sessionCounter = 10; // 預留給 generate POST 寫入時自增

export function nextSessionId(): string {
  sessionCounter += 1;
  return `S${String(sessionCounter).padStart(3, '0')}`;
}

// mockSessions 為可變陣列，generate POST 會 unshift 寫入
export const mockSessions: FormSessionRecord[] = [
  {
    id: 'S001',
    businessTypeId: 'BT001',
    businessTypeName: '放款業務',
    departmentId: 'DEPT001',
    templateIds: ['FT_BT001_APPLY', 'FT_BT001_PERSONAL'],
    generatedFiles: [
      {
        templateId: 'FT_BT001_APPLY',
        filename: '汐止區農會授信申請書.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT001_APPLY.pdf',
      },
      {
        templateId: 'FT_BT001_PERSONAL',
        filename: '個人資料表.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT001_PERSONAL.pdf',
      },
    ],
    createdBy: '張三',
    createdById: 'USER003',
    createdByDepartmentId: 'DEPT001',
    createdAt: '2026-03-15 14:30:00',
  },
  {
    id: 'S002',
    businessTypeId: 'BT001',
    businessTypeName: '放款業務',
    departmentId: 'DEPT001',
    templateIds: ['FT_BT001_APPLY', 'FT_BT001_RELATION'],
    generatedFiles: [
      {
        templateId: 'FT_BT001_APPLY',
        filename: '汐止區農會授信申請書.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT001_APPLY.pdf',
      },
      {
        templateId: 'FT_BT001_RELATION',
        filename: '汐止區農會同一關係人資料表.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT001_RELATION.pdf',
      },
    ],
    createdBy: '王經理',
    createdById: 'USER002',
    createdByDepartmentId: 'DEPT001',
    createdAt: '2026-03-14 16:00:00',
  },
  {
    id: 'S003',
    businessTypeId: 'BT002',
    businessTypeName: '存款業務',
    departmentId: 'DEPT001',
    templateIds: ['FT_BT002_OPEN', 'FT_BT002_SEAL'],
    generatedFiles: [
      {
        templateId: 'FT_BT002_OPEN',
        filename: '開戶申請書.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT002_OPEN.pdf',
      },
      {
        templateId: 'FT_BT002_SEAL',
        filename: '印鑑卡.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT002_SEAL.pdf',
      },
    ],
    createdBy: '王經理',
    createdById: 'USER002',
    createdByDepartmentId: 'DEPT001',
    createdAt: '2026-03-13 10:20:00',
  },
  {
    id: 'S004',
    businessTypeId: 'BT004',
    businessTypeName: '農產品銷售',
    departmentId: 'DEPT002',
    templateIds: ['FT_BT004_CONSIGN'],
    generatedFiles: [
      {
        templateId: 'FT_BT004_CONSIGN',
        filename: '農產品委託銷售申請書.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT004_CONSIGN.pdf',
      },
    ],
    createdBy: '李四',
    createdById: 'USER004',
    createdByDepartmentId: 'DEPT002',
    createdAt: '2026-03-12 11:00:00',
  },
  {
    id: 'S005',
    businessTypeId: 'BT006',
    businessTypeName: '農業推廣',
    departmentId: 'DEPT003',
    templateIds: ['FT_BT006_COURSE', 'FT_BT006_SUBSIDY'],
    generatedFiles: [
      {
        templateId: 'FT_BT006_COURSE',
        filename: '農業課程報名表.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT006_COURSE.pdf',
      },
      {
        templateId: 'FT_BT006_SUBSIDY',
        filename: '農業補助申請書.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT006_SUBSIDY.pdf',
      },
    ],
    createdBy: '陳經理',
    createdById: 'USER006',
    createdByDepartmentId: 'DEPT003',
    createdAt: '2026-03-11 09:30:00',
  },
  {
    id: 'S006',
    businessTypeId: 'BT001',
    businessTypeName: '放款業務',
    departmentId: 'DEPT001',
    templateIds: ['FT_BT001_PERSONAL'],
    generatedFiles: [
      {
        templateId: 'FT_BT001_PERSONAL',
        filename: '個人資料表.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT001_PERSONAL.pdf',
      },
    ],
    createdBy: '張三',
    createdById: 'USER003',
    createdByDepartmentId: 'DEPT001',
    createdAt: '2026-03-10 15:45:00',
  },
  {
    id: 'S007',
    businessTypeId: 'BT004',
    businessTypeName: '農產品銷售',
    departmentId: 'DEPT002',
    templateIds: ['FT_BT004_CONSIGN', 'FT_BT004_RECEIPT'],
    generatedFiles: [
      {
        templateId: 'FT_BT004_CONSIGN',
        filename: '農產品委託銷售申請書.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT004_CONSIGN.pdf',
      },
      {
        templateId: 'FT_BT004_RECEIPT',
        filename: '收購收據.pdf',
        downloadUrl: 'https://example.com/mock-file-seed-FT_BT004_RECEIPT.pdf',
      },
    ],
    createdBy: '李四',
    createdById: 'USER004',
    createdByDepartmentId: 'DEPT002',
    createdAt: '2026-03-09 14:00:00',
  },
];
