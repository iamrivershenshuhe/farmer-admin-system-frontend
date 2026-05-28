/**
 * Business Type API（業務別管理）
 *
 * 對外端口清單；契約與資料形狀見 `src/types/business-type.ts` 與 `docs/CONTEXT.md` §4。
 */

import type { ApiResponse, BatchResult, PaginationParams, PaginationResponse } from '@/types/api';
import type {
  BusinessType,
  CreateBusinessTypePayload,
  UpdateBusinessTypePayload,
} from '@/types/business-type';
import { httpClient } from '@/utils/request';

// ---------------------------------------------------------------------------
// 查詢
// ---------------------------------------------------------------------------

/**
 * 跨部門業務別列表（支援分頁／篩選；業務別管理 tab 用）
 */
export const getBusinessTypes = async (
  params?: PaginationParams & { departmentId?: string; active?: boolean; keyword?: string }
): Promise<ApiResponse<PaginationResponse<BusinessType>>> =>
  httpClient.get<PaginationResponse<BusinessType>>('/business-types', { params });

/**
 * 取得單一部門的業務別（部門表下鑽／連動下拉用，不分頁）
 */
export const getBusinessTypesByDept = async (
  deptId: string
): Promise<ApiResponse<{ items: BusinessType[] }>> =>
  httpClient.get<{ items: BusinessType[] }>(`/departments/${deptId}/business-types`);

// ---------------------------------------------------------------------------
// 新增 / 更新 / 刪除
// ---------------------------------------------------------------------------

/** 建立業務別；departmentId 省略／空＝暫不歸屬部門 */
export const createBusinessType = async (
  data: CreateBusinessTypePayload
): Promise<ApiResponse<BusinessType>> => httpClient.post<BusinessType>('/business-types', data);

export const updateBusinessType = async (
  id: string,
  data: UpdateBusinessTypePayload
): Promise<ApiResponse<BusinessType>> =>
  httpClient.put<BusinessType>(`/business-types/${id}`, data);

/**
 * 刪除業務別（受守門：仍被人員指派或文件標記時後端擋下）
 */
export const deleteBusinessType = async (id: string): Promise<ApiResponse<void>> =>
  httpClient.delete<void>(`/business-types/${id}`);

// ---------------------------------------------------------------------------
// 停用 / 啟用（軟刪除，可逆）+ 批次
// ---------------------------------------------------------------------------

export const setBusinessTypeActive = async (
  id: string,
  active: boolean
): Promise<ApiResponse<BusinessType>> =>
  httpClient.patch<BusinessType>(`/business-types/${id}/active`, { active });

export const batchSetBusinessTypeActive = async (
  ids: string[],
  active: boolean
): Promise<ApiResponse<BatchResult>> =>
  httpClient.post<BatchResult>('/business-types/batch-active', { ids, active });

export const batchDeleteBusinessTypes = async (ids: string[]): Promise<ApiResponse<BatchResult>> =>
  httpClient.post<BatchResult>('/business-types/batch-delete', { ids });
