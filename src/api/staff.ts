/**
 * Staff API（人員管理）
 *
 * 對外端口清單；契約與資料形狀見 `src/types/staff.ts` 與 `docs/CONTEXT.md` §4。
 */

import type { ApiResponse, BatchResult, PaginationParams, PaginationResponse } from '@/types/api';
import type { UserInfo, UserRole } from '@/types/user';
import { httpClient } from '@/utils/request';

// ---------------------------------------------------------------------------
// 查詢
// ---------------------------------------------------------------------------

/**
 * 取得人員列表（支援分頁與篩選）
 */
export const getStaff = async (
  params?: PaginationParams & {
    departmentId?: string;
    role?: UserRole;
    active?: boolean;
    keyword?: string;
  }
): Promise<ApiResponse<PaginationResponse<UserInfo>>> =>
  httpClient.get<PaginationResponse<UserInfo>>('/staff', { params });

/**
 * 取得所有可作為部門主管的人員（供下拉選單使用）
 */
export const getManagers = async (): Promise<ApiResponse<UserInfo[]>> =>
  httpClient.get<UserInfo[]>('/staff/managers');

// ---------------------------------------------------------------------------
// 新增 / 更新 / 刪除
// ---------------------------------------------------------------------------

/**
 * 新增人員
 */
export const createStaff = async (data: {
  username: string;
  name?: string;
  role: UserRole;
  departmentId?: string | null;
  businessTypeIds?: string[];
  password: string;
  mustChangePassword?: boolean;
}): Promise<ApiResponse<UserInfo>> => httpClient.post<UserInfo>('/staff', data);

/**
 * 更新人員基本資料（姓名 / 部門）。
 *
 * 注意：後端 `PUT /staff/{id}` 不處理 `businessTypeIds`；業務別異動請改用
 * {@link assignBusinessTypes}（`POST /staff/{id}/business-types`）。
 */
export const updateStaff = async (
  id: string,
  data: Partial<Pick<UserInfo, 'name' | 'departmentId'>>
): Promise<ApiResponse<UserInfo>> => httpClient.put<UserInfo>(`/staff/${id}`, data);

/**
 * 指派人員業務別（全量覆寫）。
 *
 * 後端 `PUT /staff/{id}` 不處理 `businessTypeIds`；業務別異動須走專屬端點
 * `POST /staff/{id}/business-types`（body `{businessTypeIds}`，跨部門禁止）。
 */
export const assignBusinessTypes = async (
  id: string,
  businessTypeIds: string[]
): Promise<ApiResponse<UserInfo>> =>
  httpClient.post<UserInfo>(`/staff/${id}/business-types`, { businessTypeIds });

/**
 * 更新人員權限（角色）
 */
export const updateStaffRole = async (id: string, role: UserRole): Promise<ApiResponse<UserInfo>> =>
  httpClient.patch<UserInfo>(`/staff/${id}/role`, { role });

/**
 * 重置密碼
 */
export const resetPassword = async (
  id: string,
  payload: { newPassword: string; mustChangePassword: boolean }
): Promise<ApiResponse<void>> => httpClient.post<void>(`/staff/${id}/reset-password`, payload);

/**
 * 刪除人員
 */
export const deleteStaff = async (id: string): Promise<ApiResponse<void>> =>
  httpClient.delete<void>(`/staff/${id}`);

// ---------------------------------------------------------------------------
// 停用 / 啟用（軟刪除，可逆）+ 批次
// ---------------------------------------------------------------------------

export const setStaffActive = async (id: string, active: boolean): Promise<ApiResponse<UserInfo>> =>
  httpClient.patch<UserInfo>(`/staff/${id}/active`, { active });

export const batchSetStaffActive = async (
  ids: string[],
  active: boolean
): Promise<ApiResponse<BatchResult>> =>
  httpClient.post<BatchResult>('/staff/batch-active', { ids, active });

export const batchDeleteStaff = async (ids: string[]): Promise<ApiResponse<BatchResult>> =>
  httpClient.post<BatchResult>('/staff/batch-delete', { ids });
