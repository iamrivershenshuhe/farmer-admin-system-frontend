/**
 * Knowledge API
 * 知識庫相關的 API 接口
 *
 * 此層為薄轉發：僅組裝請求、回傳業務型別；
 * 過濾 / 排序 / 分頁 / RBAC 可見範圍皆由後端（mock 為契約替身）處理。
 */

import type { ApiResponse } from '@/types/api';
import type {
  BatchDeleteDocumentsRequest,
  DeleteDocumentRequest,
  DocTypeOption,
  DocumentDetail,
  DocumentListResult,
  GetDocumentsRequest,
  KnowledgeDocument,
  UpdateDocumentRequest,
  UploadDocumentItem,
  UploadKnowledgeDocumentRequest,
  UploadNewVersionRequest,
} from '@/types/knowledge';
import { httpClient } from '@/utils/request';

/**
 * 獲取文件分頁列表
 */
export const getDocuments = async (
  params: GetDocumentsRequest
): Promise<ApiResponse<DocumentListResult>> => {
  return httpClient.get<DocumentListResult>('/knowledge/documents', {
    params,
  });
};

/**
 * 獲取文件詳情（含版本鏈）
 */
export const getDocument = async (documentId: string): Promise<ApiResponse<DocumentDetail>> => {
  return httpClient.get<DocumentDetail>(`/knowledge/documents/${documentId}`);
};

/**
 * 上傳多份文件（multipart/form-data，每份各自中繼資料）
 * FormData key 格式：items[N].field
 */
export const uploadDocument = async (
  request: UploadKnowledgeDocumentRequest
): Promise<ApiResponse<KnowledgeDocument[]>> => {
  const formData = new FormData();

  request.items.forEach((item: UploadDocumentItem, i: number) => {
    formData.append(`items[${i}].file`, item.file);
    formData.append(`items[${i}].docType`, item.docType);
    formData.append(`items[${i}].version`, item.version);
    if (item.versionNote) formData.append(`items[${i}].versionNote`, item.versionNote);
    if (item.departmentId !== null && item.departmentId !== undefined)
      formData.append(`items[${i}].departmentId`, item.departmentId);
    formData.append(`items[${i}].businessTypeIds`, JSON.stringify(item.businessTypeIds ?? []));
    if (item.description) formData.append(`items[${i}].description`, item.description);
  });

  return httpClient.post<KnowledgeDocument[]>('/knowledge/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * 上傳新版本（對既有 versionGroupId 追加新版）
 */
export const uploadNewVersion = async (
  request: UploadNewVersionRequest
): Promise<ApiResponse<KnowledgeDocument>> => {
  const formData = new FormData();
  formData.append('file', request.file);
  formData.append('targetDocumentId', request.targetDocumentId);
  formData.append('version', request.version);
  formData.append('versionNote', request.versionNote);

  return httpClient.post<KnowledgeDocument>('/knowledge/documents/upload-new-version', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * 更新文件中繼資料
 */
export const updateDocument = async (
  request: UpdateDocumentRequest
): Promise<ApiResponse<KnowledgeDocument>> => {
  const { documentId, ...data } = request;
  return httpClient.put<KnowledgeDocument>(`/knowledge/documents/${documentId}`, data);
};

/**
 * 軟刪除整條版本鏈（以傳入文件 id 的 versionGroupId 為準）
 */
export const deleteDocument = async (
  request: DeleteDocumentRequest
): Promise<ApiResponse<{ success: boolean }>> => {
  return httpClient.delete<{ success: boolean }>(`/knowledge/documents/${request.documentId}`);
};

/**
 * 軟刪除單一版本（詳情用；若為最新版則前版自動回升）
 */
export const deleteSingleVersion = async (
  documentId: string
): Promise<ApiResponse<{ success: boolean }>> => {
  return httpClient.delete<{ success: boolean }>(`/knowledge/documents/${documentId}/single`);
};

/**
 * 批次刪除（依每個 id 對應的版本鏈軟刪）
 */
export const batchDeleteDocuments = async (
  request: BatchDeleteDocumentsRequest
): Promise<ApiResponse<{ removed: number }>> => {
  return httpClient.post<{ removed: number }>('/knowledge/documents/batch-delete', request);
};

/**
 * 獲取文件類別選項（供篩選下拉）
 */
export const getDocumentTypes = async (): Promise<ApiResponse<DocTypeOption[]>> => {
  return httpClient.get<DocTypeOption[]>('/knowledge/categories');
};
