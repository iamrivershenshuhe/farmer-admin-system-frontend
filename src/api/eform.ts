/**
 * E-form API（電子表單）
 *
 * 對齊 v1.2 API 契約 (api-spec.md §3.6)：
 *  - 業務別清單改走組織端點 /departments 與 /business-types（既有）
 *  - 模板列表 / 生成 / 歷程（既有）
 *  - **v1.2 新增 admin 端點**：建立 / 欄位 bulk 更新 / 單欄座標微調 / 發布 / 預覽 / 軟刪除
 */

import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types/api';
import type {
  BulkUpdateFieldsPayload,
  CreateTemplateResponse,
  EFormTemplate,
  FormFieldCoord,
  FormSessionRecord,
  GeneratePdfResult,
  PublishTemplatePayload,
  PublishTemplateResponse,
  TemplatePreviewResponse,
  UpdateFieldCoordsPayload,
} from '@/types/eform';
import { httpClient } from '@/utils/request';

// ---------------------------------------------------------------------------
// 模板查詢
// ---------------------------------------------------------------------------

/**
 * 取得業務別下的所有表單模板
 */
export const getTemplates = async (businessTypeId: string): Promise<ApiResponse<EFormTemplate[]>> =>
  httpClient.get<EFormTemplate[]>('/eform/templates', { params: { businessTypeId } });

/**
 * 取得模板詳情（含 fields[]） (GET /eform/templates/{id})
 */
export const getTemplate = async (templateId: string): Promise<ApiResponse<EFormTemplate>> =>
  httpClient.get<EFormTemplate>(`/eform/templates/${templateId}`);

/**
 * 僅回 fields[]（不含模板 metadata） (GET /eform/templates/{id}/fields)
 */
export const getTemplateFields = async (
  templateId: string
): Promise<ApiResponse<FormFieldCoord[]>> =>
  httpClient.get<FormFieldCoord[]>(`/eform/templates/${templateId}/fields`);

// ---------------------------------------------------------------------------
// 模板管理（v1.2 新增 admin 端點）
// ---------------------------------------------------------------------------

/**
 * 建立模板 (POST /eform/templates) — **v1.2 新增**
 *
 * multipart/form-data；上傳 PDF + 觸發 OCR + 規則引擎初判欄位；建立 `draft` 模板。
 *
 * @param payload.file              PDF binary；≤ 20 MB
 * @param payload.name              模板顯示名（≤ 100）
 * @param payload.templateUid       選填；未提供則後端生成
 * @param payload.departmentId      選填；null = 全會通用
 * @param payload.eformBusinessTypeId 選填；對應 DB `eform_business_types.id`
 * @param payload.copyFromTemplateId 選填；若帶值，從該模板複製欄位定義
 */
export const createTemplate = async (payload: {
  file: File;
  name: string;
  templateUid?: string;
  departmentId?: string | null;
  eformBusinessTypeId?: string | null;
  copyFromTemplateId?: string;
}): Promise<ApiResponse<CreateTemplateResponse>> => {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('name', payload.name);
  if (payload.templateUid) formData.append('templateUid', payload.templateUid);
  if (payload.departmentId !== undefined && payload.departmentId !== null) {
    formData.append('departmentId', payload.departmentId);
  }
  if (payload.eformBusinessTypeId !== undefined && payload.eformBusinessTypeId !== null) {
    formData.append('eformBusinessTypeId', payload.eformBusinessTypeId);
  }
  if (payload.copyFromTemplateId) {
    formData.append('copyFromTemplateId', payload.copyFromTemplateId);
  }
  return httpClient.post<CreateTemplateResponse>('/eform/templates', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * Bulk 欄位更新 (PUT /eform/templates/{id}/fields) — **v1.2 新增**
 *
 * 整批整片覆寫；不在 request 內的欄位視為刪除。
 * 帶 `id` 者為更新；未帶 `id` 者為新增。
 * 所有 bbox 必通過 [eform-coordinate-system §9] 邊界驗證；違反回 `code: 20003`。
 * 變動欄位 `source` 自動轉 `admin_manual`。
 */
export const bulkUpdateTemplateFields = async (
  templateId: string,
  payload: BulkUpdateFieldsPayload
): Promise<ApiResponse<{ templateId: string; fields: FormFieldCoord[] }>> =>
  httpClient.put<{ templateId: string; fields: FormFieldCoord[] }>(
    `/eform/templates/${templateId}/fields`,
    payload
  );

/**
 * 單一欄位座標微調 (PUT /eform/templates/{id}/fields/{fieldId}/coords)
 *
 * UI 拖拉時呼叫，細粒度更新；更新後 `source` 自動轉 `admin_manual`。
 */
export const updateFieldCoords = async (
  templateId: string,
  fieldId: string,
  payload: UpdateFieldCoordsPayload
): Promise<ApiResponse<FormFieldCoord>> =>
  httpClient.put<FormFieldCoord>(
    `/eform/templates/${templateId}/fields/${fieldId}/coords`,
    payload
  );

/**
 * 發布模板 (POST /eform/templates/{id}/publish) — **v1.2 新增**
 *
 * Draft → published；同 `template_uid` 舊版自動 archived。
 * 至少 1 個 field；所有 bbox 通過邊界驗證。
 */
export const publishTemplate = async (
  templateId: string,
  payload?: PublishTemplatePayload
): Promise<ApiResponse<PublishTemplateResponse>> =>
  httpClient.post<PublishTemplateResponse>(`/eform/templates/${templateId}/publish`, payload ?? {});

/**
 * 模板預覽 (GET /eform/templates/{id}/preview) — **v1.2 新增**
 *
 * Dry-run fill_pdf 用佔位文字（如 `{applicant_name}`），回 HMAC token URL。
 * `previewUrl` 為 HMAC-signed token（TTL 30 分鐘），可直接 `<iframe>` 預覽。
 *
 * @param mode `placeholder`（預設） / `sample`
 */
export const previewTemplate = async (
  templateId: string,
  mode?: 'placeholder' | 'sample'
): Promise<ApiResponse<TemplatePreviewResponse>> =>
  httpClient.get<TemplatePreviewResponse>(`/eform/templates/${templateId}/preview`, {
    params: mode ? { mode } : undefined,
  });

/**
 * 刪除模板 (DELETE /eform/templates/{id}) — **v1.2 新增**
 *
 * 軟刪除：`draft` 直接刪；`published` / `archived` → `status='archived'`。
 */
export const deleteTemplate = async (templateId: string): Promise<ApiResponse<null>> =>
  httpClient.delete<null>(`/eform/templates/${templateId}`);

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
