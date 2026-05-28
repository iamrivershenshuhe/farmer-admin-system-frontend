/**
 * 使用者相關型別定義
 *
 * 對齊 v1.2 API 契約 (api-spec.md §3.1, §3.4)；
 * 後端 response 同時提供 v1 別名 (`username` / `department`) 與 v1.2 canonical 欄位
 * (`employeeId` / `departmentId` / `departmentName`)，避免破壞既有頁面。
 */

export type UserRole = 'admin' | 'manager' | 'user';

/**
 * 使用者資訊介面
 */
export interface UserInfo {
  id: string;
  /**
   * v1 別名 = `employeeId`；v2.0 將廢棄。
   * v1.2 後端 response 同時提供 `username` 與 `employeeId`，值相同。
   * @deprecated 改用 {@link employeeId}；v2.0 將移除。
   */
  username: string;
  /**
   * 員工編號（v1.2 canonical，對齊 DB `staff.employee_id`）。
   * 格式 `^[A-Z0-9]{3,20}$`；v1.2 後端同時提供 `username` 為兼容別名。
   */
  employeeId?: string;
  name?: string; // 真實姓名(可選)
  role: UserRole;
  /**
   * v1 別名 = `departmentId`，呈 UUID（後端 [TSD-04 §10] 已對齊；非顯示用名稱）。
   * 為兼容既有 mock / 顯示元件，型別保留 `string`；admin 角色將以空字串呈現。
   * @deprecated 改用 {@link departmentId} 與 {@link departmentName}；v2.0 將移除。
   */
  department: string;
  /**
   * 所屬部門 ID（v1.2 canonical）。
   * admin 角色為 `null`（系統全域；後端 DB `department_id IS NULL`）。
   */
  departmentId: string | null;
  /**
   * 部門名稱（顯示用，後端 JOIN 動態欄位；admin 角色為空字串或 undefined）。
   * v1.2 後端在 `/auth/me` / `/staff` response 一併提供。
   */
  departmentName?: string;
  businessTypeIds?: string[]; // 負責的業務別 ID 清單（決定作業手冊/申請表單可見範圍）
  mustChangePassword?: boolean; // 是否需要修改密碼（首次登入或密碼被重置）
  email?: string | null; // Email(預留擴展，未來可啟用)
  phone?: string | null; // 電話(可選)
  active?: boolean; // 帳號是否啟用
  createdAt?: string; // 建立時間 (ISO 8601 UTC)
  updatedAt?: string; // 更新時間 (ISO 8601 UTC)
  lastLoginAt?: string | null; // 最後登入時間 (ISO 8601 UTC)
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '系統管理員',
  manager: '部門主管',
  user: '一般員工',
};
