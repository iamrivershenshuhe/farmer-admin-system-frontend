<template>
  <div class="org-tab-page">
    <div v-if="drillDeptName" class="org-drill">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      由「部門管理 › {{ drillDeptName }}」下鑽，已套用部門篩選
      <button class="link-btn" @click="clearDrill">清除下鑽</button>
    </div>

    <ViewToolbar
      subtitle="跨部門業務別管理（影響 RAG 檢索 / 知識庫可見 / 電子表單可生成範圍）"
      :search="{ modelValue: keyword, placeholder: '搜尋業務別名稱...' }"
      @update:search="onSearch"
    >
      <template #actions>
        <IconBtn
          v-if="canCreate"
          icon="PLUS"
          label="新增業務別"
          variant="primary"
          @click="openCreate"
        />
      </template>
      <template #filters>
        <FilterSelect
          :model-value="store.filters.departmentId ?? ''"
          :options="departmentOptions"
          placeholder="全部部門"
          @update:model-value="setDept"
        />
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

    <BusinessTypeTable
      :business-types="store.list"
      :selected-ids="canDelete ? selectedIds : undefined"
      :permissions="{ canEdit, canDelete }"
      :sort-by="store.filters.sortBy"
      :sort-order="store.filters.sortOrder"
      :dept-name-map="deptNameMap"
      @toggle-row="toggleRow"
      @toggle-all="toggleAll"
      @sort="store.setSort($event)"
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

    <BusinessTypeModal
      ref="modalRef"
      v-model="showModal"
      :business-type="selected"
      :department-options="departmentOptions"
      :locked-department-id="lockedDeptId"
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
import { useRoute, useRouter } from 'vue-router';

import IconBtn from '@/components/base/IconBtn.vue';
import BatchActionToolbar from '@/components/common/BatchActionToolbar.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import Pagination from '@/components/common/Pagination.vue';
import ViewToolbar from '@/components/common/ViewToolbar.vue';
import { usePermission } from '@/composables/usePermission';
import { useTableSelection } from '@/composables/useTableSelection';
import { useBusinessTypeStore } from '@/stores/business-type';
import { useDepartmentStore } from '@/stores/department';
import type {
  BusinessType,
  CreateBusinessTypePayload,
  UpdateBusinessTypePayload,
} from '@/types/business-type';

import BusinessTypeModal from './components/business-type/BusinessTypeModal.vue';
import BusinessTypeTable from './components/business-type/BusinessTypeTable.vue';
import ConfirmDeactivateModal from './components/ConfirmDeactivateModal.vue';
import ConfirmDeleteModal from './components/ConfirmDeleteModal.vue';

const route = useRoute();
const router = useRouter();
const { hasFeaturePermission } = usePermission();
const store = useBusinessTypeStore();
const departmentStore = useDepartmentStore();

// 業務別權限複用 departments
const canCreate = computed(() => hasFeaturePermission('departments', 'create'));
const canEdit = computed(() => hasFeaturePermission('departments', 'edit'));
const canDelete = computed(() => hasFeaturePermission('departments', 'delete'));

const { selectedIds, toggleAll, toggleRow, clearSelection } = useTableSelection(() => store.list);

const deptNameMap = computed<Record<string, string>>(() =>
  Object.fromEntries(departmentStore.departments.map((d) => [d.id, d.name]))
);
const departmentOptions = computed(() =>
  departmentStore.departments.filter((d) => d.active).map((d) => ({ value: d.id, label: d.name }))
);
const drillDeptName = computed(() =>
  store.filters.departmentId ? deptNameMap.value[store.filters.departmentId] : ''
);

// ── 搜尋 / 篩選 ───────────────────────────────────────────────
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
const setDept = (v: string) => {
  clearSelection();
  store.setFilters({ departmentId: v || undefined });
};
const hasActiveFilter = computed(
  () =>
    !!store.filters.keyword || !!store.filters.departmentId || store.filters.active !== undefined
);
const clearFilters = () => {
  clearSelection();
  store.resetFilters();
};
const clearDrill = () => {
  router.replace({ name: 'organization-business-types' });
  store.setFilters({ departmentId: undefined });
};

// ── 新增 / 編輯 ───────────────────────────────────────────────
const showModal = ref(false);
const selected = ref<BusinessType | null>(null);
const modalRef = ref<InstanceType<typeof BusinessTypeModal> | null>(null);
const lockedDeptId = computed(() =>
  selected.value ? undefined : (store.filters.departmentId ?? undefined)
);

