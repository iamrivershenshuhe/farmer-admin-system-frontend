/**
 * 認證相關 API
 *
 * 此層為薄轉發：僅組裝請求、回傳業務型別（ApiResponse<T>），
 * 業務碼 / HTTP 錯誤分流由 `utils/request.ts` 攔截器處理。
 *
 * 對齊 v1.2 API 契約 (api-spec.md §3.1)：
 *  - `POST /auth/login` / `GET /auth/me` / `POST /auth/change-password` (既有)
 *  - `POST /auth/refresh` — Refresh token rotation；v1.2 後端強制覆寫舊 refresh row
 *  - `POST /auth/logout` — 撤銷使用者所有 refresh tokens；access token 自然到期
 */

import type { ApiResponse } from '@/types/api';
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
} from '@/types/auth';
import type { UserInfo } from '@/types/user';
import { httpClient } from '@/utils/request';

/**
 * 登入 (POST /auth/login)
 */
export const login = (data: LoginRequest): Promise<ApiResponse<LoginResponse>> =>
  httpClient.post<LoginResponse>('/auth/login', data);

/**
 * 取得當前登入者即時身分 (GET /auth/me)
 *
 * 後端依 token 回傳最新使用者資料（含 role / departmentId / businessTypeIds）。
 * 前端據此同步單一真相源，使 admin 端的指派變更免重新登入即可生效。
 */
export const getCurrentUser = (): Promise<ApiResponse<UserInfo>> =>
  httpClient.get<UserInfo>('/auth/me');

/**
 * 修改密碼 (POST /auth/change-password)
 */
export const changePassword = (
  data: ChangePasswordRequest
): Promise<ApiResponse<ChangePasswordResponse>> =>
  httpClient.post<ChangePasswordResponse>('/auth/change-password', data);

/**
 * Refresh Token (POST /auth/refresh)
 *
 * v1.2 起後端強制 rotation：回傳新 access + 新 refresh；前端必須以新值覆寫 storage。
 * 失敗時後端回 `code: 10003 (TOKEN_EXPIRED)` 或 `code: 10004 (TOKEN_REFRESH_FAILED)`，
 * 前端攔截器接到後者應清除憑證並跳 `/login`。
 *
 * 不附帶 Authorization header（後端不需 Bearer，refresh 由 body 攜帶）。
 */
export const refreshToken = (
  data: RefreshTokenRequest
): Promise<ApiResponse<RefreshTokenResponse>> =>
  httpClient.post<RefreshTokenResponse>('/auth/refresh', data, {
    // 顯式避免攔截器附加過期的 Authorization；refresh body 自帶認證。
    // utils/request.ts 攔截器讀 localStorage('auth_token') 附 Bearer，
    // 但此端點不需 Bearer；以 `_skipAuth` 旗標通知攔截器跳過附 header。
    headers: { 'X-Skip-Auth': '1' },
  });

/**
 * 登出 (POST /auth/logout)
 *
 * 後端撤銷該 user 所有 refresh tokens；access token 自然到期。
 * Body 帶 refreshToken（後端僅作為 audit 來源，並不影響 access token 撤銷流程）。
 *
 * @remarks
 * 任 4xx / 5xx 視為 soft-fail；呼叫端（stores/auth.ts.logout）即使後端不可用也須清除本地憑證，
 * 避免使用者被卡在「無法登出」狀態。
 */
export const logout = (data?: LogoutRequest): Promise<ApiResponse<null>> =>
  httpClient.post<null>('/auth/logout', data ?? {});
