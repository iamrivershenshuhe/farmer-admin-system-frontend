import { http, HttpResponse } from 'msw';

import type { AuditEvent } from '@/types/audit';

/**
 * Audit MSW handlers — 對齊 v1.2 API §3.8。
 *
 * 端點覆蓋：
 *  - GET /audit/events — admin only；其他角色 mock 也可呼叫（前端 RBAC 由路由守衛擋）
 *
 * 固定產生 50 筆代表性 audit events 作為 mock 資料源；前端 `/logs` 頁面（v1.3 實作）可
 * 直接 demo 各種事件類型 + 篩選 + 分頁。
 */

/**
 * 預先生成 50 筆 mock audit events，涵蓋八種 resource_type / 各種 event name。
 * `detail` 已 sanitize：不含 password / applicant_* / refresh_token。
 */
const mockAuditEvents: AuditEvent[] = (() => {
  const events: AuditEvent[] = [];
  const baseTime = Date.parse('2026-05-01T00:00:00Z');
  const samples: Array<Omit<AuditEvent, 'id' | 'createdAt'>> = [
    {
      userId: 'USER001',
      userEmployeeId: 'admin',
      event: 'user.login',
      resourceType: 'token',
      resourceId: null,
      detail: { result: 'success' },
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER002',
      userEmployeeId: 'manager',
      event: 'user.login_failed',
      resourceType: 'token',
      resourceId: null,
      detail: { reason: 'password_mismatch', employeeId: 'manager' },
      ipAddress: '10.0.0.2',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER001',
      userEmployeeId: 'admin',
      event: 'staff.role_changed',
      resourceType: 'staff',
      resourceId: 'USER003',
      detail: {
        fromRole: 'user',
        toRole: 'manager',
        fromDepartmentId: 'DEPT001',
        toDepartmentId: 'DEPT001',
      },
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER001',
      userEmployeeId: 'admin',
      event: 'department.create',
      resourceType: 'department',
      resourceId: 'DEPT005',
      detail: { code: 'NEW', name: '新成立部門' },
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER001',
      userEmployeeId: 'admin',
      event: 'business_type.delete',
      resourceType: 'business_type',
      resourceId: 'BT099',
      detail: { name: '廢止業務別' },
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER002',
      userEmployeeId: 'manager',
      event: 'document.upload',
      resourceType: 'document',
      resourceId: 'DOC001',
      detail: { docType: 'internal_regulation', filename: '部門規章-2026.pdf' },
      ipAddress: '10.0.0.2',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER002',
      userEmployeeId: 'manager',
      event: 'document.delete',
      resourceType: 'document',
      resourceId: 'DOC077',
      detail: { reason: 'admin_request' },
      ipAddress: '10.0.0.2',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER003',
      userEmployeeId: 'user001',
      event: 'rag.query',
      resourceType: 'conversation',
      resourceId: 'conv-001',
      detail: {
        queryText: '農會法第 5 條',
        scopeSnapshot: { role: 'user', departmentId: 'DEPT001', businessTypeIds: ['BT001'] },
        piiFindings: {},
      },
      ipAddress: '10.0.0.3',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER003',
      userEmployeeId: 'user001',
      event: 'query_denied',
      resourceType: 'conversation',
      resourceId: 'conv-001',
      detail: { reason: 'pii_blocked', piiTypes: ['tw_id'] },
      ipAddress: '10.0.0.3',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER001',
      userEmployeeId: 'admin',
      event: 'eform.template.publish',
      resourceType: 'eform_template',
      resourceId: 'TMPL-LOAN-001',
      detail: { version: 3, comment: '增訂保證人欄位' },
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER001',
      userEmployeeId: 'admin',
      event: 'eform.template.archive',
      resourceType: 'eform_template',
      resourceId: 'TMPL-OLD-001',
      detail: { reason: 'replaced_by_new_version' },
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER004',
      userEmployeeId: 'user002',
      event: 'eform.generate',
      resourceType: 'eform_template',
      resourceId: 'TMPL-LOAN-001',
      detail: { fieldsFilledKeys: ['applicant_name', 'applicant_id_number'] },
      ipAddress: '10.0.0.4',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: 'USER001',
      userEmployeeId: 'admin',
      event: 'token_revoked',
      resourceType: 'token',
      resourceId: 'USER003',
      detail: { reason: 'role_changed' },
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
    {
      userId: null,
      userEmployeeId: null,
      event: 'system.error',
      resourceType: 'system',
      resourceId: null,
      detail: { component: 'qdrant_sync', message: 'reconciliation drift detected' },
      ipAddress: null,
      userAgent: null,
    },
  ];

  // 重複擴充到 50+ 筆
  for (let i = 0; i < 50; i += 1) {
    const sample = samples[i % samples.length];
    events.push({
      ...sample,
      id: `audit-${String(i + 1).padStart(4, '0')}`,
      // 由近到遠（前端排序 desc createdAt）
      createdAt: new Date(baseTime + i * 3600_000).toISOString(),
    });
  }
  return events.reverse(); // 最新的在前
})();

export const auditHandlers = [
  // GET /audit/events
  http.get('*/api/v1/audit/events', ({ request }) => {
    const url = new URL(request.url);
    let filtered = [...mockAuditEvents];

    const userId = url.searchParams.get('userId');
    if (userId) filtered = filtered.filter((e) => e.userId === userId);

    const eventFilter = url.searchParams.get('event');
    if (eventFilter) {
      const names = eventFilter
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      filtered = filtered.filter((e) => names.includes(e.event));
    }

    const resourceType = url.searchParams.get('resourceType');
    if (resourceType) filtered = filtered.filter((e) => e.resourceType === resourceType);

    const resourceId = url.searchParams.get('resourceId');
    if (resourceId) filtered = filtered.filter((e) => e.resourceId === resourceId);

    const from = url.searchParams.get('from');
    if (from) {
      const t = Date.parse(from);
      filtered = filtered.filter((e) => Date.parse(e.createdAt) >= t);
    }
    const to = url.searchParams.get('to');
    if (to) {
      const t = Date.parse(to);
      filtered = filtered.filter((e) => Date.parse(e.createdAt) <= t);
    }

    const ip = url.searchParams.get('ip');
    if (ip) filtered = filtered.filter((e) => e.ipAddress === ip);

    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 20));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: { items, total, page: safePage, pageSize, totalPages },
      timestamp: Date.now(),
    });
  }),
];
