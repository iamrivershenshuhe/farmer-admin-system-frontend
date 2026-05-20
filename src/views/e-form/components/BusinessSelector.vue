<template>
  <div class="business-selector">
    <!-- 部門 + 業務別：同列並排、皆常駐（對齊設計系統 .ef-row） -->
    <div class="ef-row">
      <div class="ef-field">
        <label class="ef-field-label">
          所屬部門
          <span v-if="isDeptLocked" class="ef-lock">
            ·
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 018 0v4" />
            </svg>
            系統預選鎖定
          </span>
        </label>
        <FilterSelect
          :model-value="effectiveDeptId"
          :options="deptSelectOptions"
          placeholder="請選擇部門"
          :disabled="isDeptLocked"
          @update:model-value="onDeptChange"
        />
      </div>
      <div class="ef-field">
        <label class="ef-field-label">業務別</label>
        <FilterSelect
          :model-value="selectedBusinessId"
          :options="businessSelectOptions"
          placeholder="請選擇業務別"
          :disabled="!effectiveDeptId || isBtLoading"
          @update:model-value="onBusinessChange"
        />
      </div>
    </div>

    <!-- 模板列表（選了業務別才顯示） -->
    <Transition name="slide-down">
      <div v-if="selectedBusinessId && availableTemplates.length > 0" class="templates-section">
        <div class="templates-header">
          <span class="templates-title">此業務別包含以下表單</span>
          <span class="templates-hint">請勾選本次需要產出的表單</span>
        </div>

        <div class="template-list">
          <label
            v-for="tmpl in availableTemplates"
            :key="tmpl.id"
            class="template-row"
            :class="{ 'template-checked': selectedTemplateIds.includes(tmpl.id) }"
          >
            <input
              type="checkbox"
              class="template-checkbox"
              :value="tmpl.id"
              :checked="selectedTemplateIds.includes(tmpl.id)"
              @change="onTemplateToggle(tmpl.id)"
            />
            <FileTypeBadge label="PDF" />
            <span class="template-name">{{ tmpl.pdfFileName }}</span>
            <span class="template-col">{{ selectedBusinessName }}</span>
            <span class="template-col template-col-fields">{{ tmpl.fields.length }} 個欄位</span>
          </label>
        </div>

        <p v-if="selectedTemplateIds.length === 0" class="no-selection-hint">
          請至少勾選一張表單才能繼續
        </p>
      </div>
    </Transition>

    <!-- 業務別有值但無模板（且非載入中） -->
    <div
      v-if="selectedBusinessId && !eformStore.isLoading && availableTemplates.length === 0"
      class="no-selection-hint"
    >
      此業務別目前無可用表單
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import FileTypeBadge from '@/components/common/FileTypeBadge.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import { useBusinessTypeStore } from '@/stores/business-type';
import { useDepartmentStore } from '@/stores/department';
import { useEFormStore } from '@/stores/eform';
import type { BusinessType } from '@/types/department';
import type { EFormTemplate } from '@/types/eform';
import { filterByFacet } from '@/utils/cascadeFilter';

interface Props {
  selectedBusinessId: string;
  selectedTemplateIds: string[];
  /** 是否為 admin（可選任意部門） */
  isAdmin: boolean;
  /** 是否為 manager（鎖定部門、可選全部業務別） */
  isManager: boolean;
  /** 使用者所屬部門 ID（user / manager 預選並鎖定） */
  userDepartmentId: string | null;
  /** 使用者被分配的業務別 ID 清單（user 限制選項） */
  userBusinessTypeIds: string[];
}

const props = withDefaults(defineProps<Props>(), {
  userDepartmentId: null,
  userBusinessTypeIds: () => [],
});

const emit = defineEmits<{
  (e: 'update:selectedBusinessId', id: string): void;
  (e: 'update:selectedTemplateIds', ids: string[]): void;
}>();

const departmentStore = useDepartmentStore();
const businessTypeStore = useBusinessTypeStore();
const eformStore = useEFormStore();

// admin 部門選取狀態（僅 admin 可修改）
const adminDeptId = ref('');

// ── 部門 ──────────────────────────────────────────────────

/** user/manager 鎖定部門選單 */
const isDeptLocked = computed(() => !props.isAdmin);

/** 目前生效的部門 ID */
const effectiveDeptId = computed(() =>
  props.isAdmin ? adminDeptId.value : (props.userDepartmentId ?? '')
);

