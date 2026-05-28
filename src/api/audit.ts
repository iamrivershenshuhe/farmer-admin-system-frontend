/**
 * Audit API（稽核事件查詢）
 *
 * 對齊 v1.2 API 契約 (api-spec.md §3.8)。
 * v1.2 新增 endpoint；前端 `/logs` 路由（v1.3 實作）將消費此 API。
 *
 * RBAC：admin only（其他角色 `10002 FORBIDDEN`）。
 */

import type { ApiResponse, PaginationResponse } from '@/types/api';
import type { AuditEvent, AuditEventsQuery } from '@/types/audit';
import { httpClient } from '@/utils/request';

/**
 * 稽核事件查詢 (GET /audit/events)
 *
 * - `event` 可多個逗號分隔（後端解析為 IN 清單）
 * - `from` / `to` 為 ISO 8601 時間範圍（兩者皆可選）
 * - 業務規則：
 *   - `detail` 已 sanitize（白名單欄位序列化）
 *   - 黑名單欄位（`password` / `applicant_*` / `refresh_token` 等）絕不出現
 *   - 保留 5 年（NFR-COMP-02）
 *
 * @example
 * ```ts
 * const res = await auditApi.getAuditEvents({
 *   event: 'staff.role_changed',
 *   from: '2026-05-01T00:00:00Z',
 *   page: 1,
 *   pageSize: 50,
 * });
 * ```
 */
export const getAuditEvents = async (
  params?: AuditEventsQuery
): Promise<ApiResponse<PaginationResponse<AuditEvent>>> =>
  httpClient.get<PaginationResponse<AuditEvent>>('/audit/events', { params });
