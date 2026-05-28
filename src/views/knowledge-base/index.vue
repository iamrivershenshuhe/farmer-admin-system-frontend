<template>
  <div class="knowledge-page">
    <ViewToolbar
      subtitle="管理 AI 知識庫文件，文件上傳後將自動解析並建立可檢索的向量索引"
      :search="{ modelValue: keyword, placeholder: '搜尋檔名...' }"
      @update:search="onSearch"
    >
      <template #actions>
        <IconBtn
          v-if="canUpload"
          icon="UPLOAD"
          label="上傳文件"
          variant="primary"
          @click="showUploadModal = true"
        />
      </template>
      <template #filters>
        <FilterSelect
          :model-value="filters.docType ?? ''"
          :options="docTypeFilterOptions"
          placeholder="全部類別"
          @update:model-value="setFilter('docType', $event)"
        />
        <FilterSelect
          v-if="canCrossDepartment"
          :model-value="filters.departmentId ?? ''"
          :options="departmentFilterOptions"
          placeholder="全部部門"
          @update:model-value="setFilter('departmentId', $event)"
        />
        <FilterSelect
          :model-value="filters.businessTypeId ?? ''"
          :options="businessTypeFilterOptions"
          placeholder="全部業務別"
          @update:model-value="setFilter('businessTypeId', $event)"
        />
        <FilterSelect
          :model-value="filters.status ?? ''"
          :options="statusOptions"
          placeholder="全部狀態"
          @update:model-value="setFilter('status', $event)"
        />
        <IconBtn
          v-if="hasActiveFilter"
          icon="CLOSE"
          label="清除篩選"
          variant="ghost"
          @click="clearFilters"
        />
      </template>
    </ViewToolbar>

    <BatchActionToolbar
      v-if="canDelete && selectedIds.length > 0"
      :count="selectedIds.length"
      @confirm-delete="showBatchDeleteModal = true"
      @cancel="clearSelection"
    />

    <DocumentTable
      :documents="knowledgeStore.documents"
      :selected-ids="canDelete ? selectedIds : undefined"
      :permissions="{ canEdit, canDelete }"
      :sort-by="filters.sortBy"
      :sort-order="filters.sortOrder"
      :dept-name-map="deptNameMap"
      :bt-name-map="btNameMap"
      @toggle-row="toggleRow"
      @toggle-all="toggleAll"
      @sort="knowledgeStore.setSort($event as SortKey)"
      @detail="handleDetail"
      @preview="handlePreview"
      @edit="handleEdit"
      @delete="handleDelete"
      @upload-version="handleUploadVersion"
    />

    <Pagination
      :current-page="knowledgeStore.currentPage"
      :total-pages="knowledgeStore.totalPages"
      :total="knowledgeStore.total"
      :start-index="knowledgeStore.startIndex"
      :end-index="knowledgeStore.endIndex"
      :page-size="knowledgeStore.pageSize"
      :page-size-options="[10, 20, 50]"
      @page-change="onPageChange"
      @page-size-change="onPageSizeChange"
    />

    <UploadDocumentModal
      v-model="showUploadModal"
      :doc-type-options="knowledgeStore.docTypeOptions"
      :department-options="departmentFilterOptions"
      :business-type-options="businessTypeChoices"
      @submit="handleUpload"
    />

    <UploadVersionModal
      v-model="showVersionModal"
      :document="selectedDocument"
      :dept-name-map="deptNameMap"
      :bt-name-map="btNameMap"
      @submit="handleUploadNewVersion"
    />

    <DocumentDetailModal
      v-model="showDetailModal"
      :document="selectedDocument"
      :editable="canEdit"
      :doc-type-options="knowledgeStore.docTypeOptions"
      :department-options="departmentFilterOptions"
      :business-type-options="businessTypeChoices"
      :dept-name-map="deptNameMap"
      :bt-name-map="btNameMap"
      @save="handleSave"
    />

    <BaseModal
      v-model="showDeleteModal"
      title="確認刪除"
      size="sm"
      confirm-text="確認刪除"
      confirm-variant="danger"
      @confirm="handleConfirmDelete"
    >
      <p class="delete-confirm-text">
        確定要刪除「{{ selectedDocument?.filename }}」？此動作將一併移除向量索引且無法復原。
      </p>
    </BaseModal>

    <BaseModal
      v-model="showBatchDeleteModal"
      title="批次刪除確認"
      size="sm"
      confirm-text="確認刪除"
      confirm-variant="danger"
      @confirm="handleConfirmBatchDelete"
    >
      <p class="delete-confirm-text">
        確定要刪除選取的 {{ selectedIds.length }} 份文件？所有向量索引將一併移除且無法復原。
      </p>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import BaseModal from '@/components/base/BaseModal.vue';
