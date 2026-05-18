import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  batchDeleteStaff,
  batchSetStaffActive,
  createStaff as apiCreate,
  deleteStaff as apiDelete,
  getManagers,
  getStaff,
  resetPassword as apiResetPassword,
  setStaffActive,
  updateStaff as apiUpdate,
  updateStaffRole as apiUpdateRole,
} from '@/api/staff';
import type { UserInfo, UserRole } from '@/types/user';

interface Filters {
  keyword?: string;
  department?: string;
  role?: UserRole;
  active?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTERS: Filters = {
  keyword: undefined,
  department: undefined,
  role: undefined,
  active: undefined,
  sortBy: 'username',
  sortOrder: 'asc',
};

type CreatePayload = Parameters<typeof apiCreate>[0];
type UpdatePayload = Parameters<typeof apiUpdate>[1];

/**
 * 人員狀態 — 薄層，server 驅動（對齊 stores/knowledge.ts）。
 *
 * - `users`：完整清單，供電子表單等模組查詢（向後相容）
 * - `list` 等：人員管理 tab 的分頁／篩選／排序結果
 */
export const useStaffStore = defineStore('staff', () => {
  // ── 向後相容：完整清單 ─────────────────────────────────────
  const users = ref<UserInfo[]>([]);
  const isLoading = ref(false);
  const managers = ref<UserInfo[]>([]);

  const getUserById = (id: string) => users.value.find((u) => u.id === id);
  const getUserByUsername = (username: string) => users.value.find((u) => u.username === username);
  const getUsersByDepartment = (department: string) =>
    users.value.filter((u) => u.department === department);

  async function fetchStaff(): Promise<void> {
    isLoading.value = true;
    try {
      const res = await getStaff({ page: 1, pageSize: 999 });
      users.value = res.data.items;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchManagers(): Promise<void> {
    const res = await getManagers();
    managers.value = res.data;
  }

  // ── 人員管理 tab：server 驅動 ──────────────────────────────
  const list = ref<UserInfo[]>([]);
  const total = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const totalPages = ref(1);
  const isListLoading = ref(false);
  const filters = ref<Filters>({ ...DEFAULT_FILTERS });

  const startIndex = computed(() =>
    total.value === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1
  );
  const endIndex = computed(() => Math.min(currentPage.value * pageSize.value, total.value));

  async function fetchList(): Promise<void> {
    isListLoading.value = true;
    try {
      const res = await getStaff({
        page: currentPage.value,
        pageSize: pageSize.value,
        ...filters.value,
      });
      const d = res.data;
      list.value = d.items;
      total.value = d.total;
      currentPage.value = d.page;
      pageSize.value = d.pageSize;
      totalPages.value = d.totalPages;
    } finally {
      isListLoading.value = false;
    }
  }

  function setPage(page: number): Promise<void> {
    currentPage.value = page;
    return fetchList();
  }
  function setPageSize(size: number): Promise<void> {
    pageSize.value = size;
    currentPage.value = 1;
    return fetchList();
  }
  function setFilters(patch: Partial<Filters>): Promise<void> {
    filters.value = { ...filters.value, ...patch };
    currentPage.value = 1;
    return fetchList();
  }
  function setSort(sortBy: string): Promise<void> {
    const order =
      filters.value.sortBy === sortBy && filters.value.sortOrder === 'asc' ? 'desc' : 'asc';
    return setFilters({ sortBy, sortOrder: order });
  }
  function resetFilters(): Promise<void> {
    filters.value = { ...DEFAULT_FILTERS };
    currentPage.value = 1;
    return fetchList();
  }

  async function createStaff(data: CreatePayload): Promise<void> {
    await apiCreate(data);
    await fetchList();
  }
  async function updateStaff(id: string, data: UpdatePayload): Promise<void> {
    await apiUpdate(id, data);
    await fetchList();
  }
  async function updateStaffRole(id: string, role: UserRole): Promise<void> {
    await apiUpdateRole(id, role);
    await fetchList();
  }
  async function resetPassword(
    id: string,
    payload: { newPassword: string; mustChangePassword: boolean }
  ): Promise<void> {
    await apiResetPassword(id, payload);
  }
  /** 受守門硬刪除：仍啟用時 httpClient reject，由 view 接住顯示 inline */
  async function deleteStaff(id: string): Promise<void> {
    await apiDelete(id);
    await fetchList();
  }
  async function setActive(id: string, active: boolean): Promise<void> {
    await setStaffActive(id, active);
    await fetchList();
  }
  async function batchSetActive(ids: string[], active: boolean): Promise<void> {
    await batchSetStaffActive(ids, active);
    await fetchList();
  }
  async function batchDelete(ids: string[]): Promise<void> {
    await batchDeleteStaff(ids);
    await fetchList();
  }

  return {
    // 向後相容
    users,
    isLoading,
    managers,
    getUserById,
    getUserByUsername,
    getUsersByDepartment,
    fetchStaff,
    fetchManagers,
    // server 驅動 tab
    list,
    total,
    currentPage,
    pageSize,
    totalPages,
    isListLoading,
    filters,
    startIndex,
    endIndex,
    fetchList,
    setPage,
    setPageSize,
    setFilters,
    setSort,
    resetFilters,
    createStaff,
    updateStaff,
    updateStaffRole,
    resetPassword,
    deleteStaff,
    setActive,
    batchSetActive,
    batchDelete,
  };
});
