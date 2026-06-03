import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  batchDeleteDocuments,
  deleteDocument as apiDeleteDocument,
  deleteSingleVersion as apiDeleteSingleVersion,
  getDocument as apiGetDocument,
  getDocuments,
  updateDocument as apiUpdateDocument,
  uploadDocument as apiUploadDocument,
  uploadNewVersion as apiUploadNewVersion,
} from '@/api/knowledge';
import { useListController } from '@/composables/useListController';
import { ApiError } from '@/types/api';
import type {
  DocType,
  DocTypeOption,
  DocumentFacets,
  GetDocumentsRequest,
  KnowledgeDocument,
  UpdateDocumentRequest,
  UploadKnowledgeDocumentRequest,
  UploadNewVersionRequest,
} from '@/types/knowledge';
import { DOC_TYPE_LABELS, DocumentStatus } from '@/types/knowledge';

type Filters = Pick<
  GetDocumentsRequest,
  'keyword' | 'docType' | 'departmentId' | 'businessTypeId' | 'status' | 'sortBy' | 'sortOrder'
>;

const DEFAULT_FILTERS: Filters = {
  keyword: undefined,
  docType: undefined,
  departmentId: undefined,
  businessTypeId: undefined,
  status: undefined,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

// 文件類別是固定 enum（doc-type-business-rules）；上傳選單需「全部可選類別」，
// 與後端 /categories（僅回有文件的類別 + count）不同，故由 DOC_TYPE_LABELS 靜態建構。
const DOC_TYPE_OPTIONS: DocTypeOption[] = (Object.keys(DOC_TYPE_LABELS) as DocType[]).map((value) => ({
  value,
  label: DOC_TYPE_LABELS[value],
}));

/**
 * 知識庫狀態管理 — 薄層。
 *
 * 不在前端做過濾 / 分頁 / RBAC；僅持有目前查詢條件並轉發給 API 層，
 * 顯示後端（mock 為契約替身）回傳的已分頁結果。
 *
 * 內部分頁/排序/篩選由 {@link useListController} 接管（見 ADR-0003）；
 * 對外名稱與行為完全沿用既有契約（見 baseline/knowledge/contract.json）。
 */
export const useKnowledgeStore = defineStore('knowledge', () => {
  // ── 知識庫專屬狀態（list-controller 不涵蓋）─────────────────────
  const docTypeOptions = ref<DocTypeOption[]>(DOC_TYPE_OPTIONS);
  /** 後端依當次身分回傳的可見範圍 facets（篩選器選項唯一來源）*/
  const facets = ref<DocumentFacets>({ docTypes: [], statuses: [], businessTypeIds: [] });
  /** 目前開啟的文件詳情 */
  const currentDocument = ref<KnowledgeDocument | null>(null);
  /** 目前文件的完整版本鏈（依 uploadedAt 升序，最舊→最新） */
  const currentVersions = ref<KnowledgeDocument[]>([]);

  // ── List controller：吸收分頁/排序/篩選樣板（ADR-0003）─────────
  // sortBy / sortOrder 屬 Filters 一部分（與 API request 對齊），不使用 controller 的獨立 sort state。
  const ctrl = useListController<KnowledgeDocument, Filters>({
    fetcher: async ({ page, pageSize, filters }) => {
      const res = await getDocuments({ page, pageSize, ...filters });
      const data = res.data;
      // 同次回應的 facets 在 fetcher 內以 side-effect 寫入，維持與舊行為等價的單次原子更新
      facets.value = data.facets;
      // DocumentListResult 結構性子型於 PaginationResponse<KnowledgeDocument>
      return data;
    },
    initialFilters: { ...DEFAULT_FILTERS },
    defaultPageSize: 20,
  });

  // ── 對外名稱對齊既有 view callsites（見 baseline contract）─────
  const documents = ctrl.items;
  const total = ctrl.total;
  const currentPage = ctrl.currentPage;
  const pageSize = ctrl.pageSize;
  const totalPages = ctrl.totalPages;
  const isLoading = ctrl.isLoading;
  const filters = ctrl.filters;
  const startIndex = ctrl.startIndex;
  const endIndex = ctrl.endIndex;

  // 非終態（uploading / processing）即代表向量化未完成，需持續輪詢
  const hasProcessing = computed(() =>
    documents.value.some(
      (d) => d.status !== DocumentStatus.READY && d.status !== DocumentStatus.ERROR
    )
  );

  // ── Actions ─────────────────────────────────────────────────────
  function fetchDocuments(): Promise<void> {
    return ctrl.fetchPage();
  }

  /** 載入文件詳情與版本鏈 */
  async function fetchDocument(documentId: string): Promise<void> {
    const res = await apiGetDocument(documentId);
    currentDocument.value = res.data.document;
    currentVersions.value = res.data.versions;
  }

  function setPage(page: number): Promise<void> {
    return ctrl.setPage(page);
  }

  function setPageSize(size: number): Promise<void> {
    return ctrl.setPageSize(size);
  }

  function setFilters(patch: Partial<Filters>): Promise<void> {
    return ctrl.setFilters(patch);
  }

  function setSort(sortBy: Filters['sortBy']): Promise<void> {
    // 行為保留：同欄位且當前 desc → asc；其餘情境（不同欄位 或 同欄位 asc）→ desc
    const order =
      filters.value.sortBy === sortBy && filters.value.sortOrder === 'desc' ? 'asc' : 'desc';
    return setFilters({ sortBy, sortOrder: order });
  }

  function resetFilters(): Promise<void> {
    return ctrl.resetFilters();
  }

  /** 多檔上傳（每檔各自中繼資料，各自開新版本鏈） */
  async function uploadDocument(
    payload: UploadKnowledgeDocumentRequest
  ): Promise<KnowledgeDocument[]> {
    const res = await apiUploadDocument(payload);
    await fetchDocuments();
    return res.data;
  }

  /** 追加新版本（繼承目標文件的 versionGroupId / docType / 部門 / 業別） */
  async function uploadNewVersion(req: UploadNewVersionRequest): Promise<KnowledgeDocument> {
    const res = await apiUploadNewVersion(req);
    await fetchDocuments();
    return res.data;
  }

  async function updateDocument(req: UpdateDocumentRequest): Promise<void> {
    await apiUpdateDocument(req);
    await fetchDocuments();
  }

  /** 軟刪除整條版本鏈 */
  async function deleteDocument(documentId: string): Promise<void> {
    await apiDeleteDocument({ documentId });
    await fetchDocuments();
  }

  /** 軟刪除單一版本（詳情頁用） */
  async function deleteSingleVersion(documentId: string): Promise<void> {
    await apiDeleteSingleVersion(documentId);
    // 若刪除的是 currentDocument，重新載入版本鏈
    if (currentDocument.value) {
      try {
        await fetchDocument(currentDocument.value.id);
      } catch (err) {
        // 文件已不存在（刪掉最後一版）→ 清空本地狀態，屬預期分支
        if (ApiError.isApiError(err) && err.httpStatus === 404) {
          currentDocument.value = null;
          currentVersions.value = [];
          return;
        }
        throw err;
      }
    }
  }

  async function batchDelete(documentIds: string[]): Promise<number> {
    const res = await batchDeleteDocuments({ documentIds });
    await fetchDocuments();
    return res.data.removed;
  }

  return {
    // State
    documents,
    total,
    currentPage,
    pageSize,
    totalPages,
    isLoading,
    filters,
    facets,
    currentDocument,
    currentVersions,
    docTypeOptions,
    // Getters
    startIndex,
    endIndex,
    hasProcessing,
    // Actions
    fetchDocuments,
    fetchDocument,
    setPage,
    setPageSize,
    setFilters,
    setSort,
    resetFilters,
    uploadDocument,
    uploadNewVersion,
    updateDocument,
    deleteDocument,
    deleteSingleVersion,
    batchDelete,
  };
});
