/**
 * 電子表單 E-form 相關型別定義
 * 採用 PDF 座標映射方案
 */

// --- 欄位座標定義（對應 DB: form_fields）---

export interface FormFieldCoord {
  id: string;
  templateId: string;
  fieldKey: string; // 語意鍵，如 applicant_name、applicant_phone
  label: string; // 顯示標籤，如「申請人姓名」
  page: number; // 位於 PDF 第幾頁（1-based）
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fontSize: number; // 填入文字大小（預設 10）
  required: boolean;
}

// --- 表單模板（對應 DB: form_templates）---
// businessTypeId 指向組織模型 BusinessType.id（如 BT001）
// 業務別→部門關聯由組織模型 BusinessType.departmentId 決定

export interface EFormTemplate {
  id: string;
  businessTypeId: string; // 指向 @/types/department BusinessType.id
  pdfFileName: string; // 原始 PDF 檔名（唯一對外顯示名稱）
  fields: FormFieldCoord[];
  active: boolean;
}

// --- 語意鍵 → 前端輸入欄位映射 ---

export interface ApplicantFieldDef {
  key: string;
  label: string;
  type: 'text' | 'date' | 'tel' | 'id';
  required: boolean; // 任一表單 required → 聯集亦 required
}

// 已知語意鍵（可擴充）
export type ApplicantFieldKey =
  | 'applicant_name'
  | 'applicant_phone'
  | 'applicant_id_number'
  | 'applicant_birth_date'
  | 'applicant_address'
  | 'applicant_email'
  | 'institution_name'
  | 'institution_tax_id'
  | string; // 允許擴充

// --- 單次使用流程狀態（前端流程暫存）---

export interface EFormSession {
  businessTypeId: string;
  selectedTemplateIds: string[];
  unionFields: ApplicantFieldDef[];
  applicantData: Record<string, string>;
}

// --- 單次生成的檔案（歷程手風琴展開顯示）---

export interface GeneratedFile {
  templateId: string;
  filename: string; // 後端定義，即模板原始檔名 pdfFileName
  downloadUrl: string; // 後端暫存檔 URL；預覽/下載直接使用，不重打生成 API
}

// --- 生成 API 回傳（檔名由後端定義，前端不再自行組合）---

export interface GeneratePdfResult {
  downloadUrl: string;
  expiresAt: string;
  files: GeneratedFile[];
}

// --- 歷程紀錄（對應 DB: form_sessions，不含個資）---

export interface FormSessionRecord {
  id: string;
  businessTypeId: string; // 指向組織模型 BusinessType.id（如 BT001）
  businessTypeName: string;
  departmentId: string; // 申請人所屬部門
  templateIds: string[];
  generatedFiles: GeneratedFile[]; // 本次生成的檔案清單（供歷程手風琴展開顯示）
  createdBy: string; // 顯示用名稱
  createdById: string; // 帳號 ID（非 PII，供 RBAC 過濾）
  createdByDepartmentId: string; // 申請人部門 ID（供 manager scope 過濾）
  createdAt: string;
}