import IconBtn from '@/components/base/IconBtn.vue';
import BatchActionToolbar from '@/components/common/BatchActionToolbar.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import Pagination from '@/components/common/Pagination.vue';
import ViewToolbar from '@/components/common/ViewToolbar.vue';
import { usePermission } from '@/composables/usePermission';
import { useTableSelection } from '@/composables/useTableSelection';
import { useBusinessTypeStore } from '@/stores/business-type';
import { useDepartmentStore } from '@/stores/department';
import { useKnowledgeStore } from '@/stores/knowledge';
import type { DocType, KnowledgeDocument, UploadKnowledgeDocumentRequest } from '@/types/knowledge';
import { DOC_TYPE_LABELS, DOCUMENT_STATUS_LABELS, DocumentStatus } from '@/types/knowledge';
import { intersectByFacet } from '@/utils/cascadeFilter';

import DocumentTable from './components/DocumentTable.vue';
import DocumentDetailModal from './components/modals/DocumentDetailModal.vue';
import UploadDocumentModal from './components/modals/UploadDocumentModal.vue';
import UploadVersionModal from './components/modals/UploadVersionModal.vue';

type SortKey = 'updatedAt' | 'uploadedAt' | 'filename';

const { hasFeaturePermission } = usePermission();
const knowledgeStore = useKnowledgeStore();
const departmentStore = useDepartmentStore();
const businessTypeStore = useBusinessTypeStore();

const canUpload = computed(() => hasFeaturePermission('knowledge-base', 'create'));
const canEdit = computed(() => hasFeaturePermission('knowledge-base', 'edit'));
const canDelete = computed(() => hasFeaturePermission('knowledge-base', 'delete'));
// admin / manager 可跨部門查詢；user 由後端限縮，不顯示部門篩選
const canCrossDepartment = computed(() => hasFeaturePermission('knowledge-base', 'manage'));

const filters = computed(() => knowledgeStore.filters);

// ── 選項與名稱對照（由組織模組解析）────────────────────────────
const deptNameMap = computed<Record<string, string>>(() =>
  Object.fromEntries(departmentStore.departments.map((d) => [d.id, d.name]))
);

const allBusinessTypes = computed(() =>
  Object.values(businessTypeStore.businessTypesByDept).flat()
);

const btNameMap = computed<Record<string, string>>(() =>
  Object.fromEntries(allBusinessTypes.value.map((b) => [b.id, b.name]))
);

// 給 modal 用：全部業務別含所屬部門 id，供「每檔依部門連動」過濾
const businessTypeChoices = computed(() =>
  allBusinessTypes.value.map((b) => ({
    value: b.id,
    label: b.name,
    departmentId: b.departmentId,
  }))
);

// 篩選器選項一律由後端可見範圍 facets 驅動（非靜態全量），固定不隨其他已選篩選連動。
// 依 DOC_TYPE_LABELS 既有順序排列，僅保留 facets 內實際存在者。
const docTypeFilterOptions = computed(() =>
  (Object.keys(DOC_TYPE_LABELS) as DocType[])
    .filter((v) => knowledgeStore.facets.docTypes.includes(v))
    .map((v) => ({ value: v, label: DOC_TYPE_LABELS[v] }))
);

const departmentFilterOptions = computed(() =>
  departmentStore.departments
    .filter((d) => d.active)
    // 此頁篩選選項去除「農會」前綴（如「農會信用部」→「信用部」），其他模組不受影響
    .map((d) => ({ value: d.id, label: d.name.replace(/^農會/, '') }))
);

// 業務別選項:
//   - 未選部門 → facets 全集(可見範圍內所有有文件的業務別)
//   - 已選部門 → 該部門下業務別 ∩ facets(階層內 + 有文件)
// 名稱經組織模組解析（fallback 顯 id）。
const businessTypeFilterOptions = computed(() => {
  const facetIds = knowledgeStore.facets.businessTypeIds;
  const deptId = filters.value.departmentId;
  const candidates = deptId
    ? (businessTypeStore.businessTypesByDept[deptId] ?? []).map((b) => b.id)
    : facetIds;
  return intersectByFacet(candidates, facetIds).map((id) => ({
    value: id,
    label: btNameMap.value[id] ?? id,
  }));
});

// 狀態選項依 facets，固定順序（已就緒 → 上傳中 → 處理中 → 錯誤）；標籤用集中來源
const statusOptions = computed(() =>
  [DocumentStatus.READY, DocumentStatus.UPLOADING, DocumentStatus.PROCESSING, DocumentStatus.ERROR]
    .filter((s) => knowledgeStore.facets.statuses.includes(s))
    .map((s) => ({ value: s, label: DOCUMENT_STATUS_LABELS[s] }))
);

