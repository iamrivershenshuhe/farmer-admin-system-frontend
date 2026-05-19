/**
 * Mock handler 共用：身分解析 / 分頁 / 排序 / 成功包裝
 * 讓各組 handler 行為一致，鏡像後端契約，使 store 可走 server 驅動薄層。
 */

import type { UserInfo } from '@/types/user';

import { mockUsers } from '../staff';

/**
 * 模擬後端解析 JWT：由 Authorization token 取得呼叫者身分（單一真相源）。
 *
 * token 形如 `mock-access-token.<username>`，回傳 mockUsers 中的「即時」資料
 * （admin 端指派變更後可即時反映）；token 缺失時退回 localStorage 快照。
 * 不檢查 active —— 是否拒絕停用帳號由各 handler 自行決定（行為與原各處一致）。
 */
export function resolvePrincipal(request: Request): UserInfo | null {
  const auth = request.headers.get('Authorization') ?? '';
  const matched = auth.match(/mock-access-token\.([A-Za-z0-9_]+)/);
  if (matched) {
    const user = mockUsers.find((u) => u.username === matched[1]);
    if (user) return user;
  }
  try {
    const raw = localStorage.getItem('user-info');
    if (raw) {
      const parsed = JSON.parse(raw) as { user?: UserInfo };
      if (parsed.user) return parsed.user;
    }
  } catch {
    /* ignore */
  }
  return null;
}

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
