/**
 * 電子表單 E-form 相關型別定義
 * 採用 PDF 座標映射方案
 *
 * 對齊 v1.2 API 契約 (api-spec.md §3.6)、openapi.yaml#EFormTemplate / #FormFieldCoord、
 * eform-coordinate-system §2（座標系統 = 像素 @ 300 DPI）。
 */

// --- 座標 ---

/**
 * Bbox（bounding box）— 像素 @ 300 DPI（依 [eform-coordinate-system §2](../../spec-v1.2/standard/eform-coordinate-system.md)）。
 * x 軸 0..2480、y 軸 0..3508；超出邊界即 reject (`code: 20003`)。
 */
export interface Bbox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// --- 欄位型別 / 來源 ---

/**
 * 欄位語意型別（決定前端 input 與後端 validation pattern）。
 * 對齊 openapi.yaml#FieldType（v1.2 backend 接受 9 種）。
 */
export type FieldType =
  | 'text'
  | 'id' // TWID `^[A-Z][12]\d{8}$`
  | 'tel' // 兼容舊版同義 `phone`
  | 'phone'
  | 'email'
  | 'date'
  | 'number'
  | 'address' // 含 sublabels（縣 / 區 / 路 / 段 / 巷 / 弄 / 號 / 樓）
  | 'signature';

/**
 * 欄位來源（決定 admin 編輯器顯示「自動偵測」/「手動調整」標籤）。
 * 對齊 openapi.yaml#FieldSource（v1.2 簡化兩態，form-scan 的 `ocr_corrected` 視為兼容別名）。
 */
export type FieldSource =
  | 'ocr_rule' // OCR + rule_engine 自動偵測且 admin 未變動
  | 'ocr_corrected' // 兼容別名（form-scan 三態 → admin_manual）
  | 'admin_manual'; // admin 在編輯器手動調整（新增 / 移動 / 改 field_key / 改 label）

/**
 * 地址子欄位（field_type=address 才有）。
 * 對齊 openapi.yaml#FieldSublabel。
 */
export interface FieldSublabel {
  id?: string;
  sublabelKey: 'county' | 'district' | 'road' | 'section' | 'lane' | 'alley' | 'number' | 'floor';
  sublabelBbox: Bbox;
}

// --- 欄位座標定義（對應 DB: form_template_fields）---

/**
 * FormFieldCoord — 對齊 openapi.yaml#FormFieldCoord（v1.2 canonical）。
 *
 * 為兼容既有 UI（eform 生成頁仍用 `label` / `required` / 平展 `x1..y2`），保留 v1 別名；
 * 後端 v1.2 在 response 同時提供兩者。v1.3 全部前端遷移後可移除別名。
 */
export interface FormFieldCoord {
  id?: string;
  templateId?: string;
  /** 語意鍵 (v1.2 canonical)；50+ FIELD_LABELS 白名單。 */
  fieldKey: string;
  /**
   * 顯示標籤 (v1.2 canonical)；對應 DB `form_template_fields.display_label`。
   */
  displayLabel?: string;
  /**
   * @deprecated v1 別名 = `displayLabel`；v2.0 將移除。
   */
  label: string;
  /** 欄位語意型別（決定 input + validation） */
  fieldType?: FieldType;
  /**
   * Label 文字 bbox (v1.2 canonical)。OCR 偵測到 label 的位置，admin 可微調。
   * 對齊 [TSD-03 §2]；座標單位 = 像素 @ 300 DPI。
   */
  labelBbox?: Bbox;
  /**
   * Fill 文字 bbox (v1.2 canonical)。生成 PDF 時填入文字的位置。
   */
  fillBbox?: Bbox;
  /**
   * @deprecated v1 平展座標 = `fillBbox`。v2.0 將移除；目前 v1.2 後端兩者皆提供。
   */
  x1: number;
  /** @deprecated v1 平展座標；改用 {@link fillBbox} */
  y1: number;
  /** @deprecated v1 平展座標；改用 {@link fillBbox} */
  x2: number;
  /** @deprecated v1 平展座標；改用 {@link fillBbox} */
  y2: number;
  page: number; // 位於 PDF 第幾頁（1-based）
  fontFamily?: string;
  fontSize: number; // 填入文字大小（預設 10）
  /** 字體最大尺寸（fill 時 autoshrink 上限；預設 14） */
  maxFontSize?: number;
  /** 字色 hex（預設 #0000CC 藍色） */
  fontColor?: string;
  /** v1.2 canonical：是否必填 */
  isRequired?: boolean;
  /**
   * @deprecated v1 別名 = `isRequired`；v2.0 將移除。
   */
  required: boolean;
  /** Regex pattern（fieldType 預設 pattern 之外的額外限制） */
  validationPattern?: string | null;
  /** 最大字元數 */
  maxLength?: number | null;
  /** 顯示優先序（union-fields 排序用） */
  priorityOrder?: number;
  /** 欄位來源（自動偵測 / 手動調整） */
  source?: FieldSource;
  /** OCR 信心分數 0..1（source=ocr_rule 才有；admin_manual 為 null） */
  confidence?: number | null;
  /** Address 欄位的子欄位定義；fieldType=address 才有 */
  sublabels?: FieldSublabel[];
}

