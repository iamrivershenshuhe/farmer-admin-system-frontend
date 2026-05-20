/**
 * 人員管理相關型別定義
 *
 * 人員實體沿用 types/user.ts 的 UserInfo；此檔集中 staff 模組語意入口，
 * 並補充帳號生命週期專屬 payload（停用/啟用、批次）。
 */

export type { UserInfo, UserRole } from './user';
export { ROLE_LABELS } from './user';

/**
 * 設定帳號啟用狀態（停用＝軟刪除，可逆）
 */
export interface SetStaffActivePayload {
  active: boolean;
}

/**
 * 批次操作
 */
export interface BatchStaffPayload {
  ids: string[];
}
