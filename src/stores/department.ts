import { defineStore } from 'pinia';
import { computed } from 'vue';

import {
  batchDeleteDepartments,
  batchSetDepartmentActive,
  createDepartment as apiCreate,
  deleteDepartment as apiDelete,
  getDepartments,
  setDepartmentActive,
  updateDepartment as apiUpdate,
} from '@/api/department';
import { useListController } from '@/composables/useListController';
import type { Department, DepartmentFormData } from '@/types/department';

interface Filters {
  keyword?: string;
  active?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTERS: Filters = {
  keyword: undefined,
  active: undefined,
  sortBy: 'code',
  sortOrder: 'asc',
};

/**
 * 部門狀態 — 薄層，server 驅動（對齊 stores/knowledge.ts）。
 *
 * 兩條資料路徑（由 {@link useListController} 統一管控，見 ADR-0003）：
 * - `departments`：全量(active only)，供其他模組（知識庫 / 電子表單）下拉與名稱對照
 * - `list` 等：部門管理 tab 的分頁／篩選／排序結果
 *
 * 對外名稱與行為完全沿用既有契約（見 baseline/department/contract.json）。
 */
export const useDepartmentStore = defineStore('department', () => {
  const ctrl = useListController<Department, Filters>({
    // 分頁 tab 用
    fetcher: async ({ page, pageSize, filters }) => {
      const res = await getDepartments({ page, pageSize, ...filters });
      return res.data;
    },
    // 下拉用全量（active only）
    allFetcher: async () => {
      const res = await getDepartments({ page: 1, pageSize: 999, active: true });
      return res.data.items;
    },
    initialFilters: { ...DEFAULT_FILTERS },
    defaultPageSize: 20,
  });

  // ── 對外名稱對齊既有 view callsites ─────────────────────────────
  // 全量（下拉）
  const departments = ctrl.allOptions;
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

  const activeDepartments = computed(() => departments.value.filter((d) => d.active));
  const getDepartmentById = (id: string) => departments.value.find((d) => d.id === id);
  const getDepartmentByCode = (code: string) => departments.value.find((d) => d.code === code);

  // ── Actions ─────────────────────────────────────────────────────
  function fetchDepartments(): Promise<void> {
    // 行為保留：舊版每次呼叫都重抓（無 dedup）
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
    // 行為保留：同欄位且當前 asc → desc；其餘 → asc（與 knowledge 預設方向相反）
    const order =
      filters.value.sortBy === sortBy && filters.value.sortOrder === 'asc' ? 'desc' : 'asc';
    return setFilters({ sortBy, sortOrder: order });
  }

  function resetFilters(): Promise<void> {
    return ctrl.resetFilters();
  }

  async function createDepartment(data: DepartmentFormData): Promise<void> {
    await apiCreate(data);
    // 行為保留：只重抓 list，不自動 invalidate 全量（避免擴大 T9 範疇）
    await fetchList();
  }

  async function updateDepartment(id: string, data: Partial<DepartmentFormData>): Promise<void> {
    await apiUpdate(id, data);
    await fetchList();
  }

  /** 受守門硬刪除：被引用時 httpClient reject，由 view 接住顯示 inline */
  async function deleteDepartment(id: string): Promise<void> {
    await apiDelete(id);
    await fetchList();
  }

  async function setActive(id: string, active: boolean): Promise<void> {
    await setDepartmentActive(id, active);
    await fetchList();
  }

  async function batchSetActive(ids: string[], active: boolean): Promise<void> {
    await batchSetDepartmentActive(ids, active);
    await fetchList();
  }

  async function batchDelete(ids: string[]): Promise<void> {
    await batchDeleteDepartments(ids);
    await fetchList();
  }

  return {
    // 向後相容（全量 / 下拉）
    departments,
    isLoading,
    activeDepartments,
    getDepartmentById,
    getDepartmentByCode,
    fetchDepartments,
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
    createDepartment,
    updateDepartment,
    deleteDepartment,
    setActive,
    batchSetActive,
    batchDelete,
  };
});