// --- 表單模板（對應 DB: form_templates）---

/**
 * 模板狀態 — 對齊 openapi.yaml#EFormTemplateStatus。
 *
 * - `draft`: 初稿（admin 編輯中）；非 admin 不可見。
 * - `published`: 已發布；user / manager 可選用生成 PDF。
 * - `archived`: 已歸檔（被新版取代或軟刪除）；不再列出。
 */
export type EFormTemplateStatus = 'draft' | 'published' | 'archived';

/**
 * EFormTemplate — 對齊 openapi.yaml#EFormTemplate（v1.2 canonical）。
 *
 * 注意：eForm 業務別與 Knowledge / Org 業務別是「兩個獨立實體」(api-spec §3.3)，
 * 不可跨用。canonical 欄位為 `eformBusinessTypeId`；保留 `businessTypeId` 為 v1 別名。
 */
export interface EFormTemplate {
  id: string;
  /** 邏輯模板識別（同 uid 不同 version 為 lineage 串接） */
  templateUid?: string;
  /** 模板版本號（每次 publish 自增） */
  version?: number;
  /** 模板狀態 (v1.2 canonical) */
  status?: EFormTemplateStatus;
  /** 模板顯示名 */
  name?: string;
  /** 所屬部門 ID；null = 全會通用 */
  departmentId?: string | null;
  /**
   * eForm 業務別 ID (v1.2 canonical)。
   * 對應 DB `eform_business_types.id`，**與** knowledge / org `business_types` 表分離。
   */
  eformBusinessTypeId?: string | null;
  /**
   * @deprecated v1 別名 = `eformBusinessTypeId`；v2.0 將移除。
   * v1.2 後端 response 同時提供兩者；v1.3 前端統一遷移至 canonical 後移除。
   */
  businessTypeId: string;
  pdfFileName: string; // 原始 PDF 檔名（唯一對外顯示名稱）
  /** MinIO 儲存路徑（後端內部用；前端不需要直接存取） */
  pdfFilePath?: string;
  fields: FormFieldCoord[];
  active: boolean;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// --- 欄位 bulk update / single coord update payload ---

/** PUT /eform/templates/{id}/fields body */
export interface BulkUpdateFieldsPayload {
  fields: FormFieldCoord[];
}

/** PUT /eform/templates/{id}/fields/{fieldId}/coords body（皆 optional） */
export interface UpdateFieldCoordsPayload {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  fontSize?: number;
  isRequired?: boolean;
  displayLabel?: string;
}

// --- 模板建立 / 發布 ---

/** POST /eform/templates 模板建立後的回傳 */
export interface CreateTemplateResponse {
  id: string;
  templateUid: string;
  version: number;
  status: EFormTemplateStatus;
  name: string;
  departmentId: string | null;
  fields: FormFieldCoord[];
}

/** POST /eform/templates/{id}/publish body */
export interface PublishTemplatePayload {
  /** 選填：發布備註 */
  comment?: string;
}

/** POST /eform/templates/{id}/publish 回傳 */
export interface PublishTemplateResponse {
  id: string;
  templateUid: string;
  version: number;
  status: 'published';
  publishedAt: string;
}

/** GET /eform/templates/{id}/preview 回傳 */
export interface TemplatePreviewResponse {
  /** HMAC-signed token URL（TTL 30 分鐘），可直接 `<iframe>` 預覽 */
  previewUrl: string;
  expiresAt: string;
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
