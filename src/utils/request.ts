/**
 * HTTP 請求客戶端
 * 統一封裝 axios，提供請求 / 回應攔截器
 *
 * 功能：
 *  - 自動附加 Bearer Token（除非 header 帶 `X-Skip-Auth: 1`）
 *  - 業務碼（code !== 0）攔截，統一 reject
 *  - HTTP 4xx / 5xx 錯誤分類處理
 *  - 業務碼 10003 (TOKEN_EXPIRED) / 10004 (TOKEN_REFRESH_FAILED) 自動刷新流程
 *    - 10003 → POST /auth/refresh → 用新 access token 重試原請求一次
 *    - 10004 → 清除憑證並跳 /login（refresh 失敗）
 *    - 並發 dedupe：多個請求同時拿到 10003 共享同一 in-flight refresh，皆於完成後重試一次
 *  - 401 自動清除 Token 並跳轉登入頁（傳輸層 fallback；後端契約應一律 HTTP 200）
 *  - DEV 環境才輸出 console.error（生產環境靜默）
 *
 * 對齊 v1.2 spec：
 *  - response-envelope.md §1（HTTP layer 通用規約：code===0 唯一成功）
 *  - error-codes.md §3（10003 / 10004 前端建議處理）
 *  - api-spec.md §3.1.5 (POST /auth/refresh — rotation 強制)
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import { API_BASE_URL, API_VERSION } from '@/config';
import type { ApiResponse } from '@/types';
import { ApiError, ApiErrorCode } from '@/types/api';

/**
 * Storage keys for tokens. 與 `stores/auth.ts` persisted state 對齊。
 * pinia-plugin-persistedstate 將 `accessToken` 序列為 `{ accessToken: "..." }`
 * 寫入 key=`auth_token`；`refreshToken` 另存 key=`refresh_token`（純字串）。
 */
const TOKEN_STORAGE_KEY = 'auth_token';
const REFRESH_TOKEN_STORAGE_KEY = 'refresh_token';

/**
 * 從 localStorage 讀 access token。
 * 同時兼容 pinia-plugin-persistedstate 的 JSON 結構與裸字串（舊行為）。
 */
function readAccessToken(): string | null {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  // pinia-plugin-persistedstate 序列化為 JSON 物件
  try {
    const parsed = JSON.parse(raw) as { accessToken?: string } | string;
    if (typeof parsed === 'string') return parsed;
    return parsed.accessToken ?? null;
  } catch {
    return raw; // 裸字串（舊行為）
  }
}

/** 寫入 access token（覆寫既有 JSON 結構，保留 pinia 持久化兼容） */
function writeAccessToken(token: string): void {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  let payload: Record<string, unknown> = { accessToken: token };
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        payload = { ...parsed, accessToken: token };
      }
    } catch {
      /* 裸字串覆寫即可 */
    }
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(payload));
}

/** 讀 refresh token（純字串） */
function readRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

/** 寫入 refresh token */
function writeRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
}

class HttpClient {
  private instance: AxiosInstance;

  /**
   * 401 處理競態鎖（單例 promise）：並發請求同時收到 401 時，
   * 僅第一個建立 promise；其餘共享同一 promise 不重觸發。
   * 完成（成功或失敗）後置回 null，下次 401 才會再次處理。
   */
  private sessionExpiryPromise: Promise<void> | null = null;

