import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
  batchDeleteBusinessTypes,
  batchSetBusinessTypeActive,
  createBusinessType as apiCreate,
  deleteBusinessType as apiDelete,
  getBusinessTypes,
  getBusinessTypesByDept,
  setBusinessTypeActive,
  updateBusinessType as apiUpdate,
} from '@/api/business-type';
import type {
  BusinessType,
  CreateBusinessTypePayload,
  UpdateBusinessTypePayload,
} from '@/types/business-type';

interface Filters {
  keyword?: string;
  departmentId?: string;
  active?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTERS: Filters = {
  keyword: undefined,
  departmentId: undefined,
  active: undefined,
  sortBy: 'name',
  sortOrder: 'asc',
};

/**
 * 業務別狀態 — 薄層，server 驅動（對齊 stores/knowledge.ts）。
 *
 * - `businessTypesByDept`：依部門快取，供知識庫 / 電子表單連動下拉與下鑽（向後相容）
 * - `list` 等：業務別管理 tab 的跨部門分頁／篩選／排序結果
 */
export const useBusinessTypeStore = defineStore('business-type', () => {
  // ── 向後相容：依部門快取 ───────────────────────────────────
  const businessTypesByDept = ref<Record<string, BusinessType[]>>({});
  const isLoadingByDept = ref<Record<string, boolean>>({});

  async function fetchBusinessTypes(deptId: string, force = false): Promise<void> {
    if (businessTypesByDept.value[deptId] && !force) return;
    isLoadingByDept.value[deptId] = true;
    try {
      const res = await getBusinessTypesByDept(deptId);
      businessTypesByDept.value[deptId] = res.data.items;
    } finally {
      isLoadingByDept.value[deptId] = false;
    }
  }

  // ── 業務別管理 tab：跨部門 server 驅動 ──────────────────────
  const list = ref<BusinessType[]>([]);
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
      const res = await getBusinessTypes({
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

  /** 重新整理：清掉受影響部門快取並刷新跨部門清單 */
  async function refresh(deptId?: string): Promise<void> {
    if (deptId) delete businessTypesByDept.value[deptId];
    await fetchList();
  }

  async function createBusinessType(
    deptId: string,
    payload: Omit<CreateBusinessTypePayload, 'departmentId'>
  ): Promise<void> {
    await apiCreate({ ...payload, departmentId: deptId });
    await refresh(deptId);
  }
  async function updateBusinessType(
    btId: string,
    deptId: string,
    payload: Omit<UpdateBusinessTypePayload, 'departmentId'>
  ): Promise<void> {
    // 帶 departmentId 以支援編輯時變更所屬部門（仍須為某部門）
    await apiUpdate(btId, { ...payload, departmentId: deptId });
    await refresh(deptId);
  }
  /** 受守門硬刪除：仍被指派時 httpClient reject，由 view 接住顯示 inline */
  async function deleteBusinessType(btId: string, deptId: string): Promise<void> {
    await apiDelete(btId);
    await refresh(deptId);
  }
  async function setActive(id: string, active: boolean, deptId?: string): Promise<void> {
    await setBusinessTypeActive(id, active);
    await refresh(deptId);
  }
  async function batchSetActive(ids: string[], active: boolean): Promise<void> {
    await batchSetBusinessTypeActive(ids, active);
    businessTypesByDept.value = {};
    await fetchList();
  }
  async function batchDelete(ids: string[]): Promise<void> {
    await batchDeleteBusinessTypes(ids);
    businessTypesByDept.value = {};
    await fetchList();
  }

  return {
    // 向後相容
    businessTypesByDept,
    isLoadingByDept,
    fetchBusinessTypes,
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
    createBusinessType,
    updateBusinessType,
    deleteBusinessType,
    setActive,
    batchSetActive,
    batchDelete,
  };
});
