<template>
  <BaseTable
    :columns="columns"
    :rows="rows"
    :selected-ids="selectedIds"
    :sort-by="sortBy"
    :sort-order="sortOrder"
    sticky-first-column
    empty-text=""
    @toggle-row="$emit('toggle-row', $event)"
    @toggle-all="$emit('toggle-all')"
    @sort="$emit('sort', $event)"
  >
    <template #cell-managerName="{ row }">
      <span class="nowrap">{{ asDept(row).managerName || '—' }}</span>
    </template>

    <template #cell-businessType="{ row }">
      <button class="org-count" data-tip="檢視該部門業務別" @click="$emit('drill', asDept(row))">
        {{ asDept(row).businessTypeCount ?? 0 }} 個 ›
      </button>
    </template>

    <template #cell-active="{ row }">
      <span class="lbl" :class="asDept(row).active ? 'lbl-accent' : 'lbl-error'">
        {{ asDept(row).active ? '啟用' : '停用' }}
      </span>
    </template>

    <template #cell-createdAt="{ row }">
      <span class="date-cell">{{ formatDate(asDept(row).createdAt) }}</span>
    </template>

    <template v-if="hasRowActions" #actions="{ row }">
      <button
        :ref="(el) => setAnchor(asDept(row).id, el as HTMLElement | null)"
        class="more-btn"
        @click.stop="toggle(asDept(row).id)"
      >
        ⋮
      </button>
      <DropdownMenu
        :items="menuItems(asDept(row))"
        :open="openId === asDept(row).id"
        :anchor="anchors[asDept(row).id] ?? null"
        @select="onSelect(asDept(row), $event)"
        @close="openId = null"
      />
    </template>

    <template #empty>
      <p class="empty">查無符合條件的部門</p>
    </template>
  </BaseTable>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import BaseTable, { type BaseTableRow, type ColumnDef } from '@/components/base/BaseTable.vue';
import DropdownMenu from '@/components/common/DropdownMenu.vue';
import { ICONS } from '@/constants/icons';
import type { Department } from '@/types/department';

/** 業務別數量欄需要的擴充欄位（後端列表回傳） */
type DepartmentRow = Department & { businessTypeCount?: number };

const props = defineProps<{
  departments: DepartmentRow[];
  selectedIds?: string[];
  permissions: { canEdit: boolean; canDelete: boolean };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}>();

const emit = defineEmits<{
  (e: 'toggle-row', id: string): void;
  (e: 'toggle-all'): void;
  (e: 'sort', key: string): void;
  (e: 'drill', dept: Department): void;
  (e: 'edit', dept: Department): void;
  (e: 'toggle-active', dept: Department): void;
  (e: 'delete', dept: Department): void;
}>();

const rows = computed(() => props.departments as unknown as BaseTableRow[]);
const asDept = (r: BaseTableRow) => r as unknown as DepartmentRow;

const columns: ColumnDef[] = [
  { key: 'code', label: '部門代碼', sortable: true, width: '120px' },
  { key: 'name', label: '部門名稱' },
  { key: 'managerName', label: '部門主管' },
  { key: 'memberCount', label: '人員數量' },
  { key: 'businessType', label: '業務別' },
  { key: 'knowledgeBaseCount', label: '知識庫文件' },
  { key: 'active', label: '狀態' },
  { key: 'createdAt', label: '建立時間', sortable: true },
];

const hasRowActions = computed(() => props.permissions.canEdit || props.permissions.canDelete);

const openId = ref<string | null>(null);
const anchors = ref<Record<string, HTMLElement>>({});
const setAnchor = (id: string, el: HTMLElement | null) => {
  if (el) anchors.value[id] = el;
};
const toggle = (id: string) => {
  openId.value = openId.value === id ? null : id;
};

const ICON_POWER = 'M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10';

const menuItems = (d: DepartmentRow) => [
  ...(props.permissions.canEdit
    ? [
        { key: 'edit', label: '編輯部門', icon: ICONS.EDIT },
        { key: 'toggle-active', label: d.active ? '停用部門' : '啟用部門', icon: ICON_POWER },
      ]
    : []),
  ...(props.permissions.canDelete
    ? [{ key: 'delete', label: '刪除', icon: ICONS.DELETE, danger: true }]
    : []),
];

const onSelect = (d: Department, key: string) => {
  openId.value = null;
  if (key === 'edit') emit('edit', d);
  else if (key === 'toggle-active') emit('toggle-active', d);
  else if (key === 'delete') emit('delete', d);
};

const formatDate = (s: string): string => {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
</script>

<style scoped>
.nowrap {
  white-space: nowrap;
}

.org-count {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 0.125rem 0.625rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
  background: var(--accent-soft);
  border: none;
  border-radius: var(--r-pill);
}

.org-count:hover {
  background: var(--bg-hover);
  transition: background-color 0.15s ease;
}

.lbl {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  border-radius: var(--r-pill);
}

.lbl-accent {
  color: var(--accent);
  background: var(--accent-soft);
}

.lbl-error {
  color: var(--error);
  background: var(--error-soft);
}

.date-cell {
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
  white-space: nowrap;
}

.more-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  font-size: 1.125rem;
  line-height: 1;
  color: var(--text-2);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--r-md);
}

.more-btn:hover {
  color: var(--text);
  background: var(--bg-hover);
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.empty {
  color: var(--text-2);
}
</style>
