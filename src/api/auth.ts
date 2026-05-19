/**
 * 認證相關 API
 *
 * 此層為薄轉發：僅組裝請求、回傳業務型別（ApiResponse<T>），
 * 業務碼 / HTTP 錯誤分流由 `utils/request.ts` 攔截器處理。
 *
 * @remarks
 * - `logout`：後端尚未提供撤銷端點，前端登出僅清除本地狀態（見 `stores/auth.ts`），故此層不提供。
 * - `refreshToken`：後端尚未提供刷新端點，token 過期一律走 401 登出流程；待後端 ready 再補：
 *   ```ts
 *   export const refreshToken = (): Promise<ApiResponse<{ accessToken: string }>> =>
 *     httpClient.post<{ accessToken: string }>('/auth/refresh');
 *   ```
 */

import type { ApiResponse } from '@/types/api';
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginRequest,
  LoginResponse,
} from '@/types/auth';
import type { UserInfo } from '@/types/user';
import { httpClient } from '@/utils/request';

/**
 * 登入
 */
export const login = (data: LoginRequest): Promise<ApiResponse<LoginResponse>> =>
  httpClient.post<LoginResponse>('/auth/login', data);

/**
 * 取得當前登入者即時身分
 *
 * 後端依 token 回傳最新使用者資料（含 role / department / businessTypeIds）。
 * 前端據此同步單一真相源，使 admin 端的指派變更免重新登入即可生效。
 */
export const getCurrentUser = (): Promise<ApiResponse<UserInfo>> =>
  httpClient.get<UserInfo>('/auth/me');

/**
 * 修改密碼
 */
export const changePassword = (
  data: ChangePasswordRequest
): Promise<ApiResponse<ChangePasswordResponse>> =>
  httpClient.post<ChangePasswordResponse>('/auth/change-password', data);
