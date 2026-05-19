import type { KnowledgeDocument } from '@/types/knowledge';
import { DocumentStatus } from '@/types/knowledge';

/**
 * mock 專用擴充型別：在對外 KnowledgeDocument 上加軟刪除旗標。
 * deletedAt 僅供 handler 內部過濾，不會透過 API 回傳給前端。
 */
export interface MockKnowledgeDocument extends KnowledgeDocument {
  deletedAt: string | null;
}

/**
 * 知識庫 mock 文件樣本（對齊 FAS-TSD-01 v1.1.0）。
 *
 * 版本鏈設計：
 * - VG001（農業金融法規）：三版，v1→v2→v3，v1/v2 supersededBy 指向下一版 id
 * - VG002（信用部電子公文）：單版，supersededBy=null
 * - VG003（農會信用部業務規章）：單版
 * - VG004（放款作業手冊）：單版（BT001 可見，RBAC 情境）
 * - VG005（存款開戶申請表）：單版（BT002 可見，RBAC 情境）
 * - VG006（農產品銷售作業手冊）：單版（DEPT002 BT004）
 * - VG007（人事管理辦法）：單版（DEPT004）
 * - VG008（農業推廣教育訓練教材）：單版，status=PROCESSING
 * - VG009（催收業務說明）：單版，status=ERROR
 * - VG010（軟刪除示範）：已軟刪除，列表不顯示
 *
 * RBAC 可見性情境：
 * - public_regulation：departmentId=null → 全員可見
 * - official/internal：同部門全員可見（businessTypeIds 為空）
 * - operation_manual/application_form：同部門且 businessTypeIds 與使用者交集非空
 *   - user001(信用部, BT001) 可見 DOC004(BT001)，看不到 DOC005(BT002)
 *   - manager(信用部, BT001~3) 兩者皆可見
 */
