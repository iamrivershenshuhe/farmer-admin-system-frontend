import { http, HttpResponse } from 'msw';

import type { Department } from '@/types/department';

import { mockBusinessTypes, mockDepartments } from '../department';
import { fail, ok, paginate, readPageQuery, sortList } from './_helpers';

/** 部門是否被引用（有人員 / 業務別 / 知識庫文件）→ 守門硬刪除 */
function isReferenced(dept: Department): boolean {
  return (
    dept.memberCount > 0 ||
    (dept.knowledgeBaseCount ?? 0) > 0 ||
    mockBusinessTypes.some((bt) => bt.departmentId === dept.id)
  );
}

export const departmentHandlers = [
  // 部門列表（分頁／篩選／排序）
  http.get('*/api/v1/departments', ({ request }) => {
    const url = new URL(request.url);
    const q = readPageQuery(url);
    const keyword = url.searchParams.get('keyword')?.trim().toLowerCase();
    const activeParam = url.searchParams.get('active');

    let list = [...mockDepartments];
    if (keyword) {
      list = list.filter(
        (d) => d.name.toLowerCase().includes(keyword) || d.code.toLowerCase().includes(keyword)
      );
    }
    if (activeParam != null) list = list.filter((d) => d.active === (activeParam === 'true'));

    list = sortList(list, q.sortBy ?? 'code', q.sortOrder ?? 'asc');
    const page = paginate(list, q.page, q.pageSize);
    const items = page.items.map((d) => ({
      ...d,
      businessTypeCount: mockBusinessTypes.filter((bt) => bt.departmentId === d.id).length,
    }));
    return HttpResponse.json(ok({ ...page, items }));
  }),

  // 單一部門
  http.get('*/api/v1/departments/:id', ({ params }) => {
    const department = mockDepartments.find((d) => d.id === params.id);
    if (!department) return HttpResponse.json(fail(20004, '部門不存在'), { status: 404 });
    return HttpResponse.json(ok(department));
  }),

  // 新增部門（部門代碼唯一校驗）
  http.post('*/api/v1/departments', async ({ request }) => {
    const body = (await request.json()) as Partial<Department>;
    if (mockDepartments.some((d) => d.code === body.code)) {
      return HttpResponse.json(fail(20003, '部門代碼已存在'), { status: 400 });
    }
    if (mockDepartments.some((d) => d.name === body.name)) {
      return HttpResponse.json(fail(20003, '部門名稱已存在'), { status: 400 });
    }
    const newDept: Department = {
      id: `DEPT${Date.now()}`,
      code: body.code ?? '',
      name: body.name ?? '',
      managerName: body.managerName || undefined,
      memberCount: 0,
      knowledgeBaseCount: 0,
      active: body.active ?? true,
      createdAt: new Date().toISOString(),
    };
    mockDepartments.push(newDept);
    return HttpResponse.json(ok(newDept, '部門建立成功'), { status: 201 });
  }),

  // 更新部門
  http.put('*/api/v1/departments/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<Department>;
    const idx = mockDepartments.findIndex((d) => d.id === params.id);
    if (idx === -1) return HttpResponse.json(fail(20004, '部門不存在'), { status: 404 });
    if (body.code && mockDepartments.some((d) => d.id !== params.id && d.code === body.code)) {
      return HttpResponse.json(fail(20003, '部門代碼已存在'), { status: 400 });
    }
    mockDepartments[idx] = { ...mockDepartments[idx], ...body };
    return HttpResponse.json(ok(mockDepartments[idx]));
  }),

  // 停用 / 啟用（軟刪除，可逆）
  http.patch('*/api/v1/departments/:id/active', async ({ params, request }) => {
    const { active } = (await request.json()) as { active: boolean };
    const idx = mockDepartments.findIndex((d) => d.id === params.id);
    if (idx === -1) return HttpResponse.json(fail(20004, '部門不存在'), { status: 404 });
    mockDepartments[idx].active = active;
    return HttpResponse.json(ok(mockDepartments[idx]));
  }),

  // 刪除部門（受守門）
  http.delete('*/api/v1/departments/:id', ({ params }) => {
    const idx = mockDepartments.findIndex((d) => d.id === params.id);
    if (idx === -1) return HttpResponse.json(fail(20004, '部門不存在'), { status: 404 });
    if (isReferenced(mockDepartments[idx])) {
      return HttpResponse.json(
        fail(20003, '此部門仍有人員 / 業務別 / 知識庫文件，無法刪除，請改用停用'),
        { status: 400 }
      );
    }
    mockDepartments.splice(idx, 1);
    return HttpResponse.json(ok(null, '刪除成功'));
  }),

  // 批次停用 / 啟用 —— 後端回 BatchResult { success: id[], failed: {id,code,message}[] }
  http.post('*/api/v1/departments/batch-active', async ({ request }) => {
    const { ids, active } = (await request.json()) as { ids: string[]; active: boolean };
    const success: string[] = [];
    const failed: { id: string; code: number; message: string }[] = [];
    ids.forEach((id) => {
      const d = mockDepartments.find((x) => x.id === id);
      if (!d) {
        failed.push({ id, code: 20004, message: '部門不存在' });
        return;
      }
      d.active = active;
      success.push(id);
    });
    return HttpResponse.json(ok({ success, failed }));
  }),

  // 批次刪除（受守門）—— 後端回 BatchResult
  http.post('*/api/v1/departments/batch-delete', async ({ request }) => {
    const { ids } = (await request.json()) as { ids: string[] };
    const success: string[] = [];
    const failed: { id: string; code: number; message: string }[] = [];
    for (const id of ids) {
      const idx = mockDepartments.findIndex((d) => d.id === id);
      if (idx === -1) {
        failed.push({ id, code: 20004, message: '部門不存在' });
        continue;
      }
      if (isReferenced(mockDepartments[idx])) {
        failed.push({ id, code: 20003, message: '此部門仍被引用，無法刪除' });
        continue;
      }
      mockDepartments.splice(idx, 1);
      success.push(id);
    }
    return HttpResponse.json(ok({ success, failed }, '刪除完成'));
  }),
];
