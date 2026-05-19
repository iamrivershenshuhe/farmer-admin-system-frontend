import type { BusinessType, Department } from '@/types/department';

export const mockDepartments: Department[] = [
  {
    id: 'DEPT001',
    code: 'CR01',
    name: '信用部',
    managerName: '王經理',
    memberCount: 15,
    knowledgeBaseCount: 23,
    active: true,
    createdAt: '2024-01-15 08:00:00',
  },
  {
    id: 'DEPT002',
    code: 'SA01',
    name: '供銷部',
    managerName: '李主管',
    memberCount: 12,
    knowledgeBaseCount: 18,
    active: true,
    createdAt: '2024-01-15 08:00:00',
  },
  {
    id: 'DEPT003',
    code: 'PR01',
    name: '推廣部',
    managerName: '陳經理',
    memberCount: 8,
    knowledgeBaseCount: 15,
    active: true,
    createdAt: '2024-02-01 08:00:00',
  },
  {
    id: 'DEPT004',
    code: 'HR01',
    name: '人事部',
    managerName: '林主管',
    memberCount: 6,
    knowledgeBaseCount: 12,
    active: true,
    createdAt: '2024-02-01 08:00:00',
  },
  {
    id: 'DEPT005',
    code: 'IT01',
    name: '資訊部',
    managerName: undefined,
    memberCount: 5,
    knowledgeBaseCount: 8,
    active: false,
    createdAt: '2024-03-01 08:00:00',
  },
];

// 每個部門至少 2 個業務別；每部門第一個 BT 為 "已指派" (刪除封鎖測試用)
export const mockBusinessTypes: BusinessType[] = [
  // 信用部 (DEPT001)
  {
    id: 'BT001',
    departmentId: 'DEPT001',
    name: '放款業務',
    description: '辦理農業放款相關業務',
    active: true,
  },
  {
    id: 'BT002',
    departmentId: 'DEPT001',
    name: '存款業務',
    description: '辦理存款帳戶管理業務',
    active: true,
  },
  { id: 'BT003', departmentId: 'DEPT001', name: '催收業務', active: true },
  // 供銷部 (DEPT002)
  {
    id: 'BT004',
    departmentId: 'DEPT002',
    name: '農產品銷售',
    description: '農產品行銷與銷售',
    active: true,
  },
  {
    id: 'BT005',
    departmentId: 'DEPT002',
    name: '農資採購',
    description: '農業資材採購管理',
    active: true,
  },
  // 推廣部 (DEPT003)
  {
    id: 'BT006',
    departmentId: 'DEPT003',
    name: '農業推廣',
    description: '農業技術推廣服務',
    active: true,
  },
  {
    id: 'BT007',
    departmentId: 'DEPT003',
    name: '教育訓練',
    description: '農民教育訓練課程',
    active: true,
  },
  // 人事部 (DEPT004)
  {
    id: 'BT008',
    departmentId: 'DEPT004',
    name: '人員招募',
    description: '人員招募與甄選業務',
    active: true,
  },
  {
    id: 'BT009',
    departmentId: 'DEPT004',
    name: '薪資福利',
    description: '薪資計算與福利管理',
    active: true,
  },
  // 資訊部 (DEPT005)
  {
    id: 'BT010',
    departmentId: 'DEPT005',
    name: '系統維護',
    description: '資訊系統維護管理',
    active: true,
  },
  {
    id: 'BT011',
    departmentId: 'DEPT005',
    name: '資安管理',
    description: '資訊安全管理業務',
    active: true,
  },
];

// 每個部門第一個 BT 為已指派（用於測試刪除封鎖）
export const assignedBusinessTypeIds = new Set(['BT001', 'BT004', 'BT006', 'BT008', 'BT010']);
