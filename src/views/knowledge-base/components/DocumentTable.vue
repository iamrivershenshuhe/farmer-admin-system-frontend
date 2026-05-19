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
    <!-- 文件（檔名 + 圖示；點擊開詳情） -->
    <template #cell-filename="{ row }">
      <button class="filename-cell" @click="$emit('detail', asDoc(row))">
        <span class="file-icon" :class="iconClass(asDoc(row).mimeType)">
          {{ iconLabel(asDoc(row).mimeType) }}
        </span>
        <span class="filename-text">{{ asDoc(row).filename }}</span>
      </button>
    </template>

    <!-- 類別：純文字 -->
    <template #cell-docType="{ row }">
      <span class="plain-text">{{ docTypeLabel(asDoc(row).docType) }}</span>
    </template>

    <!-- 部門 -->
    <template #cell-department="{ row }">
      <span class="nowrap">{{ deptLabel(asDoc(row).departmentId) }}</span>
    </template>

    <!-- 業務別 -->
    <template #cell-businessType="{ row }">
      <span class="nowrap">{{
        asDoc(row).businessTypeIds.length ? btLabel(asDoc(row).businessTypeIds) : '—'
      }}</span>
    </template>

    <!-- 大小 -->
    <template #cell-fileSize="{ row }">
      {{ formatFileSize(asDoc(row).fileSize) }}
    </template>

    <!-- 狀態：lbl 家族語意 -->
    <template #cell-status="{ row }">
      <span class="lbl" :class="statusLblClass(asDoc(row).status)">
        {{ statusLabel(asDoc(row).status) }}
      </span>
    </template>

    <!-- 版本：僅顯目前版號（共幾版於詳情查看） -->
    <template #cell-version="{ row }">
      <span class="nowrap">{{ asDoc(row).version }}</span>
    </template>

    <!-- 上傳時間 -->
    <template #cell-uploadedAt="{ row }">
      <span class="date-cell">{{ formatDateShort(asDoc(row).uploadedAt) }}</span>
    </template>

    <!-- 更新時間 -->
    <template #cell-updatedAt="{ row }">
      <span class="date-cell">{{ formatDateShort(asDoc(row).updatedAt) }}</span>
    </template>

    <!-- 操作：單一 ⋮ 按鈕 + DropdownMenu -->
    <template #actions="{ row }">
      <button
        :ref="(el) => setMenuAnchor(asDoc(row).id, el as HTMLElement | null)"
        class="more-btn"
        @click.stop="toggleMenu(asDoc(row).id)"
      >
        ⋮
      </button>
      <DropdownMenu
        :items="menuItems(asDoc(row))"
        :open="openMenuId === asDoc(row).id"
        :anchor="menuAnchors[asDoc(row).id] ?? null"
        align="right"
        @select="handleMenuSelect(asDoc(row), $event)"
        @close="openMenuId = null"
      />
    </template>

    <template #empty>
      <div class="empty-state">
        <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p>查無符合條件的文件</p>
      </div>
    </template>
  </BaseTable>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import BaseTable, { type BaseTableRow, type ColumnDef } from '@/components/base/BaseTable.vue';
import DropdownMenu from '@/components/common/DropdownMenu.vue';
import { fileTypeOf } from '@/constants/fileType';
import type { DocType, DocumentStatus, KnowledgeDocument } from '@/types/knowledge';
import { DOC_TYPE_LABELS, DOCUMENT_STATUS_LABELS } from '@/types/knowledge';

const props = defineProps<{
  documents: KnowledgeDocument[];
  selectedIds?: string[];
  permissions: { canEdit: boolean; canDelete: boolean };
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  deptNameMap: Record<string, string>;
  btNameMap: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'toggle-row', id: string): void;
  (e: 'toggle-all'): void;
  (e: 'sort', key: string): void;
  (e: 'detail', doc: KnowledgeDocument): void;
  (e: 'preview', doc: KnowledgeDocument): void;
  (e: 'edit', doc: KnowledgeDocument): void;
  (e: 'delete', doc: KnowledgeDocument): void;
  (e: 'upload-version', doc: KnowledgeDocument): void;
}>();

const rows = computed(() => props.documents as unknown as BaseTableRow[]);
const asDoc = (r: BaseTableRow) => r as unknown as KnowledgeDocument;

