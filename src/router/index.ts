import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import AuthLayout from '@/layout/AuthLayout.vue';
import AppLayout from '@/layout/index.vue';
import type { ModuleType } from '@/types';

import { setupAuthGuard } from './guard';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    requiresAuth?: boolean;
    activeModule?: ModuleType;
  }
}

const routes: RouteRecordRaw[] = [
  // 登入路由（使用 AuthLayout）
  {
    path: '/login',
    component: AuthLayout,
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('@/views/auth/index.vue'),
        meta: {
          title: '登入',
        },
      },
    ],
  },
  // 修改密碼路由（使用 AuthLayout）
  {
    path: '/change-password',
    component: AuthLayout,
    children: [
      {
        path: '',
        name: 'change-password',
        component: () => import('@/views/auth/ChangePassword.vue'),
        meta: {
          title: '修改密碼',
          requiresAuth: true,
        },
      },
    ],
  },
  // 忘記密碼路由（使用 AuthLayout）
  {
    path: '/forgot-password',
    component: AuthLayout,
    children: [
      {
        path: '',
        name: 'forgot-password',
        component: () => import('@/views/auth/ForgotPassword.vue'),
        meta: {
          title: '忘記密碼',
        },
      },
    ],
  },
  // 主應用路由（使用 AppLayout）
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        redirect: '/chat',
      },
      {
        path: 'chat/search',
        name: 'chat-search',
        component: () => import('@/views/chat/search/index.vue'),
        meta: {
          title: '搜尋對話',
          activeModule: 'search-conversation',
          requiresAuth: true,
        },
      },
      {
        path: 'chat/:id?',
        name: 'chat',
        component: () => import('@/views/chat/index.vue'),
        meta: {
          title: 'AI 聊天',
          activeModule: 'new-chat',
          requiresAuth: true,
        },
      },
      {
        path: 'knowledge-base',
        name: 'knowledge-base',
        component: () => import('@/views/knowledge-base/index.vue'),
        meta: {
          title: '知識庫',
          activeModule: 'knowledge-base',
          requiresAuth: true,
        },
      },
      {
        path: 'eform',
        name: 'eform',
        component: () => import('@/views/e-form/index.vue'),
        meta: {
          title: '電子表單',
          activeModule: 'eform',
          requiresAuth: true,
        },
      },
      {
        path: 'organization',
        component: () => import('@/views/organization/index.vue'),
        meta: {
          title: '組織管理',
          activeModule: 'organization',
          requiresAuth: true,
        },
        children: [
          {
            path: '',
            redirect: { name: 'organization-departments' },
          },
          {
            path: 'departments',
            name: 'organization-departments',
            component: () => import('@/views/organization/DepartmentsTab.vue'),
            meta: { title: '部門管理', activeModule: 'organization' },
          },
          {
            path: 'staff',
            name: 'organization-staff',
            component: () => import('@/views/organization/StaffTab.vue'),
            meta: { title: '人員管理', activeModule: 'organization' },
          },
          {
            path: 'business-types',
            name: 'organization-business-types',
            component: () => import('@/views/organization/BusinessTypesTab.vue'),
            meta: { title: '業務別管理', activeModule: 'organization' },
          },
        ],
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// 全局導航守衛
router.beforeEach((to, from, next) => {
  // 設定頁面標題
  if (to.meta.title) {
    const matched = to.matched.filter((r) => r.meta?.title);
    if (matched.length >= 2) {
      const parentTitle = matched[matched.length - 2].meta.title as string;
      const childTitle = matched[matched.length - 1].meta.title as string;
      document.title = `${parentTitle}-${childTitle} - Farmer Admin System`;
    } else {
      document.title = `${to.meta.title} - Farmer Admin System`;
    }
  }

  // 認證守衛
  setupAuthGuard(to, from, next);
});

export default router;
