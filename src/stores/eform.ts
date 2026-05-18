import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { GetSessionsParams } from '@/api/form';
import { generateBatch, getSessions, getTemplates } from '@/api/form';
import { FIELD_DEF_MAP } from '@/config/eform';
import type { PaginationResponse } from '@/types/api';
import type {
  ApplicantFieldDef,
  EFormTemplate,
  FormFieldCoord,
  FormSessionRecord,
  GeneratePdfResult,
} from '@/types/form';

export const useEFormStore = defineStore('eform', () => {
  // State

  /** 已載入的模板清單（平坦，不再按業務別分組；分組由組織 store 負責） */
  const templates = ref<EFormTemplate[]>([]);
  /** 歷程列表（無限滾動：fetchSessions 初次載入覆蓋，loadMoreSessions 追加） */
  const sessions = ref<FormSessionRecord[]>([]);
  /** 歷程分頁狀態 */
  const sessionPagination = ref<Omit<PaginationResponse<unknown>, 'items'>>({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  });
  const isLoading = ref(false);
  const isSessionLoading = ref(false);

  // Getters

  /** 依業務別 ID 取得該業務別下的模板清單 */
  const templatesByBusinessType = computed(
    () => (businessTypeId: string) =>
      templates.value.filter((t) => t.businessTypeId === businessTypeId && t.active)
  );

  /** 取得指定模板物件 */
  const getTemplate = computed(
    () =>
      (templateId: string): EFormTemplate | undefined =>
        templates.value.find((t) => t.id === templateId)
  );

  /**
   * 依選取的模板 IDs 計算聯集欄位
   * 任一表單 required → 聯集亦 required；依 FIELD_DEF_MAP 排序
   */
  const getUnionFields = computed(() => (templateIds: string[]): ApplicantFieldDef[] => {
    const allFields: FormFieldCoord[] = [];
    for (const tmpl of templates.value) {
      if (templateIds.includes(tmpl.id)) {
        allFields.push(...tmpl.fields);
      }
    }

    const unionMap = new Map<string, ApplicantFieldDef>();
    for (const f of allFields) {
      const existing = unionMap.get(f.fieldKey);
      const def = FIELD_DEF_MAP[f.fieldKey] ?? {
        key: f.fieldKey,
        label: f.label,
        type: 'text' as const,
      };
      if (existing) {
        if (f.required) existing.required = true;
      } else {
        unionMap.set(f.fieldKey, { ...def, required: f.required });
      }
    }

    const ORDER = Object.keys(FIELD_DEF_MAP);
    return [...unionMap.values()].sort((a, b) => {
      const ai = ORDER.indexOf(a.key);
      const bi = ORDER.indexOf(b.key);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  });

  /** 是否還有下一頁（供無限滾動判斷） */
  const hasMoreSessions = computed(
    () => sessionPagination.value.page < sessionPagination.value.totalPages
  );

  // Actions

  /** 載入指定業務別的模板清單 */
  async function fetchTemplates(businessTypeId: string): Promise<void> {
    isLoading.value = true;
    try {
      const res = await getTemplates(businessTypeId);
      // 合併而不覆蓋：保留其他業務別已載入的模板
      const incoming = res.data;
      const existingIds = new Set(templates.value.map((t) => t.id));
      for (const t of incoming) {
        if (!existingIds.has(t.id)) {
          templates.value.push(t);
        }
      }
    } finally {
      isLoading.value = false;
    }
  }

  /** 初次載入歷程（覆蓋 sessions，重設分頁） */
  async function fetchSessions(params: Omit<GetSessionsParams, 'page'>): Promise<void> {
    isSessionLoading.value = true;
    try {
      const res = await getSessions({ ...params, page: 1 });
      const { items, ...pagination } = res.data;
      sessions.value = items;
      sessionPagination.value = pagination;
    } finally {
      isSessionLoading.value = false;
    }
  }

  /** 載入下一頁歷程（追加到 sessions，供無限滾動） */
  async function loadMoreSessions(params: Omit<GetSessionsParams, 'page'>): Promise<void> {
    if (!hasMoreSessions.value || isSessionLoading.value) return;
    isSessionLoading.value = true;
    try {
      const nextPage = sessionPagination.value.page + 1;
      const res = await getSessions({ ...params, page: nextPage });
      const { items, ...pagination } = res.data;
      sessions.value.push(...items);
      sessionPagination.value = pagination;
    } finally {
      isSessionLoading.value = false;
    }
  }

  /** 批次生成 PDF，後端同時寫入 session */
  async function generateBatchPdfs(payload: {
    templateIds: string[];
    businessTypeId: string;
    businessTypeName: string;
    applicantData: Record<string, string>;
  }): Promise<GeneratePdfResult> {
    const res = await generateBatch(payload);
    return res.data;
  }

  return {
    // State
    templates,
    sessions,
    sessionPagination,
    isLoading,
    isSessionLoading,
    // Getters
    templatesByBusinessType,
    getTemplate,
    getUnionFields,
    hasMoreSessions,
    // Actions
    fetchTemplates,
    fetchSessions,
    loadMoreSessions,
    generateBatchPdfs,
  };
});
