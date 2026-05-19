import { http, HttpResponse } from 'msw';

import type { DocType, KnowledgeDocument } from '@/types/knowledge';
import { DOC_TYPE_LABELS, DocumentStatus } from '@/types/knowledge';
import type { UserInfo } from '@/types/user';

import type { MockKnowledgeDocument } from '../knowledge';
import { mockDocuments, nextDocId, nextVgId } from '../knowledge';
import { resolvePrincipal } from './_helpers';

// 知識庫 MSW handler —「契約替身」
//
// 重要：MSW 不是安全層，僅模擬真實 FastAPI 後端契約，讓前端依正確形狀開發。
// 真實的 RBAC 可見範圍與授權驗證權威在後端；此處的過濾僅為產生擬真假資料。
// 切換 VITE_USE_MOCK=false 接上真後端時，前端 api/store/views 無需改動。
//
// 端點清單：
// GET    .../api/v1/knowledge/documents               列表（最新版 + versionCount/isLatest）
// GET    .../api/v1/knowledge/documents/:id           詳情 { document, versions }
// POST   .../api/v1/knowledge/documents/batch-delete  批次軟刪整條版本鏈
// POST   .../api/v1/knowledge/documents/upload-new-version  追加新版本
// POST   .../api/v1/knowledge/documents               多檔上傳（items[]）
// PUT    .../api/v1/knowledge/documents/:id           更新中繼資料
// DELETE .../api/v1/knowledge/documents/:id/single    單版軟刪（詳情用，若為最新版則回升前版）
// DELETE .../api/v1/knowledge/documents/:id           整條版本鏈軟刪
// GET    .../api/v1/knowledge/categories              文件類別選項

const ENVELOPE = (data: unknown, code = 0, message = 'success') => ({
  code,
  message,
  data,
  timestamp: Date.now(),
});

/** 依規格 1.3 可見範圍規則過濾（manager 的 businessTypeIds 已含本部門全部） */
function isVisible(doc: KnowledgeDocument, user: UserInfo): boolean {
  // 契約（domain.md「Visibility contract」）：「看全部」唯一條件是 role==='admin'。
  // 此處保留 departmentId==null 分支僅因「非 admin 一律有部門」由表單層保證（UserModal）；
  // 後端整合務必只憑 role 判定，不得用 department_id IS NULL 當 see-all 哨兵。
  if (user.role === 'admin' || user.departmentId == null) return true;
  switch (doc.docType) {
    case 'public_regulation':
      return true;
    case 'official_document':
    case 'internal_regulation':
      return doc.departmentId === user.departmentId;
    case 'operation_manual':
    case 'application_form': {
      if (doc.departmentId !== user.departmentId) return false;
      const userBts = user.businessTypeIds ?? [];
      return doc.businessTypeIds.some((bt) => userBts.includes(bt));
    }
    default:
      return false;
  }
}

/**
 * 套用 keyword / docType / departmentId / businessTypeId / status 篩選與排序。
 * keyword 只比對 filename（規格要求）。
 */
function applyQuery(docs: KnowledgeDocument[], url: URL): KnowledgeDocument[] {
  const q = url.searchParams;
  let result = [...docs];

  const keyword = q.get('keyword')?.trim().toLowerCase();
  if (keyword) {
    result = result.filter((d) => d.filename.toLowerCase().includes(keyword));
  }

  const docType = q.get('docType');
  if (docType) result = result.filter((d) => d.docType === docType);

  const departmentId = q.get('departmentId');
  if (departmentId) result = result.filter((d) => d.departmentId === departmentId);

  const businessTypeId = q.get('businessTypeId');
  if (businessTypeId) result = result.filter((d) => d.businessTypeIds.includes(businessTypeId));

  // 四態各自獨立，直接比對（uploading / processing 不再合併）
  const status = q.get('status');
  if (status) {
    result = result.filter((d) => d.status === status);
  }

  const sortBy = (q.get('sortBy') as 'updatedAt' | 'uploadedAt' | 'filename') || 'updatedAt';
  const sortOrder = q.get('sortOrder') === 'asc' ? 1 : -1;
  result.sort((a, b) => {
    const av = a[sortBy] ?? '';
    const bv = b[sortBy] ?? '';
    if (av < bv) return -sortOrder;
    if (av > bv) return sortOrder;
    return 0;
  });

  return result;
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

/** 軟刪整條版本鏈（同 versionGroupId 全標 deletedAt） */
function softDeleteChain(versionGroupId: string): number {
  let count = 0;
  const now = nowStr();
  for (const doc of mockDocuments) {
    if (doc.versionGroupId === versionGroupId && doc.deletedAt === null) {
      doc.deletedAt = now;
      count += 1;
    }
  }
  return count;
}

/** 取得同 versionGroupId 中未軟刪的版本（依 uploadedAt 升序 = 最舊→最新） */
function getActiveChain(versionGroupId: string): MockKnowledgeDocument[] {
  return mockDocuments
    .filter((d) => d.versionGroupId === versionGroupId && d.deletedAt === null)
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? -1 : 1));
}

