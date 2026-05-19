/**
 * 路由守衛
 * 負責攔截未登入使用者，保護需要認證的路由
 * 檢查是否需要強制修改密碼
 * 檢查使用者是否有權限訪問路由
 */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router';

import { ROUTE_PERMISSIONS } from '@/config/permissions';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';

/**
 * 全域前置守衛
 * 處理認證檢查、密碼修改檢查和權限檢查
 */
export const setupAuthGuard = async (
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  const authStore = useAuthStore();
  const userStore = useUserStore();
  const isAuthenticated = authStore.isAuthenticated;

  // 定義不需要認證的路由
  const publicRoutes = ['/login', '/forgot-password'];
  const isPublicRoute = publicRoutes.includes(to.path);

  // 如果是公開路由
  if (isPublicRoute) {
    // 已登入用戶訪問登入頁，檢查是否需要修改密碼
    if (isAuthenticated && to.path === '/login') {
      const mustChangePassword = userStore.user?.mustChangePassword || false;
      if (mustChangePassword) {
        next('/change-password');
      } else {
        next('/chat');
      }
    } else {
      next();
    }
    return;
  }

  // 如果是受保護路由
  if (!isAuthenticated) {
    // 未登入用戶，重定向到登入頁
    next('/login');
    return;
  }

  // 單一真相源同步：每次已登入導航向後端拉取即時身分，
  // 使 admin 端的角色 / 部門 / 業務別指派變更免重新登入即生效。
  // 失敗（token 失效 / 後端不可用）視為登出。
  try {
    await userStore.fetchCurrentUser();
  } catch {
    authStore.clearToken();
    userStore.clearUser();
    next('/login');
    return;
  }

  // 已登入用戶，檢查是否需要修改密碼
  const mustChangePassword = userStore.user?.mustChangePassword || false;

  // 如果需要修改密碼，且當前不在修改密碼頁面
  if (mustChangePassword && to.path !== '/change-password') {
    next('/change-password');
    return;
  }

  // 權限檢查（修改密碼頁面不需要檢查權限）
  if (to.path !== '/change-password') {
    const userRole = userStore.user?.role;
    if (userRole) {
      const allowedRoutes = ROUTE_PERMISSIONS[userRole] || [];
      const hasPermission = allowedRoutes.some(
        (route) => to.path === route || to.path.startsWith(route + '/')
      );

      if (!hasPermission) {
        // 無權限，跳轉到首頁
        console.warn(
          `[Guard] 使用者 ${userStore.user?.username} (角色: ${userRole}) 無權限訪問 ${to.path}。允許路由:`,
          allowedRoutes
        );
        next('/chat');
        return;
      }
    } else {
      console.warn('[Guard] 使用者角色不明，重新導向登入頁');
      next('/login');
      return;
    }
  }

  // 允許訪問
  next();
};