const hasActiveFilter = computed(
  () =>
    !!(
      filters.value.keyword ||
      filters.value.docType ||
      filters.value.departmentId ||
      filters.value.businessTypeId ||
      filters.value.status
    )
);

// ── 搜尋（防抖）────────────────────────────────────────────────
const keyword = computed(() => filters.value.keyword ?? '');
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const onSearch = (value: string) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    clearSelection();
    knowledgeStore.setFilters({ keyword: value || undefined });
  }, 300);
};

const setFilter = (
  key: 'docType' | 'departmentId' | 'businessTypeId' | 'status',
  value: string
) => {
  clearSelection();
  const patch: Partial<typeof filters.value> = { [key]: value || undefined };
  // 切換部門時清空業別，避免殘留他部門業別造成空結果
  if (key === 'departmentId') patch.businessTypeId = undefined;
  knowledgeStore.setFilters(patch);
};

const clearFilters = () => {
  clearSelection();
  knowledgeStore.resetFilters();
};

// ── 分頁 ───────────────────────────────────────────────────────
const onPageChange = (page: number) => {
  clearSelection();
  knowledgeStore.setPage(page);
};
const onPageSizeChange = (size: number) => {
  clearSelection();
  knowledgeStore.setPageSize(size);
};

// ── 批次選取 ───────────────────────────────────────────────────
const { selectedIds, toggleAll, toggleRow, clearSelection } = useTableSelection<KnowledgeDocument>(
  () => knowledgeStore.documents
);

// ── Modal 狀態 ─────────────────────────────────────────────────
const showUploadModal = ref(false);
const showDetailModal = ref(false);
const showDeleteModal = ref(false);
const showBatchDeleteModal = ref(false);
const showVersionModal = ref(false);
const selectedDocument = ref<KnowledgeDocument | null>(null);

const handleDetail = (doc: KnowledgeDocument) => {
  selectedDocument.value = doc;
  showDetailModal.value = true;
};

const handlePreview = (doc: KnowledgeDocument) => {
  if (doc.status !== 'ready' || !doc.fileUrl) return;
  window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
};

const handleEdit = (doc: KnowledgeDocument) => {
  selectedDocument.value = doc;
  showDetailModal.value = true;
};

const handleDelete = (doc: KnowledgeDocument) => {
  selectedDocument.value = doc;
  showDeleteModal.value = true;
};

const handleUploadVersion = (doc: KnowledgeDocument) => {
  selectedDocument.value = doc;
  showVersionModal.value = true;
};

const handleUpload = async (payload: UploadKnowledgeDocumentRequest) => {
  await knowledgeStore.uploadDocument(payload);
};

const handleSave = async (
  id: string,
  data: {
    description: string;
  }
) => {
  // 後端 PUT /knowledge/documents/{id} 僅接受中繼資料；docType/版本/部門/業務別不可改
  await knowledgeStore.updateDocument({ documentId: id, ...data });
};

const handleUploadNewVersion = async (
  payload: import('@/types/knowledge').UploadNewVersionRequest
) => {
  await knowledgeStore.uploadNewVersion(payload);
};

const handleConfirmDelete = async () => {
  if (selectedDocument.value) {
    await knowledgeStore.deleteDocument(selectedDocument.value.id);
  }
  showDeleteModal.value = false;
  selectedDocument.value = null;
};

const handleConfirmBatchDelete = async () => {
  await knowledgeStore.batchDelete([...selectedIds.value]);
  clearSelection();
  showBatchDeleteModal.value = false;
};

// ── 向量化狀態輪詢（存在 processing 文件時每 5 秒刷新，最多 5 分鐘）──
let pollTimer: ReturnType<typeof setInterval> | undefined;
let pollCount = 0;
const startPolling = () => {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    pollCount += 1;
    if (!knowledgeStore.hasProcessing || pollCount > 60) {
      clearInterval(pollTimer);
      pollTimer = undefined;
      pollCount = 0;
      return;
    }
    await knowledgeStore.fetchDocuments();
  }, 5000);
};

onMounted(async () => {
  await Promise.all([
    knowledgeStore.fetchDocuments(),
    knowledgeStore.fetchDocumentTypes(),
    departmentStore.fetchDepartments(),
  ]);
  await Promise.all(
    departmentStore.departments.map((d) => businessTypeStore.fetchBusinessTypes(d.id))
  );
  if (knowledgeStore.hasProcessing) startPolling();
});

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.knowledge-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 1400px;
  padding: 2rem;
  margin: 0 auto;
}

.delete-confirm-text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text);
}

/* BatchActionToolbar 底色在本頁覆寫為中性灰（不影響其他頁使用此元件） */
:deep(.batch-toolbar) {
  background: var(--bg-2);
}

@media (width <= 767px) {
  .knowledge-page {
    padding: 1rem;
  }
}
</style>
