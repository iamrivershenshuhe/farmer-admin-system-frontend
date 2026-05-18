/**
 * 部門相關型別定義
 */

/**
 * 部門資訊
 */
export interface Department {
  id: string; // 部門 ID（系統主鍵，後端產生）
  code: string; // 部門代碼（admin 自訂業務識別碼，後端唯一校驗）
  name: string; // 部門名稱
  managerName?: string | null; // 部門主管姓名（未指派＝null）
  memberCount: number; // 員工人數
  knowledgeBaseCount?: number; // 知識庫文件數量
  active: boolean; // 是否啟用（停用＝軟刪除，可逆）
  createdAt: string; // 建立時間
  updatedAt?: string; // 更新時間
}

/**
 * 新增/編輯部門請求
 */
export interface DepartmentFormData {
  code: string;
  name: string;
  managerName?: string | null;
  active: boolean;
}

// 業務別型別已拆至 types/business-type.ts；此處 re-export 維持既有 import 相容
export type {
  BusinessType,
  CreateBusinessTypePayload,
  UpdateBusinessTypePayload,
} from './business-type';