/** 部門下拉選項（FilterSelect 格式） */
const deptSelectOptions = computed(() =>
  departmentStore.activeDepartments.map((d) => ({ value: d.id, label: d.name }))
);

// 非 admin 時，userDepartmentId 確定後自動載入業務別
watch(
  () => props.userDepartmentId,
  (deptId) => {
    if (!props.isAdmin && deptId) {
      businessTypeStore.fetchBusinessTypes(deptId);
    }
  },
  { immediate: true }
);

// ── 業務別 ────────────────────────────────────────────────

const isBtLoading = computed(() => {
  const deptId = effectiveDeptId.value;
  return deptId ? (businessTypeStore.isLoadingByDept[deptId] ?? false) : false;
});

/** 該部門下啟用的業務別原始清單 */
const deptBusinessTypes = computed((): BusinessType[] => {
  const deptId = effectiveDeptId.value;
  if (!deptId) return [];
  return (businessTypeStore.businessTypesByDept[deptId] ?? []).filter((b) => b.active);
});

/** 依角色過濾業務別選項 */
const businessTypeOptions = computed((): BusinessType[] => {
  if (props.isAdmin || props.isManager) {
    return deptBusinessTypes.value;
  }
  // user：僅被分配的業務別 ∩ 該部門業務別
  return filterByFacet(deptBusinessTypes.value, props.userBusinessTypeIds);
});

/** 業務別下拉選項（FilterSelect 格式） */
const businessSelectOptions = computed(() =>
  businessTypeOptions.value.map((b) => ({ value: b.id, label: b.name }))
);

/** 目前所選業務別名稱（表單清單欄位顯示用） */
const selectedBusinessName = computed(
  () => businessTypeOptions.value.find((b) => b.id === props.selectedBusinessId)?.name ?? ''
);

// ── 模板 ──────────────────────────────────────────────────

/** 當前業務別下的模板（由 eform store getter 計算） */
const availableTemplates = computed((): EFormTemplate[] => {
  if (!props.selectedBusinessId) return [];
  return eformStore.templatesByBusinessType(props.selectedBusinessId);
});

// ── 事件處理 ───────────────────────────────────────────────

function onDeptChange(deptId: string): void {
  adminDeptId.value = deptId;
  // 部門變更：清空下游選擇
  emit('update:selectedBusinessId', '');
  emit('update:selectedTemplateIds', []);
  if (deptId) {
    businessTypeStore.fetchBusinessTypes(deptId);
  }
}

async function onBusinessChange(btId: string): Promise<void> {
  emit('update:selectedBusinessId', btId);
  emit('update:selectedTemplateIds', []);
  if (btId) {
    await eformStore.fetchTemplates(btId);
  }
}

function onTemplateToggle(id: string): void {
  const current = [...props.selectedTemplateIds];
  const idx = current.indexOf(id);
  if (idx === -1) {
    current.push(id);
  } else {
    current.splice(idx, 1);
  }
  emit('update:selectedTemplateIds', current);
}
</script>

<style scoped>
.business-selector {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* --- 部門 / 業務別 同列（對齊設計系統 .ef-row） --- */
.ef-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.ef-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 240px;
}

.ef-field :deep(.filter-select) {
  width: 100%;
}

.ef-field-label {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  letter-spacing: 0.02em;
}

.ef-lock {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
  color: var(--text-3);
}

.ef-lock svg {
  width: 11px;
  height: 11px;
}

/* --- 模板列表 --- */
.templates-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.templates-header {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
}

.templates-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text);
}

.templates-hint {
  font-size: 0.8125rem;
  color: var(--text-2);
}

/* 單一容器、列以分隔線區隔（對齊 mockup .ef-tpllist） */
.template-list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.template-row {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  padding: 0.875rem 1.125rem;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--border);
}

.template-row:last-child {
  border-bottom: none;
}

.template-row:hover {
  background: var(--bg-hover);
  transition: background-color 0.15s ease;
}

.template-checked {
  background: var(--accent-soft);
}

.template-checkbox {
  flex-shrink: 0;
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--accent);
  cursor: pointer;
}

.template-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}

.template-col {
  flex-shrink: 0;
  font-size: 0.8125rem;
  color: var(--text-3);
}

.template-col-fields {
  width: 5rem;
  text-align: right;
}

.no-selection-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-3);
}

/* --- 動畫 --- */
.slide-down-enter-active,
.slide-down-leave-active {
  overflow: hidden;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (width <= 767px) {
  .ef-field {
    width: 100%;
  }
}
</style>
