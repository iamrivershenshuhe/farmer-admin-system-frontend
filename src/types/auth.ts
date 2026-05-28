/**
 * 認證相關型別定義
 *
 * 對齊 v1.2 API 契約 (api-spec.md §3.1)。
 */

import type { UserInfo } from './user';

/**
 * 登入請求參數。
 *
 * v1.2 後端同時接受 `username` 與 `employeeId`；v2.0 將統一為 `employeeId`。
 * 任一欄位至少必填一個；同時提供時以 `employeeId` 為準。
 */
export interface LoginRequest {
  /**
   * @deprecated v1 別名 = `employeeId`；v2.0 將移除。v1.2 後端兩者皆接受。
   */
  username?: string;
  /** 員工編號，格式 `^[A-Z0-9]{3,20}$` (v1.2 canonical) */
  employeeId?: string;
  password: string;
}

/**
 * 登入回應 (api-spec §3.1.1)
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: UserInfo;
  mustChangePassword: boolean; // 是否需要強制修改密碼（首次登入或管理員重置後）
}

/**
 * Token 資訊（前端本地保存用）。
 */
export interface TokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

/**
 * Refresh Token 請求 (POST /auth/refresh)
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Refresh Token 回應 (POST /auth/refresh)
 *
 * v1.2 起 rotation 強制：每次 refresh 必更新 refreshToken；前端必須以新值覆寫 storage。
 */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * 登出請求 (POST /auth/logout)
 *
 * Body 帶 refreshToken，後端撤銷指定 refresh row；access token 自然到期。
 */
export interface LogoutRequest {
  refreshToken?: string;
}

/**
 * 修改密碼請求
 */
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

/**
 * 修改密碼回應
 *
 * v1.2 後端在改密成功後可一併簽發新的 access token（密碼變更觸發 JWT 撤銷 /
 * watermark 輪替），前端須以新值覆寫，確保 session 不被舊 token 立即失效。
 */
export interface ChangePasswordResponse {
  success: boolean;
  message: string;
  /** 後端輪替後的新 access token（存在時前端應立即 setToken 覆寫）。 */
  accessToken?: string;
}
