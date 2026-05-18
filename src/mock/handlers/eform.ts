import { http, HttpResponse } from 'msw';

import type { FormSessionRecord } from '@/types/form';
import type { UserInfo } from '@/types/user';

import { MOCK_TEMPLATES, mockSessions, nextSessionId } from '../eform';
import { mockUsers } from '../staff';

// 電子表單 MSW handler —「契約替身」
//
// 重要：此處 RBAC 過濾僅模擬真實後端契約，讓前端依正確形狀開發。
// 切換 VITE_USE_MOCK=false 接上真後端時，前端 api/store 無需改動。
//
// 端點清單：
// GET    .../api/v1/eform/templates            模板清單（依 businessTypeId 篩選）
// POST   .../api/v1/eform/generate             生成 PDF，寫入 session
// POST   .../api/v1/eform/generate/batch       批次生成 PDF，寫入 session
// GET    .../api/v1/eform/sessions             歷程列表（RBAC + 分頁 + 篩選）
// GET    .../api/v1/eform/sessions/:id         單一歷程詳情

const ENVELOPE = (data: unknown, code = 0, message = 'success') => ({
  code,
  message,
  data,
  timestamp: Date.now(),
});

/** 模擬後端解析 JWT：由 Authorization header 或 localStorage 取得呼叫者身分 */
function resolvePrincipal(request: Request): UserInfo | null {
  const auth = request.headers.get('Authorization') ?? '';
  const matched = auth.match(/mock-access-token\.([A-Za-z0-9_]+)/);
  if (matched) {
    const user = mockUsers.find((u) => u.username === matched[1]);
    if (user) return user;
  }
  try {
    const raw = localStorage.getItem('user-info');
    if (raw) {
      const parsed = JSON.parse(raw) as { user?: UserInfo };
      if (parsed.user) return parsed.user;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * 依角色套用可見範圍過濾（仿 knowledge handler 的 isVisible 模式）：
 *   admin：可見全部 sessions
 *   manager：可見本部門所有員工的 sessions（依 createdByDepartmentId）
 *   user：僅可見自己的 sessions（依 createdById）
 */
function applyVisibilityFilter(sessions: FormSessionRecord[], user: UserInfo): FormSessionRecord[] {
  // 契約（domain.md「Visibility contract」）：「看全部」唯一條件是 role==='admin'。
  // departmentId==null 分支僅因「非 admin 一律有部門」由表單層保證；後端勿用 dept IS NULL 當 see-all。
  if (user.role === 'admin' || user.departmentId == null) return sessions;
  if (user.role === 'manager') {
    return sessions.filter((s) => s.createdByDepartmentId === user.departmentId);
  }
  // user：僅自己
  return sessions.filter((s) => s.createdById === user.id);
}

function nowStr(): string {
  return new Date().toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export const eformHandlers = [
  // ── GET 模板清單 ─────────────────────────────────────────────────────────────
  // 依 businessTypeId 篩選；不需 RBAC（模板可見範圍由業務別連動控制，在 store 層處理）
  http.get('*/api/v1/eform/templates', ({ request }) => {
    const url = new URL(request.url);
    const businessTypeId = url.searchParams.get('businessTypeId');

    let templates = MOCK_TEMPLATES.filter((t) => t.active);
    if (businessTypeId) {
      templates = templates.filter((t) => t.businessTypeId === businessTypeId);
    }

    return HttpResponse.json(ENVELOPE(templates));
  }),

  // ── POST 批次生成 PDF（多張）────────────────────────────────────────────────
  // 寫入 session，回傳 { downloadUrl(zip), expiresAt, files[] }
  http.post('*/api/v1/eform/generate/batch', async ({ request }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const body = (await request.json()) as {
      templateIds: string[];
      businessTypeId: string;
      businessTypeName: string;
      applicantData: Record<string, string>;
    };

    const templates = MOCK_TEMPLATES.filter((t) => body.templateIds?.includes(t.id));
    if (templates.length === 0) {
      return HttpResponse.json(ENVELOPE(null, 50002, '未找到任何有效的表單模板'));
    }

    const now = nowStr();
    const sid = nextSessionId();
    const record: FormSessionRecord = {
      id: sid,
      businessTypeId: body.businessTypeId,
      businessTypeName: body.businessTypeName,
      departmentId: user.departmentId ?? '',
      templateIds: templates.map((t) => t.id),
      generatedFiles: templates.map((t) => ({
        templateId: t.id,
        filename: t.pdfFileName,
        downloadUrl: `https://example.com/mock-file-${sid}-${t.id}.pdf`,
      })),
      createdBy: user.name || user.username,
      createdById: user.id,
      createdByDepartmentId: user.departmentId ?? '',
      createdAt: now,
    };
    mockSessions.unshift(record);

    return HttpResponse.json(
      ENVELOPE({
        downloadUrl: `https://example.com/mock-batch-${record.id}.zip`,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        files: record.generatedFiles,
      }),
      { status: 201 }
    );
  }),

  // ── GET 歷程列表（RBAC + 分頁 + 篩選）────────────────────────────────────────
  // 角色 scope：user=self / manager=同部門 / admin=all
  // 支援 query：page, pageSize, businessTypeId, departmentId（manager/admin），
  //            createdById（manager/admin 帳號篩選）
  http.get('*/api/v1/eform/sessions', ({ request }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const url = new URL(request.url);

    // 1. RBAC 可見範圍
    let visible = applyVisibilityFilter(mockSessions, user);

    // 2. 額外篩選參數（manager/admin 可用）
    const businessTypeId = url.searchParams.get('businessTypeId');
    if (businessTypeId) {
      visible = visible.filter((s) => s.businessTypeId === businessTypeId);
    }

    const departmentId = url.searchParams.get('departmentId');
    if (departmentId && user.role === 'admin') {
      // admin 可跨部門篩選；manager 本身已被 RBAC 限定，不允許跨部門
      visible = visible.filter((s) => s.createdByDepartmentId === departmentId);
    }

    const createdById = url.searchParams.get('createdById');
    if (createdById && (user.role === 'admin' || user.role === 'manager')) {
      visible = visible.filter((s) => s.createdById === createdById);
    }

    // 3. 分頁（無限滾動懶加載：前端 append，後端仍回傳 page/pageSize 結構）
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 10);
    const total = visible.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = visible.slice(start, start + pageSize);

    return HttpResponse.json(ENVELOPE({ items, total, page: safePage, pageSize, totalPages }));
  }),

  // ── GET 單一歷程詳情 ─────────────────────────────────────────────────────────
  http.get('*/api/v1/eform/sessions/:id', ({ request, params }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const session = mockSessions.find((s) => s.id === params.id);
    if (!session) {
      return HttpResponse.json(ENVELOPE(null, 20004, '歷程不存在'));
    }

    // 確認呼叫者有權限查看此 session
    const [allowed] = applyVisibilityFilter([session], user);
    if (!allowed) {
      return HttpResponse.json(ENVELOPE(null, 10002, '無此歷程的查看權限'));
    }

    return HttpResponse.json(ENVELOPE(session));
  }),
];
