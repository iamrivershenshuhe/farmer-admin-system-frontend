import { http, HttpResponse } from 'msw';

import type {
  BulkUpdateFieldsPayload,
  EFormTemplate,
  FormFieldCoord,
  FormSessionRecord,
  PublishTemplatePayload,
} from '@/types/eform';
import type { UserInfo } from '@/types/user';

import { MOCK_TEMPLATES, mockSessions, nextSessionId } from '../eform';
import { resolvePrincipal } from './_helpers';

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

  // ===========================================================================
  // 模板 admin 端點（v1.2 新增）
  // 對齊 api-spec §3.6.6–§3.6.11；mock 行為僅作型別契約替身，不持久化變更。
  // ===========================================================================

  // GET /eform/templates/:id — 模板詳情（含 fields[]）
  http.get('*/api/v1/eform/templates/:id', ({ request, params }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));
    const template = MOCK_TEMPLATES.find((t) => t.id === params.id);
    if (!template) return HttpResponse.json(ENVELOPE(null, 50002, '模板不存在'));
    return HttpResponse.json(
      ENVELOPE({
        ...template,
        // v1.2 canonical: 完整 metadata
        templateUid: `TMPL-${template.id}`,
        version: 1,
        status: 'published' as const,
        name: template.pdfFileName.replace(/\.pdf$/, ''),
        departmentId: 'DEPT001',
        eformBusinessTypeId: template.businessTypeId,
        pdfFilePath: `rag-forms/dept/${template.id}.pdf`,
        publishedAt: '2026-04-01T00:00:00Z',
        createdAt: '2026-03-15T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      } satisfies EFormTemplate)
    );
  }),

  // GET /eform/templates/:id/fields — 僅回 fields[]
  http.get('*/api/v1/eform/templates/:id/fields', ({ params }) => {
    const template = MOCK_TEMPLATES.find((t) => t.id === params.id);
    if (!template) return HttpResponse.json(ENVELOPE(null, 50002, '模板不存在'));
    return HttpResponse.json(ENVELOPE(template.fields));
  }),

  // POST /eform/templates — 建立模板（v1.2 新增；multipart/form-data）
  http.post('*/api/v1/eform/templates', async ({ request }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));
    if (user.role === 'user') {
      return HttpResponse.json(ENVELOPE(null, 10002, '無權限建立模板'));
    }

    // 解析 multipart form data
    let name = '新模板';
    let departmentId: string | null = user.departmentId;
    try {
      const formData = await request.formData();
      const fdName = formData.get('name');
      if (typeof fdName === 'string') name = fdName;
      const fdDept = formData.get('departmentId');
      if (typeof fdDept === 'string') departmentId = fdDept;
    } catch {
      /* mock: form data 解析失敗仍回模板成功，方便 demo */
    }

    const newId = `TMPL-${Date.now()}`;
    return HttpResponse.json(
      ENVELOPE({
        id: newId,
        templateUid: newId,
        version: 1,
        status: 'draft' as const,
        name,
        departmentId,
        fields: [
          // 模擬 OCR + rule_engine 偵測到 2 個欄位
          {
            id: `${newId}_F001`,
            templateId: newId,
            fieldKey: 'applicant_name',
            displayLabel: '申請人姓名',
            label: '申請人姓名',
            fieldType: 'text' as const,
            labelBbox: { x1: 183, y1: 117, x2: 263, y2: 157 },
            fillBbox: { x1: 263, y1: 117, x2: 660, y2: 157 },
            x1: 263,
            y1: 117,
            x2: 660,
            y2: 157,
            page: 1,
            fontSize: 10,
            maxFontSize: 14,
            fontColor: '#0000CC',
            isRequired: true,
            required: true,
            priorityOrder: 1,
            source: 'ocr_rule' as const,
            confidence: 0.92,
            sublabels: [],
          } satisfies FormFieldCoord,
        ],
      })
    );
  }),

  // PUT /eform/templates/:id/fields — bulk 欄位更新（v1.2 新增）
  http.put('*/api/v1/eform/templates/:id/fields', async ({ params, request }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const template = MOCK_TEMPLATES.find((t) => t.id === params.id);
    if (!template) return HttpResponse.json(ENVELOPE(null, 50002, '模板不存在'));

    const body = (await request.json().catch(() => ({}))) as BulkUpdateFieldsPayload;
    if (!body.fields || !Array.isArray(body.fields)) {
      return HttpResponse.json(ENVELOPE(null, 20003, 'fields 必為陣列'));
    }

    // 變動者 source 自動轉 admin_manual
    const updatedFields = body.fields.map((f) => ({
      ...f,
      source: 'admin_manual' as const,
      confidence: null,
    }));

    return HttpResponse.json(ENVELOPE({ templateId: params.id as string, fields: updatedFields }));
  }),

  // PUT /eform/templates/:id/fields/:fieldId/coords — 單欄座標微調（既有 + 強化）
  http.put('*/api/v1/eform/templates/:id/fields/:fieldId/coords', async ({ params, request }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const template = MOCK_TEMPLATES.find((t) => t.id === params.id);
    if (!template) return HttpResponse.json(ENVELOPE(null, 50002, '模板不存在'));
    const field = template.fields.find((f) => f.id === params.fieldId);
    if (!field) return HttpResponse.json(ENVELOPE(null, 50002, '欄位不存在'));

    const patch = (await request.json().catch(() => ({}))) as Partial<FormFieldCoord>;
    const updated: FormFieldCoord = {
      ...field,
      ...patch,
      source: 'admin_manual' as const,
    };
    return HttpResponse.json(ENVELOPE(updated));
  }),

  // POST /eform/templates/:id/publish — 發布（v1.2 新增）
  http.post('*/api/v1/eform/templates/:id/publish', async ({ params, request }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));
    if (user.role === 'user') {
      return HttpResponse.json(ENVELOPE(null, 10002, '無權限發布模板'));
    }

    const template = MOCK_TEMPLATES.find((t) => t.id === params.id);
    if (!template) return HttpResponse.json(ENVELOPE(null, 50002, '模板不存在'));

    await request.json().catch(() => ({}) as PublishTemplatePayload);

    return HttpResponse.json(
      ENVELOPE({
        id: template.id,
        templateUid: `TMPL-${template.id}`,
        version: 1,
        status: 'published' as const,
        publishedAt: new Date().toISOString(),
      })
    );
  }),

  // GET /eform/templates/:id/preview — Dry-run preview（v1.2 新增）
  http.get('*/api/v1/eform/templates/:id/preview', ({ params }) => {
    const template = MOCK_TEMPLATES.find((t) => t.id === params.id);
    if (!template) return HttpResponse.json(ENVELOPE(null, 50002, '模板不存在'));
    return HttpResponse.json(
      ENVELOPE({
        previewUrl: `/api/v1/eform/download/mock-preview-${template.id}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
    );
  }),

  // DELETE /eform/templates/:id — 軟刪除模板（v1.2 新增）
  http.delete('*/api/v1/eform/templates/:id', ({ request, params }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));
    if (user.role === 'user') {
      return HttpResponse.json(ENVELOPE(null, 10002, '無權限刪除模板'));
    }
    const template = MOCK_TEMPLATES.find((t) => t.id === params.id);
    if (!template) return HttpResponse.json(ENVELOPE(null, 50002, '模板不存在'));
    return HttpResponse.json(ENVELOPE(null, 0, '模板已下架'));
  }),
];