const columns: ColumnDef[] = [
  { key: 'filename', label: '文件', sortable: true, width: '280px' },
  { key: 'docType', label: '類別' },
  { key: 'department', label: '部門' },
  { key: 'businessType', label: '業務別' },
  { key: 'fileSize', label: '大小' },
  { key: 'status', label: '狀態' },
  { key: 'version', label: '版本' },
  { key: 'uploadedAt', label: '上傳時間', sortable: true },
  { key: 'updatedAt', label: '更新時間', sortable: true },
];

// ── 選單邏輯 ──────────────────────────────────────────────────────
const openMenuId = ref<string | null>(null);
const menuAnchors = ref<Record<string, HTMLElement>>({});

const setMenuAnchor = (id: string, el: HTMLElement | null) => {
  if (el) menuAnchors.value[id] = el;
};

const toggleMenu = (id: string) => {
  openMenuId.value = openMenuId.value === id ? null : id;
};

const ICON_OPEN = 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14';
const ICON_UPLOAD_VER = 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12';
const ICON_EDIT =
  'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
const ICON_DELETE =
  'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16';

const menuItems = (doc: KnowledgeDocument) => {
  const canOpen = doc.status === 'ready' && !!doc.fileUrl;
  return [
    { key: 'preview', label: '開啟原始檔', icon: ICON_OPEN, disabled: !canOpen },
    ...(props.permissions.canEdit
      ? [{ key: 'upload-version', label: '上傳新版', icon: ICON_UPLOAD_VER }]
      : []),
    ...(props.permissions.canEdit ? [{ key: 'edit', label: '編輯資訊', icon: ICON_EDIT }] : []),
    ...(props.permissions.canDelete
      ? [{ key: 'delete', label: '刪除', icon: ICON_DELETE, danger: true }]
      : []),
  ];
};

const handleMenuSelect = (doc: KnowledgeDocument, key: string) => {
  openMenuId.value = null;
  if (key === 'preview') emit('preview', doc);
  else if (key === 'upload-version') emit('upload-version', doc);
  else if (key === 'edit') emit('edit', doc);
  else if (key === 'delete') emit('delete', doc);
};

// ── 顯示 helpers ──────────────────────────────────────────────────
const docTypeLabel = (t: DocType) => DOC_TYPE_LABELS[t] ?? t;
const deptLabel = (id: string | null) => (id ? (props.deptNameMap[id] ?? id) : '全機關公開');
const btLabel = (ids: string[]) => ids.map((id) => props.btNameMap[id] ?? id).join('、');

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** YYYY-MM-DD（不依賴 locale 避免環境差異） */
const formatDateShort = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const iconLabel = (mime: string) => fileTypeOf(mime).label;
const iconClass = (mime: string) => fileTypeOf(mime).cls;

// 標籤文字用集中來源 DOCUMENT_STATUS_LABELS；樣式類別屬呈現層保留本地
const STATUS_CLS: Record<string, string> = {
  ready: 'lbl-accent',
  uploading: 'lbl-default',
  processing: 'lbl-warning',
  error: 'lbl-error',
};
const statusLabel = (s: string) => DOCUMENT_STATUS_LABELS[s as DocumentStatus] ?? s;
const statusLblClass = (s: string) => STATUS_CLS[s] ?? 'lbl-default';
</script>

<style scoped>
/* 檔案圖示：實心高對比白字，近方形 --r-xs */
.file-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.125rem;
  height: 2.125rem;
  font-size: 0.5625rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.04em;
  border-radius: var(--r-xs);
}

.icon-pdf {
  background: #c0392b;
}

.icon-word {
  background: #1d4ed8;
}

.icon-txt,
.icon-default {
  background: #475569;
}

.filename-cell {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  width: 100%;
  padding: 0;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
}

.filename-text {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}

.filename-cell:hover .filename-text {
  color: var(--accent);
  transition: color 0.15s ease;
}

.plain-text {
  color: var(--text);
}

.nowrap {
  white-space: nowrap;
}

/* lbl 家族：設計系統語意標籤 */
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

.lbl-default {
  color: var(--text-2);
  background: var(--bg-2);
}

.date-cell {
  font-variant-numeric: tabular-nums;
  color: var(--text-2);
  white-space: nowrap;
}

/* 操作按鈕：純文字 ⋮，透明底 hover --bg-hover */
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

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  color: var(--text-2);
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  opacity: 0.4;
}
</style>
