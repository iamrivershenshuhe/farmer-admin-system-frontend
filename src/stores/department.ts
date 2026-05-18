import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  batchDeleteDepartments,
  batchSetDepartmentActive,
  createDepartment as apiCreate,
  deleteDepartment as apiDelete,
  getDepartments,
  setDepartmentActive,
  updateDepartment as apiUpdate,
} from '@/api/department';
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
 * 兩組資料：
 * - `departments`：完整清單，供其他模組（知識庫 / 電子表單）下拉與名稱對照（向後相容）
 * - `list` 等：部門管理 tab 的分頁／篩選／排序結果
 */
export const useDepartmentStore = defineStore('department', () => {
  // ── 向後相容：完整清單（下拉用）─────────────────────────────
  const departments = ref<Department[]>([]);
  const isLoading = ref(false);

  const activeDepartments = computed(() => departments.value.filter((d) => d.active));
  const getDepartmentById = (id: string) => departments.value.find((d) => d.id === id);
  const getDepartmentByCode = (code: string) => departments.value.find((d) => d.code === code);

  async function fetchDepartments(): Promise<void> {
    isLoading.value = true;
    try {
      // mock/後端的 /departments 為分頁結構，需取 items；大 pageSize 取完整清單供下拉
      const res = await getDepartments({ page: 1, pageSize: 999, active: true });
      departments.value = res.data.items;
    } finally {
      isLoading.value = false;
    }
  }

  // ── 部門管理 tab：server 驅動分頁／篩選／排序 ────────────────
  const list = ref<Department[]>([]);
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
      const res = await getDepartments({
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

  async function createDepartment(data: DepartmentFormData): Promise<void> {
    await apiCreate(data);
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
    // 向後相容
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
