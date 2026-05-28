import { http, HttpResponse } from 'msw';

import type { LoginRequest } from '@/types/auth';

import { DEFAULT_PASSWORD, mockUsers } from '../staff';
import { resolvePrincipal } from './_helpers';

/**
 * 認證 Mock Handlers（VITE_USE_MOCK=true 時生效，為實際登入流程的契約替身）
 *
 * 職責分工：帳號資料源於 `src/mock/staff.ts`（staff 管帳號），
 * 本檔僅負責登入 / 登出 / 改密的驗證與回應行為（auth 管驗證）。
 *
 * 演示帳號（來源：src/mock/staff.ts 的 mockUsers）：
 * 密碼統一為 DEFAULT_PASSWORD（見 staff.ts）；帳號錯、密碼錯或帳號停用皆會被拒絕。
 *
 * | 帳號         | 角色    | 部門   | 首登強制改密 | 可見路由 / 操作範圍 |
 * |--------------|---------|--------|--------------|---------------------|
 * | admin        | admin   | （不限）| 否          | 全功能、全資料：聊天 / 知識庫 / 電子表單 / 組織管理(CRUD) / 系統日誌 |
 * | manager      | manager | 信用部 | 是（首登）   | 自部門：聊天 / 知識庫 / 電子表單 / 組織管理(唯讀)；登入後先導向 /change-password |
 * | user001      | user    | 信用部 | 否           | 自部門：聊天 / 知識庫(唯讀) / 電子表單(僅生成)；無組織管理路由（演示一般員工用此帳號） |
 * | user002      | user    | 供銷部 | 否           | 同上，不同部門資料範圍 |
 * | user003      | user    | 推廣部 | 否           | 同上（此帳號 active=false，演示停用情境） |
 * | chen_manager | manager | 推廣部 | 否           | 自部門經理 |
 * | lin_manager  | manager | 人事部 | 否           | 自部門經理 |
 *
 * 演示提示：所有帳號密碼皆為 DEFAULT_PASSWORD。manager 登入可示範「首次登入強制修改密碼」
 * 流程（改密成功後才放行進系統）；admin / user001 登入後直接進入 /chat；
 * user003 為停用帳號，可示範停用後無法登入。
 */
export const authHandlers = [
  // 登入
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as LoginRequest;
    // 同時接受 v1 別名 `username` 與 v1.2 canonical `employeeId`（後端兩者皆受）
    const employeeId = body.employeeId ?? body.username;
    const user = mockUsers.find((u) => u.username === employeeId);

    // 帳號不存在或密碼不符：統一回相同訊息（不洩漏帳號是否存在）
    if (!user || body.password !== DEFAULT_PASSWORD) {
      return HttpResponse.json({
        code: 10001,
        message: '帳號或密碼錯誤',
        data: null,
        timestamp: Date.now(),
      });
    }

    // 帳號已停用
    if (user.active === false) {
      return HttpResponse.json({
        code: 10002,
        message: '此帳號已停用，請聯絡系統管理員',
        data: null,
        timestamp: Date.now(),
      });
    }

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        // token 帶 username (= employeeId)，供 mock handler 模擬後端解析 JWT 識別呼叫者身分
        accessToken: `mock-access-token.${user.username}`,
        refreshToken: `mock-refresh-token.${user.username}`,
        mustChangePassword: user.mustChangePassword || false,
        user: {
          ...user,
          // v1.2 canonical：employeeId 與 username 同值；前端逐步遷移
          employeeId: user.username,
        },
      },
      timestamp: Date.now(),
    });
  }),

  // 取得當前登入者即時身分（單一真相源）
  // 由 Authorization token 解析呼叫者，回傳 mockUsers 中的「即時」資料，
  // 故 admin 變更指派後，前端重新拉取即可同步（不需重新登入）。
  http.get('*/api/v1/auth/me', ({ request }) => {
    const user = resolvePrincipal(request);

    if (!user || user.active === false) {
      return HttpResponse.json({
        code: 10001,
        message: '未登入或 Token 無效',
        data: null,
        timestamp: Date.now(),
      });
    }

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: user,
      timestamp: Date.now(),
    });
  }),

  // 登出 (POST /auth/logout)
  // v1.2 API §3.1.4 — 撤銷使用者所有未過期 refresh tokens；access token 自然到期。
  // Body 可選帶 { refreshToken }；mock 不做實際撤銷，僅回成功。
  http.post('*/api/v1/auth/logout', () => {
    return HttpResponse.json({
      code: 0,
      message: '已成功登出',
      data: null,
      timestamp: Date.now(),
    });
  }),

  // 刷新 Token (POST /auth/refresh)
  // v1.2 API §3.1.5 — rotation 強制：必回新 access + 新 refresh，前端必須以新值覆寫。
  // 失敗時應回 code: 10003 / 10004（mock 預設成功；若需測試失敗路徑可改 body.refreshToken 內容）。
  http.post('*/api/v1/auth/refresh', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { refreshToken?: string };

    // 簡易守門：refreshToken 缺失或不符 mock 格式視為失敗
    if (!body.refreshToken || !body.refreshToken.startsWith('mock-refresh-token')) {
      return HttpResponse.json({
        code: 10004,
        message: 'Refresh 失敗，請重新登入',
        data: null,
        timestamp: Date.now(),
      });
    }

    // 解析 username（rotation 後保留同身分）
    const matched = body.refreshToken.match(/mock-refresh-token\.(.+)$/);
    const username = matched?.[1] ?? 'admin';

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: {
        accessToken: `mock-access-token.${username}`,
        // rotation 後新 refresh（後綴 timestamp 確保與舊值不同）
        refreshToken: `mock-refresh-token.${username}`,
      },
      timestamp: Date.now(),
    });
  }),

  // 修改密碼：模擬後端清除該帳號的強制改密旗標（單一真相源）
  http.post('*/api/v1/auth/change-password', ({ request }) => {
    const principal = resolvePrincipal(request);
    if (!principal) {
      return HttpResponse.json({
        code: 10001,
        message: '未登入或 Token 無效',
        data: null,
        timestamp: Date.now(),
      });
    }

    const account = mockUsers.find((u) => u.id === principal.id);
    if (account) account.mustChangePassword = false;

    return HttpResponse.json({
      code: 0,
      message: '密碼修改成功',
      data: {
        success: true,
        message: '密碼修改成功',
      },
      timestamp: Date.now(),
    });
  }),
];
