/**
 * 權限配置
 * 定義每個角色可以訪問的路由和功能
 */

import type { UserRole } from '@/types/user';

/**
 * 路由權限配置
 * 定義每個角色可以訪問的路由路徑
 */
export const ROUTE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['/chat', '/knowledge-base', '/eform', '/organization', '/logs'],
  manager: ['/chat', '/knowledge-base', '/eform', '/organization'],
  user: ['/chat', '/knowledge-base', '/eform'],
};

/**
 * 功能權限介面
 * 定義對某個功能的操作權限和資料範圍
 */
export interface FeaturePermission {
  canView: boolean; // 可以查看
  canCreate: boolean; // 可以新增
  canEdit: boolean; // 可以編輯
  canDelete: boolean; // 可以刪除
  canManage: boolean; // 可以管理（包含所有操作）
  scope: 'all' | 'department' | 'self'; // 資料範圍
}

/**
 * 功能權限配置
 * 定義每個功能模組的詳細權限
 */
export const FEATURE_PERMISSIONS: Record<string, Record<UserRole, FeaturePermission>> = {
  // AI 對話
  chat: {
    admin: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManage: true,
      scope: 'all',
    },
    manager: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManage: false,
      scope: 'department',
    },
    user: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManage: false,
      scope: 'department',
    },
  },

  // 知識庫
  'knowledge-base': {
    admin: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManage: true,
      scope: 'all',
    },
    manager: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManage: true,
      scope: 'department',
    },
    user: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManage: false,
      scope: 'department',
    },
  },

  // 電子表單
  eform: {
    admin: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManage: true,
      scope: 'all',
    },
    manager: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManage: true,
      scope: 'department',
    },
    user: {
      canView: true,
      canCreate: true,
      canEdit: false,
      canDelete: false,
      canManage: false,
      scope: 'department',
    },
  },

  // 部門管理
  departments: {
    admin: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManage: true,
      scope: 'all',
    },
    manager: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManage: false,
      scope: 'department',
    },
    user: {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManage: false,
      scope: 'self',
    },
  },

  // 人員管理
  staff: {
    admin: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canManage: true,
      scope: 'all',
    },
    // 依角色表：人員管理 manager 為唯讀（增修/變更角色/重設密碼/指派業務範圍皆 admin only）
    manager: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManage: false,
      scope: 'department',
    },
    user: {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManage: false,
      scope: 'self',
    },
  },

  // 系統日誌
  logs: {
    admin: {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManage: true,
      scope: 'all',
    },
    manager: {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManage: false,
      scope: 'department',
    },
    user: {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManage: false,
      scope: 'self',
    },
  },
};
