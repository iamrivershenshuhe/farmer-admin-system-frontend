/**
 * API 配置
 */

// API 基礎 URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// API 超時時間 (毫秒)
export const API_TIMEOUT = 10000;

// API 版本
export const API_VERSION = 'v1';

// 完整 API URL
export const getApiUrl = (path: string): string => {
  return `${API_BASE_URL}/${API_VERSION}${path}`;
};

/**
 * 將後端回傳的（多為 root-relative，如 `/api/v1/...`）資源路徑解析為可直接 fetch 的 URL。
 *
 * 後端的 `fileUrl`（簽章下載連結）是 root-relative；正式環境前後端同源時可直接 fetch，
 * 但開發環境前端 (:5173) 與後端 (:8000) 不同源，相對路徑會落到 vite SPA 而非後端。
 * 故當 `API_BASE_URL` 為絕對 URL 時，將資源路徑解析至其 origin；已是絕對或同源相對則原樣返回。
 */
export const resolveApiUrl = (pathOrUrl: string): string => {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (/^https?:\/\//i.test(API_BASE_URL)) return new URL(pathOrUrl, API_BASE_URL).href;
  return pathOrUrl;
};
