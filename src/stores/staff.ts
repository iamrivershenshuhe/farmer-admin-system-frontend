import { defineStore } from 'pinia';
import { ref } from 'vue';

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
import { useListController } from '@/composables/useListController';
import type { UserInfo, UserRole } from '@/types/user';

interface Filters {
  keyword?: string;
  /** ADR-0006 R2: 邊界以 departmentId(id) 為單一語意,name 僅用於 entity 顯示 */
  departmentId?: string;
  role?: UserRole;
  active?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTERS: Filters = {
  keyword: undefined,
  departmentId: undefined,
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
 * 三條資料路徑:
 * - `users`:完整清單,供電子表單等模組查詢 → 走 useListController.allOptions
 * - `list` 等:人員管理 tab 的分頁／篩選／排序 → 走 useListController.items
 * - `managers`:獨立 /staff/managers endpoint 的結果(非 all 子集,屬 ADR-0007 F6 exception,**原樣保留**)
 *
 * 對外名稱與行為完全沿用既有契約（見 baseline/staff/contract.json）。
 *
 * T11a 範圍:list-controller 採用 + users/list 雙重狀態合一(內部單一資料源);
 *           managers 保留;`department` 名稱欄位雙語意問題留 T11b。
 */
export const useStaffStore = defineStore('staff', () => {
  const ctrl = useListController<UserInfo, Filters>({
    fetcher: async ({ page, pageSize, filters }) => {
      const res = await getStaff({ page, pageSize, ...filters });
      return res.data;
    },
    allFetcher: async () => {
      // 行為保留:全量取 pageSize=999,不帶 filters
      const res = await getStaff({ page: 1, pageSize: 999 });
      return res.data.items;
    },
    initialFilters: { ...DEFAULT_FILTERS },
    defaultPageSize: 20,
  });

  // ── 對外名稱對齊既有 view callsites ─────────────────────────────
  // 全量(view 用於 lookup 與其他模組查詢)
  const users = ctrl.allOptions;
  const isLoading = ctrl.isLoadingAll;
  // 分頁 tab
  const list = ctrl.items;
  const total = ctrl.total;
  const currentPage = ctrl.currentPage;
  const pageSize = ctrl.pageSize;
  const totalPages = ctrl.totalPages;
  const isListLoading = ctrl.isLoading;
  const filters = ctrl.filters;
  const startIndex = ctrl.startIndex;
  const endIndex = ctrl.endIndex;

  // ── 獨立 endpoint:managers(/staff/managers)─────────────────
  // 不屬 'all 子集',語意上是 server-side 過濾結果。保留為獨立 ref。
  const managers = ref<UserInfo[]>([]);

  async function fetchManagers(): Promise<void> {
    const res = await getManagers();
    managers.value = res.data;
  }

  // ── helpers(對 users 全量查詢)─────────────────────────────
  const getUserById = (id: string) => users.value.find((u) => u.id === id);
  const getUserByUsername = (username: string) => users.value.find((u) => u.username === username);
  const getUsersByDepartment = (department: string) =>
    users.value.filter((u) => u.department === department);

  // ── Actions ─────────────────────────────────────────────────────
  function fetchStaff(): Promise<void> {
    // 行為保留:舊版每次呼叫都重抓(無 dedup)
    return ctrl.fetchAllOptions(true);
  }

  function fetchList(): Promise<void> {
    return ctrl.fetchPage();
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

  function setSort(sortBy: string): Promise<void> {
    // 行為保留:asc-first toggle
    const order =
      filters.value.sortBy === sortBy && filters.value.sortOrder === 'asc' ? 'desc' : 'asc';
    return setFilters({ sortBy, sortOrder: order });
  }

  function resetFilters(): Promise<void> {
    return ctrl.resetFilters();
  }

  async function createStaff(data: CreatePayload): Promise<void> {
    await apiCreate(data);
    // 行為保留:不自動 invalidate users 全量
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
    // 行為保留:不重抓 list
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
    // 向後相容(全量)
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
