<template>
  <div class="org-tab-page">
    <ViewToolbar
      subtitle="管理組織部門結構與業務別生命週期"
      :search="{ modelValue: keyword, placeholder: '搜尋部門名稱／代碼...' }"
      @update:search="onSearch"
    >
      <template #actions>
        <IconBtn
          v-if="canCreate"
          icon="PLUS"
          label="新增部門"
          variant="primary"
          @click="openCreate"
        />
      </template>
      <template #filters>
        <FilterSelect
          :model-value="statusFilter"
          :options="statusOptions"
          placeholder="全部狀態"
          @update:model-value="setStatus"
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
      show-deactivate
      @confirm-activate="batchActivate"
      @confirm-deactivate="askBatchDeactivate"
      @confirm-delete="openBatchDelete"
      @cancel="clearSelection"
    />

    <DepartmentTable
      :departments="store.list"
      :selected-ids="canDelete ? selectedIds : undefined"
      :permissions="{ canEdit, canDelete }"
      :sort-by="store.filters.sortBy"
      :sort-order="store.filters.sortOrder"
      @toggle-row="toggleRow"
      @toggle-all="toggleAll"
      @sort="store.setSort($event)"
      @drill="goToBusinessTypes"
      @edit="openEdit"
      @toggle-active="onToggleActive"
      @delete="openDelete"
    />

    <Pagination
      :current-page="store.currentPage"
      :total-pages="store.totalPages"
      :total="store.total"
      :start-index="store.startIndex"
      :end-index="store.endIndex"
      :page-size="store.pageSize"
      @page-change="store.setPage"
      @page-size-change="store.setPageSize"
    />

    <DepartmentModal
      ref="modalRef"
      v-model="showModal"
      :department="selected"
      @submit="handleSubmit"
    />

    <ConfirmDeleteModal
      v-model="showDelete"
      :title="deleteTitle"
      :message="deleteMessage"
      :error-message="deleteError"
      @deactivate="confirmDeactivate"
      @confirm="confirmDelete"
      @close="deleteError = ''"
    />

    <ConfirmDeactivateModal
      v-model="showDeactivate"
      :title="deactivateTitle"
      :message="deactivateMessage"
      @confirm="doDeactivate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import IconBtn from '@/components/base/IconBtn.vue';
import BatchActionToolbar from '@/components/common/BatchActionToolbar.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import Pagination from '@/components/common/Pagination.vue';
import ViewToolbar from '@/components/common/ViewToolbar.vue';
import { useNotification } from '@/composables/useNotification';
import { usePermission } from '@/composables/usePermission';
import { useTableSelection } from '@/composables/useTableSelection';
import { useDepartmentStore } from '@/stores/department';
import { useStaffStore } from '@/stores/staff';
import type { BatchResult } from '@/types/api';
import type { Department, DepartmentFormData } from '@/types/department';

import ConfirmDeactivateModal from './components/ConfirmDeactivateModal.vue';
import ConfirmDeleteModal from './components/ConfirmDeleteModal.vue';
import DepartmentModal from './components/department/DepartmentModal.vue';
import DepartmentTable from './components/department/DepartmentTable.vue';

const router = useRouter();
const { hasFeaturePermission } = usePermission();
const notify = useNotification();
const store = useDepartmentStore();
const staffStore = useStaffStore();

/** 批次操作部分失敗時以 warning 呈現；全部成功則維持原本（無 toast）行為 */
const surfaceBatchFailures = (result: BatchResult) => {
  if (result.failed.length === 0) return;
  const reasons = [...new Set(result.failed.map((f) => f.message))].join('、');
  notify.warning(`已成功 ${result.success.length} 筆,失敗 ${result.failed.length} 筆:${reasons}`);
};

const canCreate = computed(() => hasFeaturePermission('departments', 'create'));
const canEdit = computed(() => hasFeaturePermission('departments', 'edit'));
const canDelete = computed(() => hasFeaturePermission('departments', 'delete'));

const { selectedIds, toggleAll, toggleRow, clearSelection } = useTableSelection(() => store.list);

// ── 搜尋（防抖）/ 篩選 ─────────────────────────────────────────
const keyword = computed(() => store.filters.keyword ?? '');
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const onSearch = (value: string) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    clearSelection();
    store.setFilters({ keyword: value || undefined });
  }, 300);
};

