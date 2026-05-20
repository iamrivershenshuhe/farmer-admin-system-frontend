import { computed, type Ref, ref } from 'vue';

import type { PaginationResponse } from '@/types/api';

/**
 * 排序狀態（單欄位）
 */
export interface SortState {
  by: string;
  order: 'asc' | 'desc';
}

/**
 * fetcher 接收的查詢參數
 */
export interface ListFetchParams<F> {
  page: number;
  pageSize: number;
  filters: F;
  sort: SortState | null;
}

/**
 * useListController 設定
 *
 * @template T  清單項型別
 * @template F  Filters 型別；建議用 `Pick<XxxApiRequest, ...>` 派生（見 ADR-0003）
 */
export interface UseListControllerOptions<T, F> {
  /** 分頁清單資料源；回傳已解包的 PaginationResponse */
  fetcher: (params: ListFetchParams<F>) => Promise<PaginationResponse<T>>;
  /** 下拉用全量資料源；未提供則 `fetchAllOptions()` 為 no-op */
  allFetcher?: () => Promise<T[]>;
  /** 初始 filters；resetFilters() 會還原至此 */
  initialFilters: F;
  /** 初始排序 */
  initialSort?: SortState | null;
  /** 預設每頁筆數，預設 20 */
  defaultPageSize?: number;
}

/**
 * 伺服器驅動清單控制器（深模組）
 *
 * 對外提供兩種輸出：
 *  - **分頁清單** (`items` / `total` / `currentPage` / `pageSize` / `totalPages`)
 *  - **下拉用全量** (`allOptions`)：取代既有 `users` / `departments` / `businessTypesByDept` 雙重狀態
 *
 * 設計約束：
 *  - Filters 型別由呼叫端用 `Pick<ApiRequest, ...>` 派生，禁止 inline 重定義
 *  - 後端為權威：fetcher 回傳的 page/pageSize 會回寫 controller（後端 clamp 後生效）
 *  - 不在 controller 內呼叫 toast 或 store；錯誤由 fetcher 拋出，呼叫端決定處理（見 ADR-0005）
 *
 * @see docs/adr/0003-list-controller.md
 */
export function useListController<T, F extends object>(options: UseListControllerOptions<T, F>) {
  // ── 分頁清單狀態 ─────────────────────────────────────────────────
  const items = ref<T[]>([]) as Ref<T[]>;
  const total = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(options.defaultPageSize ?? 20);
  const totalPages = ref(1);
  const isLoading = ref(false);

  const filters = ref({ ...options.initialFilters }) as Ref<F>;
  const sort = ref<SortState | null>(options.initialSort ?? null) as Ref<SortState | null>;

  // ── 全量選項狀態（取代雙重狀態） ────────────────────────────────
  const allOptions = ref<T[]>([]) as Ref<T[]>;
  const isLoadingAll = ref(false);
  let allOptionsLoaded = false;

  // ── 顯示用衍生值（1-based 起訖序號） ─────────────────────────────
  // 空清單 (total===0) 時 startIndex 為 0，避免「1 - 0 共 0 筆」這種無意義顯示
  const startIndex = computed(() =>
    total.value === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1
  );
  const endIndex = computed(() => Math.min(currentPage.value * pageSize.value, total.value));

  // ── 操作 ─────────────────────────────────────────────────────────
  async function fetchPage(): Promise<void> {
    isLoading.value = true;
    try {
      const res = await options.fetcher({
        page: currentPage.value,
        pageSize: pageSize.value,
        filters: filters.value,
        sort: sort.value,
      });
      items.value = res.items;
      total.value = res.total;
      totalPages.value = res.totalPages;
      // 後端為權威：若 clamp 後 page/pageSize 不同，以後端為準
      currentPage.value = res.page;
      pageSize.value = res.pageSize;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchAllOptions(force = false): Promise<void> {
    if (!options.allFetcher) return;
    if (allOptionsLoaded && !force) return;
    isLoadingAll.value = true;
    try {
      allOptions.value = await options.allFetcher();
      allOptionsLoaded = true;
    } finally {
      isLoadingAll.value = false;
    }
  }

  function invalidateAllOptions(): void {
    allOptionsLoaded = false;
  }

  function setPage(page: number): Promise<void> {
    currentPage.value = page;
    return fetchPage();
  }

  function setPageSize(size: number): Promise<void> {
    pageSize.value = size;
    currentPage.value = 1;
    return fetchPage();
  }

  function setFilters(patch: Partial<F>): Promise<void> {
    filters.value = { ...filters.value, ...patch };
    currentPage.value = 1;
    return fetchPage();
  }

  /**
   * 切換排序欄位；同欄位再次呼叫切換 asc/desc，新欄位預設 asc
   */
  function setSort(by: string): Promise<void> {
    if (sort.value && sort.value.by === by) {
      sort.value = { by, order: sort.value.order === 'asc' ? 'desc' : 'asc' };
    } else {
      sort.value = { by, order: 'asc' };
    }
    currentPage.value = 1;
    return fetchPage();
  }

  function resetFilters(): Promise<void> {
    filters.value = { ...options.initialFilters };
    sort.value = options.initialSort ?? null;
    currentPage.value = 1;
    return fetchPage();
  }

  return {
    // 分頁清單輸出
    items,
    total,
    currentPage,
    pageSize,
    totalPages,
    isLoading,
    filters,
    sort,
    startIndex,
    endIndex,
    // 全量輸出（取代雙重狀態）
    allOptions,
    isLoadingAll,
    // 操作
    fetchPage,
    fetchAllOptions,
    invalidateAllOptions,
    setPage,
    setPageSize,
    setFilters,
    setSort,
    resetFilters,
  };
}
