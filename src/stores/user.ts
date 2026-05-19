import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { authApi } from '@/api';
import type { UserInfo } from '@/types/user';
import { ROLE_LABELS } from '@/types/user';

/**
 * 用戶資訊狀態管理
 * 專注於管理用戶個人資料
 */
export const useUserStore = defineStore(
  'user',
  () => {
    // State
    const user = ref<UserInfo | null>(null);

    // Getters
    const userName = computed(() => user.value?.name || '');
    const userRole = computed(() => {
      return user.value?.role ? ROLE_LABELS[user.value.role] : '';
    });
    const userDepartment = computed(() => user.value?.department || '');
    const userDepartmentId = computed(() => user.value?.departmentId ?? null);
    const userBusinessTypeIds = computed(() => user.value?.businessTypeIds ?? []);

    // Actions
    /**
     * 設定用戶資訊
     */
    const setUser = (userInfo: UserInfo): void => {
      user.value = userInfo;
    };

    /**
     * 清除用戶資訊
     */
    const clearUser = (): void => {
      user.value = null;
    };

    /**
     * 清除「強制修改密碼」旗標
     * 改密成功後呼叫，讓路由守衛不再攔截導向 /change-password
     */
    const clearMustChangePassword = (): void => {
      if (user.value) {
        user.value = { ...user.value, mustChangePassword: false };
      }
    };

    /**
     * 從後端拉取當前登入者即時身分並覆寫本地狀態。
     *
     * 作為使用者範圍的單一真相源同步點：由路由守衛在每次已登入導航時呼叫，
     * 使 admin 端的角色 / 部門 / 業務別指派變更免重新登入即生效。
     * 失敗時拋出，由呼叫端（守衛）決定登出導向。
     */
    const fetchCurrentUser = async (): Promise<UserInfo> => {
      const res = await authApi.getCurrentUser();
      user.value = res.data;
      return res.data;
    };

    return {
      // State
      user,
      // Getters
      userName,
      userRole,
      userDepartment,
      userDepartmentId,
      userBusinessTypeIds,
      // Actions
      setUser,
      clearUser,
      clearMustChangePassword,
      fetchCurrentUser,
    };
  },
  {
    persist: {
      key: 'user-info',
      pick: ['user'],
    },
  }
);