const statusOptions = [
  { value: 'true', label: '啟用' },
  { value: 'false', label: '停用' },
];
const statusFilter = computed(() =>
  store.filters.active === undefined ? '' : String(store.filters.active)
);
const setStatus = (v: string) => {
  clearSelection();
  store.setFilters({ active: v === '' ? undefined : v === 'true' });
};
const hasActiveFilter = computed(
  () => !!store.filters.keyword || store.filters.active !== undefined
);
const clearFilters = () => {
  clearSelection();
  store.resetFilters();
};

// ── 下鑽業務別 ────────────────────────────────────────────────
const goToBusinessTypes = (dept: Department) => {
  router.push({ name: 'organization-business-types', query: { dept: dept.id } });
};

// ── 新增 / 編輯 ───────────────────────────────────────────────
const showModal = ref(false);
const selected = ref<Department | null>(null);
const modalRef = ref<InstanceType<typeof DepartmentModal> | null>(null);

const openCreate = () => {
  selected.value = null;
  showModal.value = true;
};
const openEdit = (dept: Department) => {
  selected.value = dept;
  showModal.value = true;
};
const handleSubmit = async (data: DepartmentFormData) => {
  try {
    if (selected.value) await store.updateDepartment(selected.value.id, data);
    else await store.createDepartment(data);
    showModal.value = false;
  } catch (err) {
    modalRef.value?.setError(err instanceof Error ? err.message : '儲存失敗');
  }
};

// ── 停用 / 啟用（停用需確認，啟用直接執行）────────────────────
const showDeactivate = ref(false);
const pendingDeact = ref<Department | null>(null);
const pendingDeactBatch = ref<string[]>([]);

const deactivateTitle = computed(() =>
  pendingDeactBatch.value.length ? '批次停用確認' : '確認停用'
);
const deactivateMessage = computed(() =>
  pendingDeactBatch.value.length
    ? `將停用選取的 ${pendingDeactBatch.value.length} 個部門。`
    : `將停用「${pendingDeact.value?.name ?? ''}」。`
);

const onToggleActive = (dept: Department) => {
  if (dept.active) {
    pendingDeact.value = dept;
    pendingDeactBatch.value = [];
    showDeactivate.value = true;
  } else {
    store.setActive(dept.id, true);
  }
};
const batchActivate = async () => {
  const result = await store.batchSetActive([...selectedIds.value], true);
  surfaceBatchFailures(result);
  clearSelection();
};
const askBatchDeactivate = () => {
  pendingDeact.value = null;
  pendingDeactBatch.value = [...selectedIds.value];
  showDeactivate.value = true;
};
const doDeactivate = async () => {
  if (pendingDeactBatch.value.length) {
    const result = await store.batchSetActive(pendingDeactBatch.value, false);
    surfaceBatchFailures(result);
  } else if (pendingDeact.value) await store.setActive(pendingDeact.value.id, false);
  showDeactivate.value = false;
  clearSelection();
};

// ── 刪除（守門 + 改為停用）────────────────────────────────────
const showDelete = ref(false);
const deleteError = ref('');
const pendingDept = ref<Department | null>(null);
const pendingBatch = ref<string[]>([]);

const deleteTitle = computed(() => (pendingBatch.value.length ? '批次刪除確認' : '確認刪除'));
const deleteMessage = computed(() =>
  pendingBatch.value.length
    ? `將永久刪除選取的 ${pendingBatch.value.length} 個部門，不可復原。`
    : `將永久刪除「${pendingDept.value?.name ?? ''}」，不可復原。`
);

const openDelete = (dept: Department) => {
  pendingDept.value = dept;
  pendingBatch.value = [];
  deleteError.value = '';
  showDelete.value = true;
};
const openBatchDelete = () => {
  pendingDept.value = null;
  pendingBatch.value = [...selectedIds.value];
  deleteError.value = '';
  showDelete.value = true;
};
const confirmDeactivate = async () => {
  if (pendingBatch.value.length) {
    const result = await store.batchSetActive(pendingBatch.value, false);
    surfaceBatchFailures(result);
  } else if (pendingDept.value) await store.setActive(pendingDept.value.id, false);
  showDelete.value = false;
  clearSelection();
};
const confirmDelete = async () => {
  try {
    if (pendingBatch.value.length) {
      const result = await store.batchDelete(pendingBatch.value);
      surfaceBatchFailures(result);
    } else if (pendingDept.value) await store.deleteDepartment(pendingDept.value.id);
    showDelete.value = false;
    clearSelection();
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : '刪除失敗';
  }
};

onMounted(() => {
  store.fetchList();
  staffStore.fetchManagers();
});
onBeforeUnmount(() => clearTimeout(searchTimer));
</script>

<style scoped>
.org-tab-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
