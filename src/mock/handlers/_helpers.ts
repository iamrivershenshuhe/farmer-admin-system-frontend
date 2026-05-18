/**
 * Mock handler 共用：分頁 / 排序 / 成功包裝
 * 讓 departments / staff / business-types 三組 handler 行為一致，
 * 鏡像後端 PaginationResponse 契約，使 store 可走 server 驅動薄層。
 */

export interface PageQuery {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function readPageQuery(url: URL): PageQuery {
  return {
    page: Number(url.searchParams.get('page') ?? 1) || 1,
    pageSize: Number(url.searchParams.get('pageSize') ?? 20) || 20,
    sortBy: url.searchParams.get('sortBy') ?? undefined,
    sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') ?? undefined,
  };
}

export function sortList<T>(list: T[], sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc'): T[] {
  if (!sortBy) return list;
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortBy];
    const bv = (b as Record<string, unknown>)[sortBy];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), 'zh-Hant') * dir;
  });
}

export function paginate<T>(list: T[], page: number, pageSize: number) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: list.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export const ok = (data: unknown, message = 'success') => ({ code: 0, message, data });

export const fail = (code: number, message: string) => ({ code, message, data: null });