/** 將 MockKnowledgeDocument 轉為對外 KnowledgeDocument（去除 deletedAt） */
function toPublic(doc: MockKnowledgeDocument): KnowledgeDocument {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { deletedAt: _d, ...pub } = doc;
  return pub;
}

export const knowledgeHandlers = [
  // ── GET 分頁列表 ─────────────────────────────────────────────────────────────
  // 流程：過濾軟刪 → RBAC → 每組取最新版（supersededBy===null）→ 附 versionCount/isLatest
  //       → applyQuery（keyword 只比對 filename）→ 排序 → 分頁
  http.get('*/api/v1/knowledge/documents', ({ request }) => {
    const user = resolvePrincipal(request);
    if (!user) {
      return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));
    }

    const url = new URL(request.url);

    // 1. 過濾軟刪
    const active = mockDocuments.filter((d) => d.deletedAt === null);

    // 2. RBAC 可見範圍
    const visible = active.filter((d) => isVisible(d, user));

    // 3. 每個 versionGroupId 只保留最新版（supersededBy===null）
    //    並附加 versionCount / isLatest
    const latestMap = new Map<string, MockKnowledgeDocument>();
    for (const doc of visible) {
      if (doc.supersededBy === null) {
        latestMap.set(doc.versionGroupId, doc);
      }
    }

    // 計算每個群組的活躍版本數
    const groupCountMap = new Map<string, number>();
    for (const doc of active) {
      groupCountMap.set(doc.versionGroupId, (groupCountMap.get(doc.versionGroupId) ?? 0) + 1);
    }

    const latestDocs: KnowledgeDocument[] = Array.from(latestMap.values()).map((doc) => ({
      ...toPublic(doc),
      isLatest: true,
      versionCount: groupCountMap.get(doc.versionGroupId) ?? 1,
    }));

    // 4. facets：以「可見文件全集」(latestDocs) 計算，固定不隨其他已選篩選連動。
    //    四態各自獨立，不折疊（與 applyQuery / 前端狀態語意一致）。
    const facets = {
      docTypes: [...new Set(latestDocs.map((d) => d.docType))],
      statuses: [...new Set(latestDocs.map((d) => d.status))],
      businessTypeIds: [...new Set(latestDocs.flatMap((d) => d.businessTypeIds))],
    };

    // 5. applyQuery（keyword / docType / dept / bt / status + 排序）
    const filtered = applyQuery(latestDocs, url);

    // 6. 分頁
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 20);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return HttpResponse.json(
      ENVELOPE({ items, total, page: safePage, pageSize, totalPages, facets })
    );
  }),

  // ── batch-delete 須在 :id 前註冊 ────────────────────────────────────────────
  http.post('*/api/v1/knowledge/documents/batch-delete', async ({ request }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const { documentIds } = (await request.json()) as { documentIds: string[] };
    let removed = 0;
    const processedGroups = new Set<string>();

    for (const id of documentIds ?? []) {
      const doc = mockDocuments.find((d) => d.id === id);
      if (doc && !processedGroups.has(doc.versionGroupId)) {
        removed += softDeleteChain(doc.versionGroupId);
        processedGroups.add(doc.versionGroupId);
      }
    }
    return HttpResponse.json(ENVELOPE({ removed }, 0, `已停用 ${removed} 份文件`));
  }),

  // ── upload-new-version 須在 POST /documents 前註冊 ─────────────────────────
  http.post('*/api/v1/knowledge/documents/upload-new-version', async ({ request }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const form = await request.formData();
    const targetDocumentId = form.get('targetDocumentId') as string | null;
    if (!targetDocumentId) {
      return HttpResponse.json(ENVELOPE(null, 40000, 'targetDocumentId 必填'));
    }

    const target = mockDocuments.find((d) => d.id === targetDocumentId && d.deletedAt === null);
    if (!target) {
      return HttpResponse.json(ENVELOPE(null, 40001, '目標文件不存在或已停用'));
    }

    // 找出目前最新版（supersededBy===null）
    const currentLatest = mockDocuments.find(
      (d) =>
        d.versionGroupId === target.versionGroupId &&
        d.supersededBy === null &&
        d.deletedAt === null
    );
    if (!currentLatest) {
      return HttpResponse.json(ENVELOPE(null, 40001, '找不到版本鏈最新版'));
    }

    const file = form.get('file') as File | null;
    const id = nextDocId();
    const filename = file?.name || `${target.filename}（新版）`;
    const ext = filename.split('.').pop() || 'pdf';
    const now = nowStr();

    const newDoc: MockKnowledgeDocument = {
      id,
      filename,
      fileSize: file?.size ?? 0,
      mimeType: file?.type || target.mimeType,
      fileUrl: `/files/knowledge/${id}.${ext}`,
      // 繼承 target 的分類資訊
      docType: target.docType,
      departmentId: target.departmentId,
      businessTypeIds: [...target.businessTypeIds],
      versionGroupId: target.versionGroupId,
      version: (form.get('version') as string) || `${now.slice(0, 4)}-new`,
      versionNote: (form.get('versionNote') as string) || '',
      supersededBy: null,
      description: target.description,
      uploadedBy: user.name || user.username,
      uploadedAt: now,
      updatedAt: now,
      status: DocumentStatus.PROCESSING,
      chunkCount: 0,
      deletedAt: null,
    };

    // 舊最新版指向新版
    currentLatest.supersededBy = id;
    currentLatest.updatedAt = now;

    mockDocuments.unshift(newDoc);

    setTimeout(() => {
      const t = mockDocuments.find((d) => d.id === id);
      if (t) {
        t.status = DocumentStatus.READY;
        t.chunkCount = Math.floor(Math.random() * 50) + 10;
      }
    }, 3000);

    return HttpResponse.json(ENVELOPE(toPublic(newDoc), 0, '新版本上傳成功，正在處理向量化'));
  }),

  // ── POST 多檔上傳 ────────────────────────────────────────────────────────────
  // 接收 FormData：items[N].file, items[N].docType, items[N].version, ...
  // 每個 item 各自開新 versionGroupId
  http.post('*/api/v1/knowledge/documents', async ({ request }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const form = await request.formData();
    const created: KnowledgeDocument[] = [];
    let index = 0;

    while (form.has(`items[${index}].docType`) || form.has(`items[${index}].file`)) {
      const file = form.get(`items[${index}].file`) as File | null;
      const docType = (form.get(`items[${index}].docType`) as DocType) || 'internal_regulation';
      const departmentIdRaw = form.get(`items[${index}].departmentId`) as string | null;
      const businessTypeIds = JSON.parse(
        (form.get(`items[${index}].businessTypeIds`) as string) || '[]'
      ) as string[];
      const version = (form.get(`items[${index}].version`) as string) || '2024-v1';
      const versionNote = (form.get(`items[${index}].versionNote`) as string) || '';
      const description = (form.get(`items[${index}].description`) as string) || '';

      const id = nextDocId();
      const vgId = nextVgId();
      const filename = file?.name || `new_file_${index + 1}.pdf`;
      const ext = filename.split('.').pop() || 'pdf';
      const now = nowStr();

      const newDoc: MockKnowledgeDocument = {
        id,
        filename,
        fileSize: file?.size ?? 0,
        mimeType: file?.type || 'application/pdf',
        fileUrl: `/files/knowledge/${id}.${ext}`,
        docType,
        departmentId:
          docType === 'public_regulation' ? null : departmentIdRaw || user.departmentId || null,
        businessTypeIds,
        version,
        versionNote,
        versionGroupId: vgId,
        supersededBy: null,
        description,
        uploadedBy: user.name || user.username,
        uploadedAt: now,
        updatedAt: now,
        status: DocumentStatus.PROCESSING,
        chunkCount: 0,
        deletedAt: null,
      };

      mockDocuments.unshift(newDoc);
      created.push(toPublic(newDoc));

      const capturedId = id;
      setTimeout(() => {
        const t = mockDocuments.find((d) => d.id === capturedId);
        if (t) {
          t.status = DocumentStatus.READY;
          t.chunkCount = Math.floor(Math.random() * 50) + 10;
        }
      }, 3000);

      index += 1;
    }

    if (created.length === 0) {
      return HttpResponse.json(ENVELOPE(null, 40000, '未收到任何有效的上傳項目'));
    }

    return HttpResponse.json(
      ENVELOPE(created, 0, `成功上傳 ${created.length} 份文件，正在處理向量化`)
    );
  }),

  // ── GET 單一文件詳情 + 版本鏈 ───────────────────────────────────────────────
  // 回傳 { document: KnowledgeDocument, versions: KnowledgeDocument[] }
  // versions 為同 versionGroupId 全部未軟刪版本（依 uploadedAt 升序）
  http.get('*/api/v1/knowledge/documents/:id', ({ request, params }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const doc = mockDocuments.find((d) => d.id === params.id && d.deletedAt === null);
    if (!doc || !isVisible(doc, user)) {
      return HttpResponse.json(ENVELOPE(null, 40001, '文件不存在或已被停用'));
    }

    const versions = getActiveChain(doc.versionGroupId).map(toPublic);
    return HttpResponse.json(ENVELOPE({ document: toPublic(doc), versions }));
  }),

  // ── 更新文件中繼資料 ─────────────────────────────────────────────────────────
  http.put('*/api/v1/knowledge/documents/:id', async ({ request, params }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const idx = mockDocuments.findIndex((d) => d.id === params.id && d.deletedAt === null);
    if (idx === -1) return HttpResponse.json(ENVELOPE(null, 40001, '文件不存在'));

    const patch = (await request.json()) as Partial<KnowledgeDocument>;
    mockDocuments[idx] = {
      ...mockDocuments[idx],
      ...patch,
      id: mockDocuments[idx].id,
      versionGroupId: mockDocuments[idx].versionGroupId,
      deletedAt: mockDocuments[idx].deletedAt,
      updatedAt: nowStr(),
    };
    return HttpResponse.json(ENVELOPE(toPublic(mockDocuments[idx]), 0, '更新成功'));
  }),

  // ── DELETE 單版軟刪（/single）────────────────────────────────────────────────
  // 僅停用該 id；若刪的是當前最新版，將前一版 supersededBy 設回 null 使其回升
  http.delete('*/api/v1/knowledge/documents/:id/single', ({ request, params }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const doc = mockDocuments.find((d) => d.id === params.id && d.deletedAt === null);
    if (!doc) return HttpResponse.json(ENVELOPE(null, 40003, '文件不存在或已停用'));

    const wasLatest = doc.supersededBy === null;
    doc.deletedAt = nowStr();

    if (wasLatest) {
      // 找同群組中 supersededBy 指向此 id 的前版
      const prev = mockDocuments.find(
        (d) =>
          d.versionGroupId === doc.versionGroupId &&
          d.supersededBy === doc.id &&
          d.deletedAt === null
      );
      if (prev) {
        prev.supersededBy = null;
        prev.updatedAt = nowStr();
      }
    }

    return HttpResponse.json(ENVELOPE({ success: true }, 0, '單版已停用'));
  }),

  // ── DELETE 整條版本鏈軟刪 ────────────────────────────────────────────────────
  http.delete('*/api/v1/knowledge/documents/:id', ({ request, params }) => {
    const user = resolvePrincipal(request);
    if (!user) return HttpResponse.json(ENVELOPE(null, 10001, '未登入或 Token 無效'));

    const doc = mockDocuments.find((d) => d.id === params.id && d.deletedAt === null);
    if (!doc) return HttpResponse.json(ENVELOPE(null, 40003, '文件不存在或已停用'));

    softDeleteChain(doc.versionGroupId);
    return HttpResponse.json(ENVELOPE({ success: true }, 0, '版本鏈已停用'));
  }),

  // ── 取得文件類別選項 ─────────────────────────────────────────────────────────
  http.get('*/api/v1/knowledge/categories', () => {
    const options = (Object.keys(DOC_TYPE_LABELS) as DocType[]).map((value) => ({
      value,
      label: DOC_TYPE_LABELS[value],
    }));
    return HttpResponse.json(ENVELOPE(options));
  }),
];
