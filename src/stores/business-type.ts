import { defineStore } from 'pinia';
import { ref } from 'vue';

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
import { useListController } from '@/composables/useListController';
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
 * 兩條資料路徑：
 * - `businessTypesByDept`：依部門快取（per-key、lazy fetch），供知識庫/電子表單/staff modal 連動下拉與下鑽
 * - `list` 等：跨部門分頁／篩選／排序（管理 tab）
 *
 * **設計例外**（見 ADR-0007 F6、baseline/business-type/contract.json）：
 *   useListController 僅吸收**分頁 tab** 部分；`businessTypesByDept` 是 per-key 快取，
 *   與 ctrl.allOptions（單一全量陣列）語意不匹配，故原樣保留。
 *   強行映射會失去 lazy/per-key 行為，違反「行為零變動」紅線。
 *
 * 對外名稱與行為完全沿用既有契約（見 baseline contract）。
 */
export const useBusinessTypeStore = defineStore('business-type', () => {
  // ── 依部門快取（per-key,lazy fetch；不走 useListController）────
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

  // ── 跨部門分頁 tab（走 useListController，ADR-0003）─────────────
  const ctrl = useListController<BusinessType, Filters>({
    fetcher: async ({ page, pageSize, filters }) => {
      const res = await getBusinessTypes({ page, pageSize, ...filters });
      return res.data;
    },
    initialFilters: { ...DEFAULT_FILTERS },
    defaultPageSize: 20,
  });

  // 對外名稱對齊既有 view callsites
  const list = ctrl.items;
  const total = ctrl.total;
  const currentPage = ctrl.currentPage;
  const pageSize = ctrl.pageSize;
  const totalPages = ctrl.totalPages;
  const isListLoading = ctrl.isLoading;
  const filters = ctrl.filters;
  const startIndex = ctrl.startIndex;
  const endIndex = ctrl.endIndex;

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
    // 行為保留:asc-first toggle(同 department,與 knowledge desc-first 相反)
    const order =
      filters.value.sortBy === sortBy && filters.value.sortOrder === 'asc' ? 'desc' : 'asc';
    return setFilters({ sortBy, sortOrder: order });
  }

  function resetFilters(): Promise<void> {
    return ctrl.resetFilters();
  }

  // ── Mutations(跨兩條資料路徑,需手動同步)────────────────────
  /** 重新整理:清掉受影響部門快取並刷新跨部門清單 */
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
    // 行為保留:整個 per-dept 快取一次失效(粗但與舊版一致)
    businessTypesByDept.value = {};
    await fetchList();
  }

  async function batchDelete(ids: string[]): Promise<void> {
    await batchDeleteBusinessTypes(ids);
    businessTypesByDept.value = {};
    await fetchList();
  }

  return {
    // 向後相容(per-key 快取)
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
