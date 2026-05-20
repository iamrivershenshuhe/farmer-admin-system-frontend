<template>
  <div class="org-tab-page">
    <ViewToolbar
      subtitle="管理人員帳號生命週期與業務範圍指派"
      :search="{ modelValue: keyword, placeholder: '搜尋姓名／帳號...' }"
      @update:search="onSearch"
    >
      <template #actions>
        <IconBtn
          v-if="canCreate"
          icon="PLUS"
          label="新增人員"
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
          :model-value="store.filters.role ?? ''"
          :options="roleOptions"
          placeholder="全部角色"
          @update:model-value="setRole"
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

    <StaffTable
      :users="store.list"
      :selected-ids="canDelete ? selectedIds : undefined"
      :permissions="{ canEdit, canDelete, canManage }"
      :sort-by="store.filters.sortBy"
      :sort-order="store.filters.sortOrder"
      :bt-name-map="btNameMap"
      @toggle-row="toggleRow"
      @toggle-all="toggleAll"
      @sort="store.setSort($event)"
      @edit="openEdit"
      @change-role="openChangeRole"
      @reset-password="openResetPassword"
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

    <UserModal ref="userModalRef" v-model="showUserModal" :user="selected" @submit="handleSubmit" />
    <ChangeRoleModal v-model="showRoleModal" :user="selected" @submit="handleChangeRole" />
    <ResetPasswordModal v-model="showPwdModal" :user="selected" @submit="handleResetPassword" />

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

import IconBtn from '@/components/base/IconBtn.vue';
import BatchActionToolbar from '@/components/common/BatchActionToolbar.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import Pagination from '@/components/common/Pagination.vue';
import ViewToolbar from '@/components/common/ViewToolbar.vue';
import { usePermission } from '@/composables/usePermission';
import { useTableSelection } from '@/composables/useTableSelection';
import { useBusinessTypeStore } from '@/stores/business-type';
import { useDepartmentStore } from '@/stores/department';
import { useStaffStore } from '@/stores/staff';
import type { UserInfo, UserRole } from '@/types/user';

import ConfirmDeactivateModal from './components/ConfirmDeactivateModal.vue';
import ConfirmDeleteModal from './components/ConfirmDeleteModal.vue';
import ChangeRoleModal from './components/staff/ChangeRoleModal.vue';
import ResetPasswordModal from './components/staff/ResetPasswordModal.vue';
import StaffTable from './components/staff/StaffTable.vue';
import UserModal from './components/staff/UserModal.vue';

const { hasFeaturePermission } = usePermission();
const store = useStaffStore();
const departmentStore = useDepartmentStore();
const businessTypeStore = useBusinessTypeStore();

const canCreate = computed(() => hasFeaturePermission('staff', 'create'));
const canEdit = computed(() => hasFeaturePermission('staff', 'edit'));
const canDelete = computed(() => hasFeaturePermission('staff', 'delete'));
const canManage = computed(() => hasFeaturePermission('staff', 'manage'));

const { selectedIds, toggleAll, toggleRow, clearSelection } = useTableSelection(() => store.list);

const departmentOptions = computed(() =>
  departmentStore.departments
    .filter((d) => d.active)
    .map((d) => ({
      value: d.id,
      label: d.name,
    }))
);
const roleOptions = [
  { value: 'admin', label: '系統管理員' },
  { value: 'manager', label: '部門主管' },
  { value: 'user', label: '一般員工' },
];
const statusOptions = [
  { value: 'true', label: '啟用' },
  { value: 'false', label: '停用' },
];

