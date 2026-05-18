/**
 * 業務別相關型別定義
 *
 * 由 types/department.ts 拆出（業務別已獨立為組織管理第三 tab）。
 * department.ts 仍 re-export 以維持既有 import 相容。
 */

/**
 * 業務別
 */
export interface BusinessType {
  id: string;
  /** 所屬部門 ID（必屬一個部門，無「未歸屬」狀態） */
  departmentId: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface CreateBusinessTypePayload {
  name: string;
  description?: string;
  active?: boolean;
  /** 必填：業務別必屬一個部門 */
  departmentId: string;
}

export interface UpdateBusinessTypePayload {
  name?: string;
  description?: string;
  active?: boolean;
  /** 可變更所屬部門（仍須為某部門） */
  departmentId?: string;
}
