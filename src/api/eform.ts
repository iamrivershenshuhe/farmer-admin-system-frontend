/**
 * E-form API（電子表單）
 * 採用 PDF 座標映射方案
 */

import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types/api';
import type { EFormTemplate, FormSessionRecord, GeneratePdfResult } from '@/types/eform';
import { httpClient } from '@/utils/request';

// ---------------------------------------------------------------------------
// 模板（業務別清單改走組織端點 /departments 與 /business-types）
// ---------------------------------------------------------------------------

/**
 * 取得業務別下的所有表單模板
 */
export const getTemplates = async (businessTypeId: string): Promise<ApiResponse<EFormTemplate[]>> =>
  httpClient.get<EFormTemplate[]>('/eform/templates', { params: { businessTypeId } });

// ---------------------------------------------------------------------------
// 生成 & 下載
// ---------------------------------------------------------------------------

/**
 * 批次生成 PDF（多張表單一次生成），同時寫入 session，
 * 回傳打包 ZIP URL 與每檔暫存 downloadUrl
 */
export const generateBatch = async (payload: {
  templateIds: string[];
  businessTypeId: string;
  businessTypeName: string;
  applicantData: Record<string, string>;
}): Promise<ApiResponse<GeneratePdfResult>> => httpClient.post('/eform/generate/batch', payload);

// ---------------------------------------------------------------------------
// 生成歷程
// ---------------------------------------------------------------------------

export interface GetSessionsParams extends PaginationParams {
  businessTypeId?: string;
  /** admin 可依部門篩選 */
  departmentId?: string;
  /** manager/admin 可依帳號篩選 */
  createdById?: string;
}

/**
 * 取得歷程列表（後端依呼叫者角色套用 RBAC scope，支援分頁與篩選）
 * 前端以無限滾動懶加載方式呼叫（page 遞增，append 結果）
 */
export const getSessions = async (
  params: GetSessionsParams
): Promise<ApiResponse<PaginationResponse<FormSessionRecord>>> =>
  httpClient.get<PaginationResponse<FormSessionRecord>>('/eform/sessions', { params });

/**
 * 取得單一歷程詳情
 */
export const getSession = async (sessionId: string): Promise<ApiResponse<FormSessionRecord>> =>
  httpClient.get<FormSessionRecord>(`/eform/sessions/${sessionId}`);