export const mockDocuments: MockKnowledgeDocument[] = [
  // ── VG001：農業金融法規三版鏈 ──────────────────────────────────────────────
  {
    id: 'DOC001',
    filename: '農業金融法規彙編2022.pdf',
    fileSize: 4194304,
    mimeType: 'application/pdf',
    fileUrl: '/files/knowledge/DOC001.pdf',
    docType: 'public_regulation',
    departmentId: null,
    businessTypeIds: [],
    version: '2022-v1',
    versionNote: '初版',
    versionGroupId: 'VG001',
    supersededBy: 'DOC002',
    description: '2022 年農業金融相關法規彙整（已由新版取代）',
    uploadedBy: '系統管理員',
    uploadedAt: '2022-03-01 08:00:00',
    updatedAt: '2023-02-01 08:05:00',
    status: DocumentStatus.READY,
    chunkCount: 110,
    deletedAt: null,
  },
  {
    id: 'DOC002',
    filename: '農業金融法規彙編2023.pdf',
    fileSize: 4718592,
    mimeType: 'application/pdf',
    fileUrl: '/files/knowledge/DOC002.pdf',
    docType: 'public_regulation',
    departmentId: null,
    businessTypeIds: [],
    version: '2023-v2',
    versionNote: '補充農業信用保證基金修正條文',
    versionGroupId: 'VG001',
    supersededBy: 'DOC003',
    description: '2023 年更新版，新增信用保證條文（已由 2024 版取代）',
    uploadedBy: '系統管理員',
    uploadedAt: '2023-02-15 09:00:00',
    updatedAt: '2024-02-01 08:05:00',
    status: DocumentStatus.READY,
    chunkCount: 125,
    deletedAt: null,
  },
  {
    id: 'DOC003',
    filename: '農業金融法規彙編2024.pdf',
    fileSize: 5242880,
    mimeType: 'application/pdf',
    fileUrl: '/files/knowledge/DOC003.pdf',
    docType: 'public_regulation',
    departmentId: null,
    businessTypeIds: [],
    version: '2024-v3',
    versionNote: '納入農業部組改後新法源依據',
    versionGroupId: 'VG001',
    supersededBy: null,
    description: '2024 年更新農業金融相關法規彙整，全機關公開適用（現行最新版）',
    uploadedBy: '系統管理員',
    uploadedAt: '2024-02-01 08:00:00',
    updatedAt: '2024-02-01 08:00:00',
    status: DocumentStatus.READY,
    chunkCount: 135,
    deletedAt: null,
  },
  // ── VG002：信用部電子公文（單版）────────────────────────────────────────────
  {
    id: 'DOC004',
    filename: '信用部電子公文-2024030.pdf',
    fileSize: 409600,
    mimeType: 'application/pdf',
    fileUrl: '/files/knowledge/DOC004.pdf',
    docType: 'official_document',
    departmentId: 'DEPT001',
    businessTypeIds: [],
    version: '2024-v1',
    versionNote: '',
    versionGroupId: 'VG002',
    supersededBy: null,
    description: '信用部內部往來電子公文，部門全員可見',
    uploadedBy: '王經理',
    uploadedAt: '2024-03-05 10:30:00',
    updatedAt: '2024-03-05 10:30:00',
    status: DocumentStatus.READY,
    chunkCount: 12,
    deletedAt: null,
  },
  // ── VG003：農會信用部業務規章（單版）────────────────────────────────────────
  {
    id: 'DOC005',
    filename: '農會信用部業務規章.pdf',
    fileSize: 2048576,
    mimeType: 'application/pdf',
    fileUrl: '/files/knowledge/DOC005.pdf',
    docType: 'internal_regulation',
    departmentId: 'DEPT001',
    businessTypeIds: [],
    version: '2024-v2',
    versionNote: '',
    versionGroupId: 'VG003',
    supersededBy: null,
    description: '信用部相關業務操作規範與規章制度，部門全員可見',
    uploadedBy: '王經理',
    uploadedAt: '2024-01-15 09:00:00',
    updatedAt: '2024-02-01 14:00:00',
    status: DocumentStatus.READY,
    chunkCount: 48,
    deletedAt: null,
  },
  // ── VG004：放款作業手冊（單版，BT001 可見）──────────────────────────────────
  {
    id: 'DOC006',
    filename: '放款作業手冊.docx',
    fileSize: 786432,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileUrl: '/files/knowledge/DOC006.docx',
    docType: 'operation_manual',
    departmentId: 'DEPT001',
    businessTypeIds: ['BT001'],
    version: '2024-v1',
    versionNote: '',
    versionGroupId: 'VG004',
    supersededBy: null,
    description: '放款業務標準作業流程手冊（限放款業務承辦）',
    uploadedBy: '王經理',
    uploadedAt: '2024-01-20 10:30:00',
    updatedAt: '2024-01-20 10:30:00',
    status: DocumentStatus.READY,
    chunkCount: 30,
    deletedAt: null,
  },
  // ── VG005：存款開戶申請表（單版，BT002 可見）────────────────────────────────
  {
    id: 'DOC007',
    filename: '存款開戶申請表.pdf',
    fileSize: 153600,
    mimeType: 'application/pdf',
    fileUrl: '/files/knowledge/DOC007.pdf',
    docType: 'application_form',
    departmentId: 'DEPT001',
    businessTypeIds: ['BT002'],
    version: '2024-v1',
    versionNote: '',
    versionGroupId: 'VG005',
    supersededBy: null,
    description: '存款開戶標準申請表範本（限存款業務承辦）',
    uploadedBy: '王經理',
    uploadedAt: '2024-02-12 11:00:00',
    updatedAt: '2024-02-12 11:00:00',
    status: DocumentStatus.READY,
    chunkCount: 6,
    deletedAt: null,
  },
  // ── VG006：農產品銷售作業手冊（DEPT002 BT004）──────────────────────────────
  {
    id: 'DOC008',
    filename: '農產品銷售作業手冊.docx',
    fileSize: 655360,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileUrl: '/files/knowledge/DOC008.docx',
    docType: 'operation_manual',
    departmentId: 'DEPT002',
    businessTypeIds: ['BT004'],
    version: '2024-v1',
    versionNote: '',
    versionGroupId: 'VG006',
    supersededBy: null,
    description: '供銷部農產品銷售作業手冊（限農產品銷售承辦）',
    uploadedBy: '李主管',
    uploadedAt: '2024-02-10 11:00:00',
    updatedAt: '2024-02-10 11:00:00',
    status: DocumentStatus.READY,
    chunkCount: 24,
    deletedAt: null,
  },
  // ── VG007：人事管理辦法（DEPT004）───────────────────────────────────────────
  {
    id: 'DOC009',
    filename: '人事管理辦法.pdf',
    fileSize: 1024000,
    mimeType: 'application/pdf',
    fileUrl: '/files/knowledge/DOC009.pdf',
    docType: 'internal_regulation',
    departmentId: 'DEPT004',
    businessTypeIds: [],
    version: '2024-v1',
    versionNote: '',
    versionGroupId: 'VG007',
    supersededBy: null,
    description: '農會人事管理相關規定與辦法，人事部全員可見',
    uploadedBy: '林主管',
    uploadedAt: '2024-02-15 09:30:00',
    updatedAt: '2024-02-15 09:30:00',
    status: DocumentStatus.READY,
    chunkCount: 42,
    deletedAt: null,
  },
  // ── VG008：農業推廣教育訓練教材，status=PROCESSING ──────────────────────────
  {
    id: 'DOC010',
    filename: '農業推廣教育訓練教材.doc',
    fileSize: 3145728,
    mimeType: 'application/msword',
    fileUrl: '/files/knowledge/DOC010.doc',
    docType: 'operation_manual',
    departmentId: 'DEPT003',
    businessTypeIds: ['BT007'],
    version: '2024-v1',
    versionNote: '',
    versionGroupId: 'VG008',
    supersededBy: null,
    description: '農業推廣教育訓練使用教材（向量化處理中）',
    uploadedBy: '陳經理',
    uploadedAt: '2024-02-20 14:00:00',
    updatedAt: '2024-02-20 14:00:00',
    status: DocumentStatus.PROCESSING,
    chunkCount: 0,
    deletedAt: null,
  },
  // ── VG009：催收業務說明，status=ERROR ───────────────────────────────────────
  {
    id: 'DOC011',
    filename: '催收業務說明.txt',
    fileSize: 20480,
    mimeType: 'text/plain',
    fileUrl: '/files/knowledge/DOC011.txt',
    docType: 'application_form',
    departmentId: 'DEPT001',
    businessTypeIds: ['BT003'],
    version: '2024-v1',
    versionNote: '',
    versionGroupId: 'VG009',
    supersededBy: null,
    description: '催收業務申請說明文件（向量化失敗，需重新上傳）',
    uploadedBy: '王經理',
    uploadedAt: '2024-03-01 16:00:00',
    updatedAt: '2024-03-01 16:10:00',
    status: DocumentStatus.ERROR,
    chunkCount: 0,
    deletedAt: null,
  },
  // ── VG010：軟刪除示範（已停用，列表不顯示）─────────────────────────────────
  {
    id: 'DOC012',
    filename: '舊版農業金融法規2020.pdf',
    fileSize: 3670016,
    mimeType: 'application/pdf',
    fileUrl: '/files/knowledge/DOC012.pdf',
    docType: 'public_regulation',
    departmentId: null,
    businessTypeIds: [],
    version: '2020-v1',
    versionNote: '',
    versionGroupId: 'VG010',
    supersededBy: null,
    description: '舊版，已被管理員停用',
    uploadedBy: '系統管理員',
    uploadedAt: '2020-06-01 08:00:00',
    updatedAt: '2024-01-01 09:00:00',
    status: DocumentStatus.READY,
    chunkCount: 80,
    deletedAt: '2024-01-01 09:00:00',
  },

  // ── VG011：上傳中狀態示範（公開法規，全員可見，向量化未完成）─────────────
  {
    id: 'DOC013',
    filename: '農會年度業務報告草稿2026.pdf',
    fileSize: 2097152,
    mimeType: 'application/pdf',
    fileUrl: '/files/knowledge/DOC013.pdf',
    docType: 'public_regulation',
    departmentId: null,
    businessTypeIds: [],
    version: '2026-draft',
    versionNote: '',
    versionGroupId: 'VG011',
    supersededBy: null,
    description: '剛上傳、尚未開始向量化，示範「上傳中」狀態',
    uploadedBy: '系統管理員',
    uploadedAt: '2026-05-19 09:00:00',
    updatedAt: '2026-05-19 09:00:00',
    status: DocumentStatus.UPLOADING,
    chunkCount: 0,
    deletedAt: null,
  },
];

/** 產生不重複的新 mock ID（格式 DOCxxx） */
export function nextDocId(): string {
  const maxNum = mockDocuments.reduce((max, d) => {
    const n = parseInt(d.id.replace('DOC', ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `DOC${String(maxNum + 1).padStart(3, '0')}`;
}

/** 產生不重複的新 versionGroupId（格式 VGxxx） */
export function nextVgId(): string {
  const ids = mockDocuments
    .map((d) => parseInt(d.versionGroupId.replace('VG', ''), 10))
    .filter((n) => !isNaN(n));
  const max = ids.length > 0 ? Math.max(...ids) : 0;
  return `VG${String(max + 1).padStart(3, '0')}`;
}
