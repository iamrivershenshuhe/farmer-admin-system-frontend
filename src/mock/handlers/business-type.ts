import { http, HttpResponse } from 'msw';

import type { BusinessType } from '@/types/business-type';

import { assignedBusinessTypeIds, mockBusinessTypes } from '../department';
import { mockUsers } from '../staff';
import { fail, ok, paginate, readPageQuery, sortList } from './_helpers';

const usageCount = (btId: string) =>
  mockUsers.filter((u) => u.businessTypeIds?.includes(btId)).length;

export const businessTypeHandlers = [
  // 跨部門業務別列表（分頁／篩選／排序）— 業務別管理 tab
  http.get('*/api/v1/business-types', ({ request }) => {
    const url = new URL(request.url);
    const q = readPageQuery(url);
    const deptId = url.searchParams.get('departmentId') ?? undefined;
    const keyword = url.searchParams.get('keyword')?.trim().toLowerCase();
    const activeParam = url.searchParams.get('active');

    let list = [...mockBusinessTypes];
    if (deptId) list = list.filter((bt) => bt.departmentId === deptId);
    if (keyword) list = list.filter((bt) => bt.name.toLowerCase().includes(keyword));
    if (activeParam != null) list = list.filter((bt) => bt.active === (activeParam === 'true'));

    list = sortList(list, q.sortBy ?? 'name', q.sortOrder ?? 'asc');
    const page = paginate(list, q.page, q.pageSize);
    const items = page.items.map((bt) => ({ ...bt, usageCount: usageCount(bt.id) }));
    return HttpResponse.json(ok({ ...page, items }));
  }),

  // 單一部門業務別（不分頁；下鑽 / 連動下拉用）
  http.get('*/api/v1/departments/:id/business-types', async ({ params }) => {
    await new Promise((r) => setTimeout(r, 150));
    const items = mockBusinessTypes.filter((bt) => bt.departmentId === params.id);
    return HttpResponse.json(ok({ items }));
  }),

  // 新增業務別（業務別必屬一個部門；缺 departmentId 一律擋下）
  http.post('*/api/v1/business-types', async ({ request }) => {
    const body = (await request.json()) as Partial<BusinessType>;
    const deptId = body.departmentId ?? '';
    if (!deptId) {
      return HttpResponse.json(fail(20003, '業務別必須歸屬一個部門'), { status: 400 });
    }
    if (mockBusinessTypes.some((bt) => bt.departmentId === deptId && bt.name === body.name)) {
      return HttpResponse.json(fail(20003, '業務別名稱在此部門已存在'), { status: 400 });
    }
    const newBt: BusinessType = {
      id: `BT${Date.now()}`,
      departmentId: deptId,
      name: body.name ?? '',
      description: body.description,
      active: body.active ?? true,
    };
    mockBusinessTypes.push(newBt);
    return HttpResponse.json(ok(newBt, '業務別建立成功'), { status: 201 });
  }),

  // 更新業務別
  http.put('*/api/v1/business-types/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<BusinessType>;
    const idx = mockBusinessTypes.findIndex((bt) => bt.id === params.id);
    if (idx === -1) return HttpResponse.json(fail(20004, '業務別不存在'), { status: 404 });
    const dup = mockBusinessTypes.some(
      (bt) =>
        bt.id !== params.id &&
        bt.departmentId === mockBusinessTypes[idx].departmentId &&
        bt.name === body.name
    );
    if (dup) return HttpResponse.json(fail(20003, '業務別名稱在此部門已存在'), { status: 400 });
    mockBusinessTypes[idx] = { ...mockBusinessTypes[idx], ...body };
    return HttpResponse.json(ok(mockBusinessTypes[idx]));
  }),

  // 停用 / 啟用（軟刪除，可逆）
  http.patch('*/api/v1/business-types/:id/active', async ({ params, request }) => {
    const { active } = (await request.json()) as { active: boolean };
    const idx = mockBusinessTypes.findIndex((bt) => bt.id === params.id);
    if (idx === -1) return HttpResponse.json(fail(20004, '業務別不存在'), { status: 404 });
    mockBusinessTypes[idx].active = active;
    return HttpResponse.json(ok(mockBusinessTypes[idx]));
  }),

  // 刪除業務別（受守門：仍被人員指派時擋下）
  http.delete('*/api/v1/business-types/:id', ({ params }) => {
    const btId = params.id as string;
    if (assignedBusinessTypeIds.has(btId)) {
      return HttpResponse.json(fail(20003, '仍有人員使用此業務別，無法刪除'), { status: 400 });
    }
    const idx = mockBusinessTypes.findIndex((bt) => bt.id === btId);
    if (idx !== -1) mockBusinessTypes.splice(idx, 1);
    return HttpResponse.json(ok(null, '刪除成功'));
  }),

  // 批次停用 / 啟用 —— 後端回 BatchResult { success: id[], failed: {id,code,message}[] }
  http.post('*/api/v1/business-types/batch-active', async ({ request }) => {
    const { ids, active } = (await request.json()) as { ids: string[]; active: boolean };
    const success: string[] = [];
    const failed: { id: string; code: number; message: string }[] = [];
    ids.forEach((id) => {
      const bt = mockBusinessTypes.find((x) => x.id === id);
      if (!bt) {
        failed.push({ id, code: 20004, message: '業務別不存在' });
        return;
      }
      bt.active = active;
      success.push(id);
    });
    return HttpResponse.json(ok({ success, failed }));
  }),

  // 批次刪除（受守門：被指派者擋下並回報）—— 後端回 BatchResult
  http.post('*/api/v1/business-types/batch-delete', async ({ request }) => {
    const { ids } = (await request.json()) as { ids: string[] };
    const success: string[] = [];
    const failed: { id: string; code: number; message: string }[] = [];
    for (const id of ids) {
      if (assignedBusinessTypeIds.has(id)) {
        failed.push({ id, code: 20003, message: '仍有人員使用此業務別，無法刪除' });
        continue;
      }
      const idx = mockBusinessTypes.findIndex((bt) => bt.id === id);
      if (idx === -1) {
        failed.push({ id, code: 20004, message: '業務別不存在' });
        continue;
      }
      mockBusinessTypes.splice(idx, 1);
      success.push(id);
    }
    return HttpResponse.json(ok({ success, failed }, '刪除完成'));
  }),
];
