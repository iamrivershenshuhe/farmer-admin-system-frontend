import { useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';
import type { LoginRequest } from '@/types/auth';

/**
 * 登入流程封裝
 *
 * 集中「呼叫登入 → 寫入使用者資訊 → 導向首頁」的編排，
 * 讓視圖只負責 UI 與表單驗證，不直接耦合 auth / user 兩個 store。
 *
 * mustChangePassword（首登強制改密）的導向由路由守衛
 * (`src/router/guard.ts`) 統一攔截，故此處一律導向 /chat，
 * 行為與原 `views/auth/index.vue` 等價。
 */
export function useLogin() {
  const router = useRouter();
  const authStore = useAuthStore();
  const userStore = useUserStore();

  /**
   * 執行登入
   *
   * @returns 成功回傳 true；失敗回傳可讀錯誤訊息字串
   */
  const login = async (credentials: LoginRequest): Promise<true | string> => {
    try {
      const response = await authStore.login(credentials);
      userStore.setUser(response.user);
      router.push('/chat');
      return true;
    } catch (error) {
      return error instanceof Error ? error.message : '登入失敗，請稍後再試';
    }
  };

  return { login };
}
