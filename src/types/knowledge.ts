/**
 * 知識庫相關型別定義
 *
 * 模型對齊 FAS-TSD-01 v1.1.0 規格內文（5 種文件類別 + 部門/業務雙層可見範圍）。
 * 識別子全面 id-based，沿用 organization 模組既有 string id 慣例。
 *
 * 邊界備註：知識庫的 `application_form` 指「經 RAG 向量化的申請表範本/說明文件」，
 * 與電子表單模組的 OCR 座標標記表單模板（供動態生成填寫用）生命週期不同，兩者不互混。
 */

import type { PaginationResponse } from './api';

// 文件類別（5 種，決定存取可見範圍）
export type DocType =
  | 'public_regulation' // 公開法規 — 全員可見
  | 'official_document' // 電子公文 — 同部門全員可見
  | 'internal_regulation' // 內部規章 — 同部門全員可見
  | 'operation_manual' // 作業手冊 — 同部門且負責對應業務別
  | 'application_form'; // 申請表單 — 同部門且負責對應業務別

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  public_regulation: '公開法規',
  official_document: '電子公文',
  internal_regulation: '內部規章',
  operation_manual: '作業手冊',
  application_form: '申請表單',
};

// 文件狀態（規格 FR-KB-12 明列四態）
export enum DocumentStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error',
}

/** 文件狀態顯示文字（四態各自獨立，無折疊）*/
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  [DocumentStatus.UPLOADING]: '上傳中',
  [DocumentStatus.PROCESSING]: '處理中',
  [DocumentStatus.READY]: '已就緒',
  [DocumentStatus.ERROR]: '錯誤',
};

// 知識庫文件
export interface KnowledgeDocument {
  id: string;
  filename: string; // 顯示名（原始檔名，取代舊 title）
  fileSize: number; // 位元組
  mimeType: string;
  fileUrl: string; // 後端持久化源文件 URL（供預覽開新分頁）
  docType: DocType;
  departmentId: string | null; // null = 全域可見（public_regulation）
  businessTypeIds: string[]; // 空陣列 = 部門全域（official/internal）
  version: string; // 文件版本號（如 2024-v3）
  versionNote: string; // 版本差異說明
  versionGroupId: string; // 同一邏輯文件所有版本共用的群組識別子
  supersededBy: string | null; // 指向新版文件 ID；非 null 代表已有新版本
  /** 最新版 = supersededBy === null；isLatest 為後端便利計算欄位，前端不可寫入 */
  readonly isLatest?: boolean;
  /** 列表用，後端回傳該 versionGroupId 群組的版本總數 */
  versionCount?: number;
  description?: string;
  uploadedBy: string; // 上傳者姓名
  uploadedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  status: DocumentStatus;
  chunkCount: number; // RAG 切片數量
}

// 文件類別選項（供篩選下拉；取代舊 DocumentCategory）
export interface DocTypeOption {
  value: DocType;
  label: string;
}

// 獲取文件列表請求（送往後端契約；過濾/排序/分頁皆由後端處理）
export interface GetDocumentsRequest {
  page: number;
  pageSize: number;
  keyword?: string; // 只比對 filename
  docType?: DocType;
  departmentId?: string;
  businessTypeId?: string;
  status?: DocumentStatus;
  sortBy?: 'updatedAt' | 'uploadedAt' | 'filename';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 篩選 facets：使用者 RBAC 可見範圍內「實際存在」的可選值。
 *
 * 由後端（mock 為契約替身）依當次請求身分計算，前端篩選器只渲染這些值，
 * 不再用靜態全量 / 全部門業務別，避免提供範圍外或無資料的選項。
 * 採固定基準：以可見文件全集計算，不隨其他已選篩選連動。
 */
export interface DocumentFacets {
  docTypes: DocType[];
  statuses: DocumentStatus[];
  businessTypeIds: string[];
}

// 文件列表回應：分頁結果 + 可見範圍 facets
export interface DocumentListResult extends PaginationResponse<KnowledgeDocument> {
  facets: DocumentFacets;
}

// 多檔上傳時每個檔案各自的中繼資料
export interface UploadDocumentItem {
  file: File;
  docType: DocType;
  version: string;
  versionNote?: string;
  departmentId: string | null;
  businessTypeIds: string[];
  description?: string;
}

// 上傳文件請求（支援多檔，每檔各自中繼資料）
export interface UploadKnowledgeDocumentRequest {
  items: UploadDocumentItem[];
}

// 上傳新版本請求（對既有 versionGroupId 追加新版）
export interface UploadNewVersionRequest {
  targetDocumentId: string;
  file: File;
  version: string;
  versionNote: string;
}

// 更新文件中繼資料請求
//
// 對齊後端 `PUT /knowledge/documents/{id}`：僅中繼資料可變。
// docType / version / departmentId / businessTypeIds 一經建檔即不可改（須走新版本上傳），
// 後端會靜默忽略，故前端不再送出。`documentId` 僅作為 path 參數，送出前由 api 層剝除。
export interface UpdateDocumentRequest {
  documentId: string;
  description?: string;
  versionNote?: string;
}

/**
 * 刪除單一文件請求。
 * 語意為軟刪除（停用），後端應停用整條版本鏈。
 */
export interface DeleteDocumentRequest {
  documentId: string;
}

/**
 * 批次刪除文件請求。
 * 語意為軟刪除（停用），後端應停用整條版本鏈。
 */
export interface BatchDeleteDocumentsRequest {
  documentIds: string[];
}

/**
 * 文件詳情回傳結構（GET /knowledge/documents/:id）。
 * versions 為同 versionGroupId 未軟刪版本，依 uploadedAt 升序排列（最舊→最新）。
 */
export interface DocumentDetail {
  document: KnowledgeDocument;
  versions: KnowledgeDocument[];
}
