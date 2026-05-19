import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  batchDeleteDocuments,
  deleteDocument as apiDeleteDocument,
  deleteSingleVersion as apiDeleteSingleVersion,
  getDocument as apiGetDocument,
  getDocuments,
  getDocumentTypes,
  updateDocument as apiUpdateDocument,
  uploadDocument as apiUploadDocument,
  uploadNewVersion as apiUploadNewVersion,
} from '@/api/knowledge';
import type {
  DocTypeOption,
  DocumentFacets,
  GetDocumentsRequest,
  KnowledgeDocument,
  UpdateDocumentRequest,
  UploadKnowledgeDocumentRequest,
  UploadNewVersionRequest,
} from '@/types/knowledge';
import { DocumentStatus } from '@/types/knowledge';

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

/**
 * 知識庫狀態管理 — 薄層。
 *
 * 不在前端做過濾 / 分頁 / RBAC；僅持有目前查詢條件並轉發給 API 層，
 * 顯示後端（mock 為契約替身）回傳的已分頁結果。
 */
export const useKnowledgeStore = defineStore('knowledge', () => {
  // State
  const documents = ref<KnowledgeDocument[]>([]);
  const total = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const totalPages = ref(1);
  const isLoading = ref(false);
  const filters = ref<Filters>({ ...DEFAULT_FILTERS });
  const docTypeOptions = ref<DocTypeOption[]>([]);
  /** 後端依當次身分回傳的可見範圍 facets（篩選器選項唯一來源）*/
  const facets = ref<DocumentFacets>({ docTypes: [], statuses: [], businessTypeIds: [] });

  /** 目前開啟的文件詳情 */
  const currentDocument = ref<KnowledgeDocument | null>(null);
  /** 目前文件的完整版本鏈（依 uploadedAt 升序，最舊→最新） */
  const currentVersions = ref<KnowledgeDocument[]>([]);

  // Getters
  const startIndex = computed(() =>
    total.value === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1
  );
  const endIndex = computed(() => Math.min(currentPage.value * pageSize.value, total.value));
  // 非終態（uploading / processing）即代表向量化未完成，需持續輪詢
  const hasProcessing = computed(() =>
    documents.value.some(
      (d) => d.status !== DocumentStatus.READY && d.status !== DocumentStatus.ERROR
    )
  );

  // Actions
  async function fetchDocuments(): Promise<void> {
    isLoading.value = true;
    try {
      const res = await getDocuments({
        page: currentPage.value,
        pageSize: pageSize.value,
        ...filters.value,
      });
      const data = res.data;
      documents.value = data.items;
      total.value = data.total;
      currentPage.value = data.page;
      pageSize.value = data.pageSize;
      totalPages.value = data.totalPages;
      facets.value = data.facets;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchDocumentTypes(): Promise<void> {
    const res = await getDocumentTypes();
    docTypeOptions.value = res.data;
  }

  /** 載入文件詳情與版本鏈 */
  async function fetchDocument(documentId: string): Promise<void> {
    const res = await apiGetDocument(documentId);
    currentDocument.value = res.data.document;
    currentVersions.value = res.data.versions;
  }

  function setPage(page: number): Promise<void> {
    currentPage.value = page;
    return fetchDocuments();
  }

  function setPageSize(size: number): Promise<void> {
    pageSize.value = size;
    currentPage.value = 1;
    return fetchDocuments();
  }

  function setFilters(patch: Partial<Filters>): Promise<void> {
    filters.value = { ...filters.value, ...patch };
    currentPage.value = 1;
    return fetchDocuments();
  }

  function setSort(sortBy: Filters['sortBy']): Promise<void> {
    const order =
      filters.value.sortBy === sortBy && filters.value.sortOrder === 'desc' ? 'asc' : 'desc';
    return setFilters({ sortBy, sortOrder: order });
  }

  function resetFilters(): Promise<void> {
    filters.value = { ...DEFAULT_FILTERS };
    currentPage.value = 1;
    return fetchDocuments();
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
      await fetchDocument(currentDocument.value.id).catch(() => {
        currentDocument.value = null;
        currentVersions.value = [];
      });
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
    docTypeOptions,
    facets,
    currentDocument,
    currentVersions,
    // Getters
    startIndex,
    endIndex,
    hasProcessing,
    // Actions
    fetchDocuments,
    fetchDocumentTypes,
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
