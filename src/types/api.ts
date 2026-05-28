/**
 * API 相關型別定義
 */

// API 回應格式
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp?: number;
}

// 分頁參數
export interface PaginationParams {
  page: number;
  pageSize: number;
}

// 分頁回應
export interface PaginationResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 業務錯誤碼
 *
 * 格式：[模組前綴][序號]
 *
 * ┌─────────────────────────────────────────┐
 * │  0       → 成功                         │
 * │  1xxxx   → 認證 / 授權                  │
 * │  2xxxx   → 請求驗證 / 參數錯誤          │
 * │  3xxxx   → RAG / 向量知識庫             │
 * │  4xxxx   → 知識庫文件                   │
 * │  5xxxx   → 電子表單                     │
 * │  9xxxx   → 系統 / 未知                  │
 * └─────────────────────────────────────────┘
 *
 * @remarks
 * 此為前端定義版本，後端實作時需依此規格對齊回傳的 code 值。
 * 對應說明：
 *   40001：文件不存在
 *   40002：文件上傳失敗
 *   50001：PDF 生成失敗
 *   90001：伺服器內部錯誤，請聯繫管理員
 */
export enum ApiErrorCode {
  SUCCESS = 0,

  // ─── 1xxxx：認證 / 授權 ────────────────────────────
  /** 未登入或 Token 無效，需重新登入 */
  UNAUTHORIZED = 10001,
  /** 已登入但無此操作權限 */
  FORBIDDEN = 10002,
  /** Token 已過期 */
  TOKEN_EXPIRED = 10003,
  /** Token 刷新失敗 */
  TOKEN_REFRESH_FAILED = 10004,

  // ─── 2xxxx：請求驗證 / 參數 ──────────────────────────
  /** 請求格式錯誤 */
  BAD_REQUEST = 20001,
  /** 缺少必要參數 */
  MISSING_PARAMS = 20002,
  /** 參數格式或值不合法 */
  INVALID_PARAMS = 20003,
  /** 資源不存在（通用） */
  NOT_FOUND = 20004,

  // ─── 3xxxx：RAG / 向量知識庫 ─────────────────────────
  /** RAG 查詢失敗 */
  RAG_QUERY_FAILED = 30001,
  /** RAG 文件上傳失敗（含向量化失敗） */
  RAG_UPLOAD_FAILED = 30002,
  /** RAG 文件不存在 */
  RAG_DOCUMENT_NOT_FOUND = 30003,
  /** 30004 — RAG PII 阻擋（block-tier 個資觸發） */
  RAG_PII_BLOCKED = 30004,

  // ─── 4xxxx：知識庫文件 ────────────────────────────────
  /** 文件不存在 */
  KNOWLEDGE_NOT_FOUND = 40001,
  /** 文件上傳失敗 */
  KNOWLEDGE_UPLOAD_FAILED = 40002,
  /** 文件刪除失敗 */
  KNOWLEDGE_DELETE_FAILED = 40003,
  /** 文件處理中（非錯誤，為中間狀態） */
  KNOWLEDGE_PROCESSING = 40004,

  // ─── 5xxxx：電子表單 ──────────────────────────────────
  /** PDF 生成失敗 */
  FORM_GENERATION_FAILED = 50001,
  /** 表單模板不存在 */
  FORM_TEMPLATE_NOT_FOUND = 50002,
  /** 必填欄位缺漏或未填寫 */
  FORM_FIELD_MISSING = 50003,

  // ─── 9xxxx：系統 / 未知 ───────────────────────────────
  /** 伺服器內部錯誤，請聯繫管理員 */
  SERVER_ERROR = 90001,
  /** 未知錯誤 */
  UNKNOWN = 99999,
}

/**
 * 型別化 API 錯誤
 *
 * 由 httpClient 攔截器（業務碼 !== 0）拋出，取代裸 `Error`，
 * 讓上層可依 `code` / `httpStatus` 分流處理。
 *
 * 設計約束：
 *  - extends Error：既有 `error instanceof Error`、`error.message` 讀法完全相容
 *  - 提供 `isApiError` 靜態守衛，避免散落 instanceof 樣板
 *
 * @see docs/adr/0005-notification-error-contract.md
 */
export class ApiError extends Error {
  /** HTTP 狀態碼；無 response（網路錯誤/timeout）為 null */
  readonly httpStatus: number | null;
  /** 業務碼（{@link ApiErrorCode}）；非業務錯誤為 null */
  readonly code: number | null;
  /** 後端附帶的補充資料（如欄位錯誤映射） */
  readonly details?: unknown;
  /** 原始錯誤（如 AxiosError），保留供除錯 */
  readonly origin?: unknown;

  constructor(opts: {
    httpStatus: number | null;
    code: number | null;
    message: string;
    details?: unknown;
    origin?: unknown;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.httpStatus = opts.httpStatus;
    this.code = opts.code;
    this.details = opts.details;
    this.origin = opts.origin;
    // 確保 instanceof ApiError 在繼承 Error 後仍有效（TS target ES5 兼容）
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static isApiError(err: unknown): err is ApiError {
    return err instanceof ApiError;
  }
}
