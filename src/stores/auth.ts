import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { authApi } from '@/api';
import type { ChangePasswordResponse, LoginRequest, LoginResponse } from '@/types/auth';

/**
 * 認證狀態管理
 *
 * 對齊 v1.2 API 契約 (api-spec.md §3.1)：
 *  - 持有 access + refresh token 雙憑證（v1.2 起 refresh 強制 rotation）
 *  - `setToken` 接受 access / refresh 兩參數（refresh 可選；舊呼叫只傳 access 仍兼容）
 *  - `logout` 呼叫後端 `/auth/logout` 撤銷 refresh，再清本地狀態
 *    後端不可用時 soft-fail 仍清本地狀態（不卡死使用者）
 */
export const useAuthStore = defineStore(
  'auth',
  () => {
    // State
    const accessToken = ref<string | null>(null);
    /**
     * Refresh token：v1.2 起後端強制提供；前端持久化用於 `POST /auth/refresh`。
     * 為兼容舊版（無 refresh 流程），仍允許 null。
     */
    const refreshToken = ref<string | null>(null);
    const isLoggingIn = ref(false);

    // Getters
    const isAuthenticated = computed(() => !!accessToken.value);

    // Actions
    /**
     * 設定 Token（重載：仅 access 或 access + refresh）
     */
    const setToken = (access: string, refresh?: string): void => {
      accessToken.value = access;
      if (refresh !== undefined) {
        refreshToken.value = refresh;
        // 同步寫 storage（utils/request.ts 的 refresh interceptor 由此讀取）
        try {
          localStorage.setItem('refresh_token', refresh);
        } catch {
          /* storage unavailable */
        }
      }
    };

    /**
     * 清除 Token
     */
    const clearToken = (): void => {
      accessToken.value = null;
      refreshToken.value = null;
      try {
        localStorage.removeItem('refresh_token');
      } catch {
        /* storage unavailable */
      }
    };

    /**
     * 登入
     */
    const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
      isLoggingIn.value = true;

      try {
        const res = await authApi.login(credentials);
        const { data } = res;
        // v1.2 後端在登入回應同時提供 access + refresh；refresh 為選填以兼容 mock
        setToken(data.accessToken, data.refreshToken);
        return data;
      } finally {
        isLoggingIn.value = false;
      }
    };

    /**
     * 登出（呼叫後端撤銷 refresh，再清本地狀態）
     *
     * 後端任 4xx / 5xx 視為 soft-fail：仍清憑證避免使用者卡死。
     * 跳轉至 `/login` 由呼叫端（UserMenu / 路由守衛）負責，本 action 僅負責狀態清理。
     */
    const logout = async (): Promise<void> => {
      const refresh = refreshToken.value;
      try {
        if (refresh) {
          await authApi.logout({ refreshToken: refresh });
        } else {
          await authApi.logout();
        }
      } catch {
        /* soft-fail：後端不可用仍清本地狀態 */
      } finally {
        clearToken();
      }
    };

    /**
     * 修改密碼
     */
    const changePassword = async (
      oldPassword: string,
      newPassword: string
    ): Promise<ChangePasswordResponse> => {
      isLoggingIn.value = true;

      try {
        const res = await authApi.changePassword({ oldPassword, newPassword });
        return res.data;
      } finally {
        isLoggingIn.value = false;
      }
    };

    return {
      // State
      accessToken,
      refreshToken,
      isLoggingIn,
      // Getters
      isAuthenticated,
      // Actions
      setToken,
      clearToken,
      login,
      logout,
      changePassword,
    };
  },
  {
    persist: {
      key: 'auth_token',
      // 只持久化 accessToken；refreshToken 另由 `localStorage.refresh_token` 管理（utils/request.ts）
      pick: ['accessToken'],
    },
  }
);