  /**
   * 10003 處理競態鎖：多個請求同時拿到 TOKEN_EXPIRED 共享同一 refresh promise。
   * 成功 → 全部請求以新 token 重試一次（_retryCount 旗標避免無限循環）。
   * 失敗 → 觸發登出流程（同 401 路徑）。
   */
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.instance = axios.create({
      // 含版本前綴：http://localhost:3000/api/v1
      baseURL: `${API_BASE_URL}/${API_VERSION}`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * 設置請求 / 回應攔截器
   */
  private setupInterceptors(): void {
    // ── 請求攔截器：自動附加 Authorization header ────────────────────
    this.instance.interceptors.request.use(
      (config) => {
        // 顯式跳過附 Bearer（refresh 端點專用）：刪除旗標 header，不送到後端
        const skipAuth = config.headers?.get?.('X-Skip-Auth') === '1';
        if (config.headers) {
          // axios v1 headers 支援 has/delete；保留 try/catch 兼容測試環境
          try {
            config.headers.delete?.('X-Skip-Auth');
          } catch {
            /* ignore */
          }
        }

        if (!skipAuth) {
          const token = readAccessToken();
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // ── 回應攔截器：業務碼與 HTTP 錯誤分流處理 ────────────────────────
    this.instance.interceptors.response.use(
      async (response: AxiosResponse<ApiResponse>) => {
        const { data } = response;

        // 業務成功
        if (data.code === 0) {
          return response;
        }

        // 10003 TOKEN_EXPIRED → 嘗試 refresh → 重試原請求一次
        if (data.code === ApiErrorCode.TOKEN_EXPIRED) {
          const originalConfig = response.config as AxiosRequestConfig & {
            _refreshRetried?: boolean;
          };
          // 已重試過一次仍 10003，視為 refresh 後 access 仍無效；降級為登出。
          if (originalConfig._refreshRetried) {
            await this.handleSessionExpiry();
            return Promise.reject(
              new ApiError({
                httpStatus: response.status ?? null,
                code: data.code,
                message: data.message || 'Access token expired',
              })
            );
          }
          try {
            const newAccessToken = await this.ensureRefreshed();
            originalConfig._refreshRetried = true;
            // 顯式覆寫 Authorization（攔截器會再讀一次 localStorage）
            originalConfig.headers = {
              ...(originalConfig.headers ?? {}),
              Authorization: `Bearer ${newAccessToken}`,
            };
            return this.instance.request(originalConfig);
          } catch (refreshErr) {
            // refresh 失敗：清憑證 + 跳登入；reject 原 10003
            await this.handleSessionExpiry();
            return Promise.reject(refreshErr);
          }
        }

        // 10004 TOKEN_REFRESH_FAILED → refresh 端點本身拒；清憑證並跳 /login
        if (data.code === ApiErrorCode.TOKEN_REFRESH_FAILED) {
          await this.handleSessionExpiry();
          return Promise.reject(
            new ApiError({
              httpStatus: response.status ?? null,
              code: data.code,
              message: data.message || 'Refresh failed',
            })
          );
        }

        // 其他業務碼：照舊 reject 為 ApiError
        if (import.meta.env.DEV) {
          console.error(`[API 業務錯誤] code=${data.code}`, data.message);
        }
        return Promise.reject(
          new ApiError({
            httpStatus: response.status ?? null,
            code: data.code,
            message: data.message || '請求失敗',
          })
        );
      },
      (error) => {
        if (error.response) {
          // 伺服器有回應，但為 4xx / 5xx
          const { status } = error.response;
          this.handleHttpError(status);
        } else if (error.request) {
          // 請求已送出但無回應（多半是 MSW worker 啟動 race 或網路抖動）
          // 自動重試 1 次，200ms 延遲後重發；以 _retryCount 旗標避免無限循環
          const config = error.config as
            | (AxiosRequestConfig & { _retryCount?: number })
            | undefined;
          if (config && (config._retryCount ?? 0) < 1) {
            config._retryCount = (config._retryCount ?? 0) + 1;
            return new Promise((resolve) => {
              setTimeout(() => resolve(this.instance.request(config)), 200);
            });
          }
          if (import.meta.env.DEV) {
            console.error('[API 網路錯誤] 重試後仍未收到回應，請檢查網路連線');
          }
        } else {
          // axios 設定階段即發生錯誤
          if (import.meta.env.DEV) {
            console.error('[API 設定錯誤]', error.message);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * 確保 refresh 流程僅有一個 in-flight；並發 10003 共享同一 promise。
   *
   * 成功 → 回傳新 access token、寫回 storage 與 store；
   * 失敗 → 觸發登出（呼叫端 catch 後不再重試）。
   */
  private async ensureRefreshed(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  /**
   * 實際呼叫 `/auth/refresh`：
   *  - 帶 X-Skip-Auth 旗標，避免攔截器附過期的 Authorization
   *  - 用 axios 直接送（**不** 走 httpClient.post 以避免迴遞攔截器邏輯）
   *  - 成功時寫回 localStorage + 更新 Pinia auth store（lazy import 避免循環依賴）
   */
  private async doRefresh(): Promise<string> {
    const refreshToken = readRefreshToken();
    if (!refreshToken) {
      throw new ApiError({
        httpStatus: null,
        code: ApiErrorCode.TOKEN_REFRESH_FAILED,
        message: 'No refresh token available',
      });
    }

    let response: AxiosResponse<ApiResponse<{ accessToken: string; refreshToken: string }>>;
    try {
      response = await axios.post(
        `${API_BASE_URL}/${API_VERSION}/auth/refresh`,
        { refreshToken },
        {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (networkErr) {
      throw new ApiError({
        httpStatus: null,
        code: ApiErrorCode.TOKEN_REFRESH_FAILED,
        message: 'Refresh request failed (network)',
        origin: networkErr,
      });
    }

    const env = response.data;
    if (env.code !== 0 || !env.data?.accessToken || !env.data?.refreshToken) {
      throw new ApiError({
        httpStatus: response.status ?? null,
        code: env.code ?? ApiErrorCode.TOKEN_REFRESH_FAILED,
        message: env.message || 'Refresh failed',
      });
    }

    const newAccess = env.data.accessToken;
    const newRefresh = env.data.refreshToken;

    // 持久化新 tokens；store 端可在背景 setToken 同步狀態
    writeAccessToken(newAccess);
    writeRefreshToken(newRefresh);

    // 同步 Pinia store（lazy import 避免循環依賴）
    try {
      const { useAuthStore } = await import('@/stores/auth');
      useAuthStore().setToken(newAccess, newRefresh);
    } catch {
      /* store 初始化前；persistedstate 已寫回 storage，下次 init 會讀到 */
    }

    return newAccess;
  }

  /**
   * 共用「session 失效」處理：清憑證 + 跳登入。
   * 為單例（同 401 路徑），並發保證僅執行一次。
   */
  private async handleSessionExpiry(): Promise<void> {
    if (this.sessionExpiryPromise) {
      return this.sessionExpiryPromise;
    }
    this.sessionExpiryPromise = (async () => {
      const [{ useAuthStore }, { useUserStore }, { default: router }] = await Promise.all([
        import('@/stores/auth'),
        import('@/stores/user'),
        import('@/router'),
      ]);
      useAuthStore().clearToken();
      useUserStore().clearUser();
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      localStorage.removeItem('user-info');
      await router.push('/login');
    })().finally(() => {
      this.sessionExpiryPromise = null;
    });
    return this.sessionExpiryPromise;
  }

  /**
   * 根據 HTTP 狀態碼分類處理錯誤
   * DEV 環境才輸出 console.error；生產環境由上層 UI 處理通知
   */
  private handleHttpError(status: number): void {
    switch (status) {
      case 401:
        // Token 無效或過期：清除憑證並導向登入頁。
        // 後端 v1.2 業務錯誤應走 HTTP 200 + code=10001/10003/10004；此處為傳輸層 fallback。
        void this.handleSessionExpiry();
        break;

      case 403:
        if (import.meta.env.DEV) {
          console.error('[API 403] 無權限存取此資源');
        }
        break;

      case 404:
        if (import.meta.env.DEV) {
          console.error('[API 404] 請求的資源不存在');
        }
        break;

      case 500:
        if (import.meta.env.DEV) {
          console.error('[API 500] 伺服器內部錯誤');
        }
        break;

      default:
        if (import.meta.env.DEV) {
          console.error(`[API ${status}] 請求失敗`);
        }
    }
  }

  /**
   * GET 請求
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  /**
   * POST 請求
   */
  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * PUT 請求（整體替換）
   */
  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  /**
   * DELETE 請求
   */
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.delete<ApiResponse<T>>(url, config);
    return response.data;
  }

  /**
   * PATCH 請求（部分更新）
   */
  async patch<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }
}

// 全域單例，統一使用此實例發送請求
export const httpClient = new HttpClient();
