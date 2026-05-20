/**
 * HTTP 請求客戶端
 * 統一封裝 axios，提供請求 / 回應攔截器
 *
 * 功能：
 *  - 自動附加 Bearer Token
 *  - 業務碼（code !== 0）攔截，統一 reject
 *  - HTTP 4xx / 5xx 錯誤分類處理
 *  - 401 自動清除 Token 並跳轉登入頁
 *  - DEV 環境才輸出 console.error（生產環境靜默）
 */

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import { API_BASE_URL, API_VERSION } from '@/config';
import type { ApiResponse } from '@/types';
import { ApiError } from '@/types/api';

class HttpClient {
  private instance: AxiosInstance;

  /**
   * 401 處理競態鎖（單例 promise）：並發請求同時收到 401 時，
   * 僅第一個建立 promise；其餘共享同一 promise 不重觸發。
   * 完成（成功或失敗）後置回 null，下次 401 才會再次處理。
   */
  private sessionExpiryPromise: Promise<void> | null = null;

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
        const token = localStorage.getItem('auth_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // ── 回應攔截器：業務碼與 HTTP 錯誤分流處理 ────────────────────────
    this.instance.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        const { data } = response;

        // 業務碼非 0 視為業務層錯誤（HTTP 本身可能是 2xx）
        if (data.code !== 0) {
          if (import.meta.env.DEV) {
            console.error(`[API 業務錯誤] code=${data.code}`, data.message);
          }
          // 拋出型別化錯誤；ApiError extends Error，向後相容 (error instanceof Error / error.message)
          return Promise.reject(
            new ApiError({
              httpStatus: response.status ?? null,
              code: data.code,
              message: data.message || '請求失敗',
            })
          );
        }

        return response;
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
   * 根據 HTTP 狀態碼分類處理錯誤
   * DEV 環境才輸出 console.error；生產環境由上層 UI 處理通知
   */
  private handleHttpError(status: number): void {
    switch (status) {
      case 401:
        // Token 無效或過期：清除憑證並導向登入頁。
        // 單例 promise 鎖：並發 401 共享同一作業，避免重複清除與重複跳轉。
        if (this.sessionExpiryPromise) {
          break;
        }
        // 先清 Pinia 狀態（持久化外掛會連動寫回 storage），再顯式清 localStorage 作雙保險；
        // 全程 lazy import 避免與 store / router 形成循環依賴。
        this.sessionExpiryPromise = (async () => {
          const [{ useAuthStore }, { useUserStore }, { default: router }] = await Promise.all([
            import('@/stores/auth'),
            import('@/stores/user'),
            import('@/router'),
          ]);
          useAuthStore().clearToken();
          useUserStore().clearUser();
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user-info');
          await router.push('/login');
        })().finally(() => {
          this.sessionExpiryPromise = null;
        });
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
