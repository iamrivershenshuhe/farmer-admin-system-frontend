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
    <template #cell-department="{ row }">
      <span class="nowrap">{{
        deptNameMap[asBt(row).departmentId] ?? asBt(row).departmentId
      }}</span>
    </template>

    <template #cell-description="{ row }">
      <span>{{ asBt(row).description || '—' }}</span>
    </template>

    <template #cell-usageCount="{ row }">
      {{ asBt(row).usageCount ?? 0 }}
    </template>

    <template #cell-active="{ row }">
      <span class="lbl" :class="asBt(row).active ? 'lbl-accent' : 'lbl-error'">
        {{ asBt(row).active ? '啟用' : '停用' }}
      </span>
    </template>

    <template v-if="hasRowActions" #actions="{ row }">
      <button
        :ref="(el) => setAnchor(asBt(row).id, el as HTMLElement | null)"
        class="more-btn"
        @click.stop="toggle(asBt(row).id)"
      >
        ⋮
      </button>
      <DropdownMenu
        :items="menuItems(asBt(row))"
        :open="openId === asBt(row).id"
        :anchor="anchors[asBt(row).id] ?? null"
        @select="onSelect(asBt(row), $event)"
        @close="openId = null"
      />
    </template>

    <template #empty>
      <p class="empty">查無符合條件的業務別</p>
    </template>
  </BaseTable>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import BaseTable, { type BaseTableRow, type ColumnDef } from '@/components/base/BaseTable.vue';
import DropdownMenu from '@/components/common/DropdownMenu.vue';
import { ICONS } from '@/constants/icons';
import type { BusinessType } from '@/types/business-type';

type BusinessTypeRow = BusinessType & { usageCount?: number };

const props = defineProps<{
  businessTypes: BusinessTypeRow[];
  selectedIds?: string[];
  permissions: { canEdit: boolean; canDelete: boolean };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  deptNameMap: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'toggle-row', id: string): void;
  (e: 'toggle-all'): void;
  (e: 'sort', key: string): void;
  (e: 'edit', bt: BusinessType): void;
  (e: 'toggle-active', bt: BusinessType): void;
  (e: 'delete', bt: BusinessType): void;
}>();

const rows = computed(() => props.businessTypes as unknown as BaseTableRow[]);
const asBt = (r: BaseTableRow) => r as unknown as BusinessTypeRow;

const columns: ColumnDef[] = [
  { key: 'name', label: '業務別名稱', sortable: true, width: '200px' },
  { key: 'department', label: '所屬部門' },
  { key: 'description', label: '說明' },
  { key: 'usageCount', label: '使用人數' },
  { key: 'active', label: '狀態' },
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

const menuItems = (bt: BusinessTypeRow) => [
  ...(props.permissions.canEdit
    ? [
        { key: 'edit', label: '編輯業務別', icon: ICONS.EDIT },
        {
          key: 'toggle-active',
          label: bt.active ? '停用業務別' : '啟用業務別',
          icon: ICON_POWER,
        },
      ]
    : []),
  ...(props.permissions.canDelete
    ? [{ key: 'delete', label: '刪除', icon: ICONS.DELETE, danger: true }]
    : []),
];

const onSelect = (bt: BusinessType, key: string) => {
  openId.value = null;
  if (key === 'edit') emit('edit', bt);
  else if (key === 'toggle-active') emit('toggle-active', bt);
  else if (key === 'delete') emit('delete', bt);
};
</script>

<style scoped>
.nowrap {
  white-space: nowrap;
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