const btNameMap = computed<Record<string, string>>(() =>
  Object.fromEntries(
    Object.values(businessTypeStore.businessTypesByDept)
      .flat()
      .map((b) => [b.id, b.name])
  )
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
const setDept = (v: string) => {
  clearSelection();
  store.setFilters({ departmentId: v || undefined });
};
const setRole = (v: string) => {
  clearSelection();
  store.setFilters({ role: (v || undefined) as UserRole | undefined });
};
const statusFilter = computed(() =>
  store.filters.active === undefined ? '' : String(store.filters.active)
);
const setStatus = (v: string) => {
  clearSelection();
  store.setFilters({ active: v === '' ? undefined : v === 'true' });
};
const hasActiveFilter = computed(
  () =>
    !!store.filters.keyword ||
    !!store.filters.departmentId ||
    !!store.filters.role ||
    store.filters.active !== undefined
);
const clearFilters = () => {
  clearSelection();
  store.resetFilters();
};

// ── Modal 狀態 ────────────────────────────────────────────────
const showUserModal = ref(false);
const showRoleModal = ref(false);
const showPwdModal = ref(false);
const selected = ref<UserInfo | null>(null);
const userModalRef = ref<InstanceType<typeof UserModal> | null>(null);

const openCreate = () => {
  selected.value = null;
  showUserModal.value = true;
};
const openEdit = (u: UserInfo) => {
  selected.value = u;
  showUserModal.value = true;
};
const openChangeRole = (u: UserInfo) => {
  selected.value = u;
  showRoleModal.value = true;
};
const openResetPassword = (u: UserInfo) => {
  selected.value = u;
  showPwdModal.value = true;
};

const handleSubmit = async (data: {
  username: string;
  name?: string;
  role: UserRole | '';
  departmentId: string;
  businessTypeIds: string[];
  password?: string;
  mustChangePassword?: boolean;
}) => {
  try {
    if (selected.value) {
      await store.updateStaff(selected.value.id, {
        name: data.name,
        departmentId: data.departmentId || null,
        businessTypeIds: data.businessTypeIds,
      });
    } else {
      await store.createStaff({
        username: data.username,
        name: data.name,
        role: data.role as UserRole,
        departmentId: data.departmentId || null,
        businessTypeIds: data.businessTypeIds,
        password: data.password ?? '',
        mustChangePassword: data.mustChangePassword,
      });
    }
    showUserModal.value = false;
  } catch (err) {
    userModalRef.value?.setError(err instanceof Error ? err.message : '儲存失敗');
  }
};

const handleChangeRole = async (userId: string, role: UserRole) => {
  await store.updateStaffRole(userId, role);
  showRoleModal.value = false;
};
const handleResetPassword = async (userId: string, password: string, mustChange: boolean) => {
  await store.resetPassword(userId, { newPassword: password, mustChangePassword: mustChange });
  showPwdModal.value = false;
};

// ── 停用 / 啟用（停用需確認，啟用直接執行）────────────────────
const showDeactivate = ref(false);
const pendingDeact = ref<UserInfo | null>(null);
const pendingDeactBatch = ref<string[]>([]);

const deactivateTitle = computed(() =>
  pendingDeactBatch.value.length ? '批次停用確認' : '確認停用'
);
const deactivateMessage = computed(() =>
  pendingDeactBatch.value.length
    ? `將停用選取的 ${pendingDeactBatch.value.length} 個帳號。`
    : `將停用「${pendingDeact.value?.name || pendingDeact.value?.username || ''}」。`
);

const onToggleActive = (u: UserInfo) => {
  if (u.active) {
    pendingDeact.value = u;
    pendingDeactBatch.value = [];
    showDeactivate.value = true;
  } else {
    store.setActive(u.id, true);
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
  else if (pendingDeact.value) await store.setActive(pendingDeact.value.id, false);
  showDeactivate.value = false;
  clearSelection();
};

// ── 刪除（守門 + 改為停用）────────────────────────────────────
const showDelete = ref(false);
const deleteError = ref('');
const pendingUser = ref<UserInfo | null>(null);
const pendingBatch = ref<string[]>([]);

const deleteTitle = computed(() => (pendingBatch.value.length ? '批次刪除確認' : '確認刪除'));
const deleteMessage = computed(() =>
  pendingBatch.value.length
    ? `將永久刪除選取的 ${pendingBatch.value.length} 個帳號，不可復原。`
    : `將永久刪除「${pendingUser.value?.name || pendingUser.value?.username || ''}」，不可復原。`
);

const openDelete = (u: UserInfo) => {
  pendingUser.value = u;
  pendingBatch.value = [];
  deleteError.value = '';
  showDelete.value = true;
};
const openBatchDelete = () => {
  pendingUser.value = null;
  pendingBatch.value = [...selectedIds.value];
  deleteError.value = '';
  showDelete.value = true;
};
const confirmDeactivate = async () => {
  if (pendingBatch.value.length) await store.batchSetActive(pendingBatch.value, false);
  else if (pendingUser.value) await store.setActive(pendingUser.value.id, false);
  showDelete.value = false;
  clearSelection();
};
const confirmDelete = async () => {
  try {
    if (pendingBatch.value.length) await store.batchDelete(pendingBatch.value);
    else if (pendingUser.value) await store.deleteStaff(pendingUser.value.id);
    showDelete.value = false;
    clearSelection();
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : '刪除失敗';
  }
};

onMounted(async () => {
  // 名稱對照（部門/業務別）失敗不應阻擋人員清單渲染
  await Promise.allSettled([departmentStore.fetchDepartments(), store.fetchList()]);
  await Promise.allSettled(
    departmentStore.departments.map((d) => businessTypeStore.fetchBusinessTypes(d.id))
  );
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
