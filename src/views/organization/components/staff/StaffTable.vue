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
    <template #cell-name="{ row }">
      <span class="nowrap">{{ asUser(row).name || '—' }}</span>
    </template>

    <template #cell-department="{ row }">
      <span class="nowrap">{{ asUser(row).department || '—' }}</span>
    </template>

    <template #cell-businessRange="{ row }">
      <span>{{ btLabel(asUser(row).businessTypeIds) }}</span>
    </template>

    <template #cell-role="{ row }">
      <span class="lbl" :class="roleClass(asUser(row).role)">
        {{ ROLE_LABELS[asUser(row).role] }}
      </span>
    </template>

    <template #cell-active="{ row }">
      <span class="lbl" :class="asUser(row).active ? 'lbl-accent' : 'lbl-error'">
        {{ asUser(row).active ? '啟用' : '停用' }}
      </span>
    </template>

    <template #cell-createdAt="{ row }">
      <span class="date-cell">{{ formatDate(asUser(row).createdAt) }}</span>
    </template>

    <template v-if="hasRowActions" #actions="{ row }">
      <button
        :ref="(el) => setAnchor(asUser(row).id, el as HTMLElement | null)"
        class="more-btn"
        @click.stop="toggle(asUser(row).id)"
      >
        ⋮
      </button>
      <DropdownMenu
        :items="menuItems(asUser(row))"
        :open="openId === asUser(row).id"
        :anchor="anchors[asUser(row).id] ?? null"
        @select="onSelect(asUser(row), $event)"
        @close="openId = null"
      />
    </template>

    <template #empty>
      <p class="empty">查無符合條件的人員</p>
    </template>
  </BaseTable>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import BaseTable, { type BaseTableRow, type ColumnDef } from '@/components/base/BaseTable.vue';
import DropdownMenu from '@/components/common/DropdownMenu.vue';
import { ICONS } from '@/constants/icons';
import type { UserInfo, UserRole } from '@/types/user';
import { ROLE_LABELS } from '@/types/user';

const props = defineProps<{
  users: UserInfo[];
  selectedIds?: string[];
  permissions: { canEdit: boolean; canDelete: boolean; canManage: boolean };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  btNameMap: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'toggle-row', id: string): void;
  (e: 'toggle-all'): void;
  (e: 'sort', key: string): void;
  (e: 'edit', user: UserInfo): void;
  (e: 'change-role', user: UserInfo): void;
  (e: 'reset-password', user: UserInfo): void;
  (e: 'toggle-active', user: UserInfo): void;
  (e: 'delete', user: UserInfo): void;
}>();

const rows = computed(() => props.users as unknown as BaseTableRow[]);
const asUser = (r: BaseTableRow) => r as unknown as UserInfo;

const columns: ColumnDef[] = [
  { key: 'username', label: '帳號', sortable: true, width: '140px' },
  { key: 'name', label: '姓名' },
  { key: 'department', label: '部門' },
  { key: 'businessRange', label: '業務範圍' },
  { key: 'role', label: '角色' },
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

const ICON_ROLE = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
const ICON_KEY =
  'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z';
const ICON_POWER = 'M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10';

const menuItems = (u: UserInfo) => [
  ...(props.permissions.canEdit ? [{ key: 'edit', label: '編輯資料', icon: ICONS.EDIT }] : []),
  ...(props.permissions.canManage
    ? [
        { key: 'change-role', label: '變更角色', icon: ICON_ROLE },
        { key: 'reset-password', label: '重設密碼', icon: ICON_KEY },
      ]
    : []),
  ...(props.permissions.canEdit
    ? [{ key: 'toggle-active', label: u.active ? '停用帳號' : '啟用帳號', icon: ICON_POWER }]
    : []),
  ...(props.permissions.canDelete
    ? [{ key: 'delete', label: '刪除', icon: ICONS.DELETE, danger: true }]
    : []),
];

const onSelect = (u: UserInfo, key: string) => {
  openId.value = null;
  if (key === 'edit') emit('edit', u);
  else if (key === 'change-role') emit('change-role', u);
  else if (key === 'reset-password') emit('reset-password', u);
  else if (key === 'toggle-active') emit('toggle-active', u);
  else if (key === 'delete') emit('delete', u);
};

const ROLE_CLASS: Record<UserRole, string> = {
  admin: 'lbl-accent',
  manager: 'lbl-warning',
  user: 'lbl-info',
};
const roleClass = (r: UserRole) => ROLE_CLASS[r] ?? 'lbl-default';

const btLabel = (ids?: string[]) =>
  ids && ids.length ? ids.map((id) => props.btNameMap[id] ?? id).join('、') : '—';

const formatDate = (s?: string): string => {
  if (!s) return '—';
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

.lbl-warning {
  color: var(--warning);
  background: var(--warning-soft);
}

.lbl-error {
  color: var(--error);
  background: var(--error-soft);
}

.lbl-info {
  color: var(--info);
  background: rgb(37 99 235 / 14%);
}

.lbl-default {
  color: var(--text-2);
  background: var(--bg-2);
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
