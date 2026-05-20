import { http, HttpResponse } from 'msw';

import type { UserInfo, UserRole } from '@/types/user';

import { mockDepartments } from '../department';
import { DEFAULT_PASSWORD, mockUsers } from '../staff';
import { fail, ok, paginate, readPageQuery, sortList } from './_helpers';

/** 由 departmentId 查 mock 部門名稱（建立/更新人員時同步 entity.department 顯示欄位） */
function lookupDeptName(deptId: string | null | undefined): string {
  if (!deptId) return '';
  return mockDepartments.find((d) => d.id === deptId)?.name ?? '';
}

export const staffHandlers = [
  // 人員列表（分頁／篩選／排序）
  http.get('*/api/v1/staff', ({ request }) => {
    const url = new URL(request.url);
    const q = readPageQuery(url);
    const keyword = url.searchParams.get('keyword')?.trim().toLowerCase();
    const departmentId = url.searchParams.get('departmentId') ?? undefined;
    const role = url.searchParams.get('role') ?? undefined;
    const activeParam = url.searchParams.get('active');

    let list = [...mockUsers];
    if (keyword) {
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(keyword) ||
          (u.name ?? '').toLowerCase().includes(keyword)
      );
    }
    if (departmentId) list = list.filter((u) => u.departmentId === departmentId);
    if (role) list = list.filter((u) => u.role === role);
    if (activeParam != null) list = list.filter((u) => u.active === (activeParam === 'true'));

    list = sortList(list, q.sortBy ?? 'username', q.sortOrder ?? 'asc');
    return HttpResponse.json(ok(paginate(list, q.page, q.pageSize)));
  }),

  // 可作為部門主管的人員（下拉用）
  http.get('*/api/v1/staff/managers', () => {
    const items = mockUsers.filter((u) => (u.role === 'manager' || u.role === 'admin') && u.active);
    return HttpResponse.json(ok(items));
  }),

  // 單一人員
  http.get('*/api/v1/staff/:id', ({ params }) => {
    const user = mockUsers.find((u) => u.id === params.id);
    if (!user) return HttpResponse.json(fail(20004, '人員不存在'), { status: 404 });
    return HttpResponse.json(ok(user));
  }),

  // 新增人員（員工編號 username 唯一校驗）
  http.post('*/api/v1/staff', async ({ request }) => {
    const body = (await request.json()) as Partial<UserInfo>;
    if (mockUsers.some((u) => u.username === body.username)) {
      return HttpResponse.json(fail(20003, '員工編號已存在'), { status: 400 });
    }
    const newUser: UserInfo = {
      id: `USER${Date.now()}`,
      username: body.username ?? '',
      name: body.name,
      role: body.role ?? 'user',
      departmentId: body.departmentId ?? null,
      // entity 的 department(顯示名)由 departmentId 查 mock 部門得出，不再由 client 提供
      department: lookupDeptName(body.departmentId),
      businessTypeIds: body.businessTypeIds ?? [],
      active: true,
      mustChangePassword: body.mustChangePassword ?? true,
      createdAt: new Date().toISOString(),
    };
    mockUsers.push(newUser);
    return HttpResponse.json(ok(newUser, '人員帳號建立成功'), { status: 201 });
  }),

  // 更新人員基本資料（含部門 / 業務範圍）
  http.put('*/api/v1/staff/:id', async ({ params, request }) => {
    const body = (await request.json()) as Partial<UserInfo>;
    const idx = mockUsers.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json(fail(20004, '人員不存在'), { status: 404 });
    // 若 payload 帶了 departmentId，同步重算顯示用 department 名稱（避免 entity 兩欄漂移）
    const patch: Partial<UserInfo> = { ...body };
    if ('departmentId' in body) {
      patch.department = lookupDeptName(body.departmentId);
    }
    mockUsers[idx] = { ...mockUsers[idx], ...patch };
    return HttpResponse.json(ok(mockUsers[idx]));
  }),

  // 變更角色
  http.patch('*/api/v1/staff/:id/role', async ({ params, request }) => {
    const { role } = (await request.json()) as { role: UserRole };
    const idx = mockUsers.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json(fail(20004, '人員不存在'), { status: 404 });
    mockUsers[idx].role = role;
    return HttpResponse.json(ok(mockUsers[idx]));
  }),

  // 重設密碼
  http.post('*/api/v1/staff/:id/reset-password', async ({ params, request }) => {
    const { mustChangePassword } = (await request.json()) as { mustChangePassword: boolean };
    const idx = mockUsers.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json(fail(20004, '人員不存在'), { status: 404 });
    mockUsers[idx].mustChangePassword = mustChangePassword;
    return HttpResponse.json(ok({ defaultPassword: DEFAULT_PASSWORD }, '密碼已重設'));
  }),

  // 停用 / 啟用（軟刪除，可逆）
  http.patch('*/api/v1/staff/:id/active', async ({ params, request }) => {
    const { active } = (await request.json()) as { active: boolean };
    const idx = mockUsers.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json(fail(20004, '人員不存在'), { status: 404 });
    mockUsers[idx].active = active;
    return HttpResponse.json(ok(mockUsers[idx]));
  }),

  // 刪除人員（受守門：仍啟用者須先停用）
  http.delete('*/api/v1/staff/:id', ({ params }) => {
    const idx = mockUsers.findIndex((u) => u.id === params.id);
    if (idx === -1) return HttpResponse.json(fail(20004, '人員不存在'), { status: 404 });
    if (mockUsers[idx].active) {
      return HttpResponse.json(fail(20003, '帳號仍啟用中，請先停用再刪除'), { status: 400 });
    }
    mockUsers.splice(idx, 1);
    return HttpResponse.json(ok(null, '刪除成功'));
  }),

  // 批次停用 / 啟用
  http.post('*/api/v1/staff/batch-active', async ({ request }) => {
    const { ids, active } = (await request.json()) as { ids: string[]; active: boolean };
    mockUsers.forEach((u) => {
      if (ids.includes(u.id)) u.active = active;
    });
    return HttpResponse.json(ok({ affected: ids.length }));
  }),

  // 批次刪除（受守門：啟用中者擋下）
  http.post('*/api/v1/staff/batch-delete', async ({ request }) => {
    const { ids } = (await request.json()) as { ids: string[] };
    const blocked = ids.filter((id) => mockUsers.find((u) => u.id === id)?.active);
    const removable = ids.filter((id) => !blocked.includes(id));
    for (const id of removable) {
      const idx = mockUsers.findIndex((u) => u.id === id);
      if (idx !== -1) mockUsers.splice(idx, 1);
    }
    if (blocked.length) {
      return HttpResponse.json(fail(20003, `${blocked.length} 個帳號仍啟用中，請先停用再刪除`), {
        status: 400,
      });
    }
    return HttpResponse.json(ok({ removed: removable.length }, '刪除成功'));
  }),
];
