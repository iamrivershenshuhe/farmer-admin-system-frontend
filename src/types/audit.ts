/**
 * 稽核 (Audit) 相關型別定義
 *
 * 對齊 v1.2 API 契約 (api-spec.md §3.8) + openapi.yaml#AuditEvent。
 * 完整事件清單見 [TSD-05 §8.1]。
 */

/**
 * Audit resource type — 與後端 `audit_events.resource_type` 對齊。
 *
 * 對應 openapi.yaml#AuditEvent.resourceType 的 enum。
 */
export type AuditResourceType =
  | 'staff'
  | 'department'
  | 'business_type'
  | 'document'
  | 'conversation'
  | 'eform_template'
  | 'token'
  | 'system';

/**
 * Audit event row — 對齊 openapi.yaml#AuditEvent。
 *
 * `detail` 已 sanitize：黑名單欄位（password / applicant_* / refresh_token 等）絕不出現。
 * 字串中的高敏感 PII（tw_id / credit_card）已 redact。
 */
export interface AuditEvent {
  id: string;
  /** 操作者 user_id（系統觸發為 null） */
  userId: string | null;
  /** 操作者 employee_id（顯示用 quick lookup） */
  userEmployeeId?: string | null;
  /** snake_case 事件名稱（詳見 TSD-05 §8.1），例：`staff.role_changed` / `rag.query` / `document.upload` */
  event: string;
  resourceType?: AuditResourceType | null;
  resourceId?: string | null;
  /** sanitize 後的細節 payload；黑名單欄位絕不出現 */
  detail?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

/**
 * Query params for GET /audit/events
 */
export interface AuditEventsQuery {
  page?: number;
  pageSize?: number;
  /** 操作者過濾 */
  userId?: string;
  /** 事件名稱；可多個逗號分隔 */
  event?: string;
  resourceType?: AuditResourceType;
  resourceId?: string;
  /** ISO 8601 起始時間 */
  from?: string;
  /** ISO 8601 結束時間 */
  to?: string;
  /** 來源 IP */
  ip?: string;
  /** 預設 `createdAt` */
  sortBy?: string;
  /** 預設 `desc` */
  sortOrder?: 'asc' | 'desc';
}