const openCreate = () => {
  selected.value = null;
  showModal.value = true;
};
const openEdit = (bt: BusinessType) => {
  selected.value = bt;
  showModal.value = true;
};
const handleSubmit = async (
  data: (CreateBusinessTypePayload | UpdateBusinessTypePayload) & { departmentId: string }
) => {
  try {
    const { departmentId, name, description, active } = data;
    if (selected.value) {
      await store.updateBusinessType(selected.value.id, departmentId, {
        name,
        description,
        active,
      });
    } else {
      await store.createBusinessType(departmentId, { name: name ?? '', description, active });
    }
    showModal.value = false;
  } catch (err) {
    modalRef.value?.setError(err instanceof Error ? err.message : '儲存失敗');
  }
};

// ── 停用 / 啟用（停用需確認，啟用直接執行）────────────────────
const showDeactivate = ref(false);
const pendingDeact = ref<BusinessType | null>(null);
const pendingDeactBatch = ref<string[]>([]);

const deactivateTitle = computed(() =>
  pendingDeactBatch.value.length ? '批次停用確認' : '確認停用'
);
const deactivateMessage = computed(() =>
  pendingDeactBatch.value.length
    ? `將停用選取的 ${pendingDeactBatch.value.length} 個業務別。`
    : `將停用「${pendingDeact.value?.name ?? ''}」。`
);

const onToggleActive = (bt: BusinessType) => {
  if (bt.active) {
    pendingDeact.value = bt;
    pendingDeactBatch.value = [];
    showDeactivate.value = true;
  } else {
    store.setActive(bt.id, true, bt.departmentId);
  }
};
const batchActivate = async () => {
  await store.batchSetActive([...selectedIds.value], true);
  clearSelection();
};
const askBatchDeactivate = () => {
  pendingDeact.value = null;
  pendingDeactBatch.value = [...selectedIds.value];
  showDeactivate.value = true;
};
const doDeactivate = async () => {
  if (pendingDeactBatch.value.length) await store.batchSetActive(pendingDeactBatch.value, false);
  else if (pendingDeact.value)
    await store.setActive(pendingDeact.value.id, false, pendingDeact.value.departmentId);
  showDeactivate.value = false;
  clearSelection();
};

// ── 刪除（守門 + 改為停用）────────────────────────────────────
const showDelete = ref(false);
const deleteError = ref('');
const pendingBt = ref<BusinessType | null>(null);
const pendingBatch = ref<string[]>([]);

const deleteTitle = computed(() => (pendingBatch.value.length ? '批次刪除確認' : '確認刪除'));
const deleteMessage = computed(() =>
  pendingBatch.value.length
    ? `將永久刪除選取的 ${pendingBatch.value.length} 個業務別，不可復原。`
    : `將永久刪除「${pendingBt.value?.name ?? ''}」，不可復原。`
);

const openDelete = (bt: BusinessType) => {
  pendingBt.value = bt;
  pendingBatch.value = [];
  deleteError.value = '';
  showDelete.value = true;
};
const openBatchDelete = () => {
  pendingBt.value = null;
  pendingBatch.value = [...selectedIds.value];
  deleteError.value = '';
  showDelete.value = true;
};
const confirmDeactivate = async () => {
  if (pendingBatch.value.length) await store.batchSetActive(pendingBatch.value, false);
  else if (pendingBt.value)
    await store.setActive(pendingBt.value.id, false, pendingBt.value.departmentId);
  showDelete.value = false;
  clearSelection();
};
const confirmDelete = async () => {
  try {
    if (pendingBatch.value.length) await store.batchDelete(pendingBatch.value);
    else if (pendingBt.value)
      await store.deleteBusinessType(pendingBt.value.id, pendingBt.value.departmentId);
    showDelete.value = false;
    clearSelection();
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : '刪除失敗';
  }
};

onMounted(async () => {
  const dept = route.query.dept;
  if (typeof dept === 'string' && dept) {
    store.filters.departmentId = dept;
  }
  // 部門名稱對照失敗不應阻擋業務別清單渲染
  await Promise.allSettled([departmentStore.fetchDepartments(), store.fetchList()]);
});
onBeforeUnmount(() => clearTimeout(searchTimer));
</script>

<style scoped>
.org-tab-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.org-drill {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.625rem 0.875rem;
  font-size: 0.8125rem;
  color: var(--text-2);
  background: var(--bg-2);
  border-radius: var(--r-md);
}

.org-drill svg {
  width: 0.9375rem;
  height: 0.9375rem;
}

.link-btn {
  margin-left: auto;
  font-size: 0.8125rem;
  color: var(--text-2);
  cursor: pointer;
  background: transparent;
  border: none;
}

.link-btn:hover {
  color: var(--accent);
  transition: color 0.15s ease;
}
</style>
