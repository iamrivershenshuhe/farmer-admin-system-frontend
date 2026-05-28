<template>
  <BaseModal
    v-model="isOpen"
    :title="isEdit ? '編輯文件資訊' : '文件詳情'"
    size="md"
    :confirm-text="isEdit ? '儲存' : editable ? '編輯' : '關閉'"
    :cancel-text="isEdit ? '取消' : '關閉'"
    @confirm="onConfirm"
    @close="handleClose"
  >
    <div v-if="document" class="detail-form">
      <!-- 資訊卡：檔案概要 -->
      <div class="info-card">
        <span class="file-icon-lg" :class="iconClass(document.mimeType)">
          {{ iconLabel(document.mimeType) }}
        </span>
        <div class="info-card-body">
          <p class="doc-name">{{ document.filename }}</p>
          <div class="meta-row">
            <span>{{ formatFileSize(document.fileSize) }}</span>
            <span class="dot">·</span>
            <span class="lbl" :class="statusLblClass(document.status)">{{
              statusLabel(document.status)
            }}</span>
            <span class="dot">·</span>
            <span>{{ document.chunkCount }} 個切片</span>
          </div>
          <p v-if="document.versionNote" class="version-note">{{ document.versionNote }}</p>
        </div>
      </div>

      <hr class="divider" />

      <!-- 資訊格（唯讀詳情；對齊樣板 .kb-info-grid） -->
      <div class="kb-info-grid">
        <div class="kb-info-item">
          <span class="kb-info-k">文件類別</span>
          <span class="kb-info-v">{{ docTypeLabel(document.docType) }}</span>
        </div>
        <div class="kb-info-item">
          <span class="kb-info-k">部門 / 業務別</span>
          <span class="kb-info-v">
            {{ deptLabel(document.departmentId) }}
            <template v-if="document.businessTypeIds.length">
              · {{ btLabel(document.businessTypeIds) }}
            </template>
          </span>
        </div>
        <div class="kb-info-item">
          <span class="kb-info-k">上傳者</span>
          <span class="kb-info-v">{{ document.uploadedBy }}</span>
        </div>
        <div class="kb-info-item">
          <span class="kb-info-k">上傳時間</span>
          <span class="kb-info-v">{{ formatDateFull(document.uploadedAt) }}</span>
        </div>
        <div class="kb-info-item">
          <span class="kb-info-k">最後更新</span>
          <span class="kb-info-v">{{ formatDateFull(document.updatedAt) }}</span>
        </div>
        <div v-if="document.description" class="kb-info-item kb-info-span">
          <span class="kb-info-k">說明</span>
          <span class="kb-info-v">{{ document.description }}</span>
        </div>
      </div>

      <!-- 編輯模式下的可編輯欄位 -->
      <!-- 後端 PUT /knowledge/documents/{id} 僅接受中繼資料；文件類別 / 版本 / 部門 / 業務別 -->
      <!-- 一經建檔即不可改（須以「上傳新版本」更換），故編輯表單不再提供這些欄位。 -->
      <template v-if="isEdit">
        <hr class="divider" />
        <div class="form-group">
          <label class="form-label">說明</label>
          <textarea v-model="form.description" class="form-textarea" rows="2" />
        </div>
      </template>

      <!-- 版本鏈區（唯讀模式顯示） -->
      <template v-if="!isEdit && (currentVersions.length > 1 || isLoadingVersions)">
        <hr class="divider" />
        <div class="kb-ver">
          <p class="ver-section-title">版本歷程（{{ currentVersions.length }} 版）</p>
          <div v-if="isLoadingVersions" class="ver-loading">載入中...</div>
          <div v-else class="ver-list">
            <div
              v-for="ver in currentVersions"
              :key="ver.id"
              class="kb-ver-item"
              :class="{ current: !ver.supersededBy }"
            >
              <div class="kb-ver-dot" />
              <div class="kb-ver-main">
                <p class="kb-ver-no">
                  {{ ver.version }}
                  <span v-if="!ver.supersededBy" class="ver-badge-current">目前版本</span>
                  <span v-else class="ver-badge-old">已淘汰</span>
                </p>
                <p v-if="ver.versionNote" class="kb-ver-note">{{ ver.versionNote }}</p>
                <p class="kb-ver-meta">
                  {{ formatDateFull(ver.uploadedAt) }} · {{ ver.uploadedBy }}
                </p>
              </div>
              <button
                v-if="ver.status === 'ready' && ver.fileUrl"
                class="ver-open-btn"
                @click="openFile(ver.fileUrl)"
              >
                開啟
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import BaseModal from '@/components/base/BaseModal.vue';
import { fileTypeOf } from '@/constants/fileType';
import { useKnowledgeStore } from '@/stores/knowledge';
import type { DocType, DocTypeOption, DocumentStatus, KnowledgeDocument } from '@/types/knowledge';
import { DOC_TYPE_LABELS, DOCUMENT_STATUS_LABELS } from '@/types/knowledge';

interface SelectOption {
  value: string;
  label: string;
}

interface BusinessTypeChoice {
  value: string;
  label: string;
  departmentId: string;
}

const props = defineProps<{
  modelValue: boolean;
  document: KnowledgeDocument | null;
  editable: boolean;
  /** 唯讀詳情顯示用；編輯模式不再提供可改下拉（後端忽略不可變欄位）。 */
  docTypeOptions: DocTypeOption[];
  departmentOptions: SelectOption[];
  businessTypeOptions: BusinessTypeChoice[];
  deptNameMap: Record<string, string>;
  btNameMap: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (
    e: 'save',
    id: string,
    data: {
      description: string;
    }
  ): void;
}>();

const knowledgeStore = useKnowledgeStore();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const isEdit = ref(false);
const isLoadingVersions = ref(false);

const currentVersions = computed(() => knowledgeStore.currentVersions);

const form = ref({
  description: '',
});

watch(
  () => props.document,
  async (doc) => {
    isEdit.value = false;
    if (doc) {
      form.value = {
        description: doc.description ?? '',
      };
      isLoadingVersions.value = true;
      try {
        await knowledgeStore.fetchDocument(doc.id);
      } finally {
        isLoadingVersions.value = false;
      }
    }
  },
  { immediate: true }
);

const docTypeLabel = (t: DocType) => DOC_TYPE_LABELS[t] ?? t;
const deptLabel = (id: string | null) => (id ? (props.deptNameMap[id] ?? id) : '全機關公開');
const btLabel = (ids: string[]) => ids.map((id) => props.btNameMap[id] ?? id).join('、');

const onConfirm = () => {
  if (!isEdit.value) {
    if (props.editable) isEdit.value = true;
    else isOpen.value = false;
    return;
  }
  if (!props.document) return;
  emit('save', props.document.id, {
    description: form.value.description,
  });
  isEdit.value = false;
  isOpen.value = false;
};

const handleClose = () => {
  isEdit.value = false;
};

const openFile = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const iconLabel = (mime: string) => fileTypeOf(mime).label;
const iconClass = (mime: string) => fileTypeOf(mime).cls;

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** YYYY-MM-DD HH:mm */
const formatDateFull = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day} ${h}:${min}`;
};

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
.detail-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* 資訊卡 */
.info-card {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
}

/* 實心高對比檔案圖示 */
.file-icon-lg {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  font-size: 0.6875rem;
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

.info-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

.doc-name {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text);
  word-break: break-all;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
  font-size: 0.8125rem;
  color: var(--text-2);
}

.dot {
  color: var(--border-strong);
}

.version-note {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--warning);
}

/* lbl 家族 */
.lbl {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
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

.divider {
  margin: 0;
  border: none;
  border-top: 1px solid var(--border);
}

/* 資訊格（對齊樣板 .kb-info-grid） */
.kb-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 1rem 1.5rem;
  padding: 1rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
}

.kb-info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.kb-info-span {
  grid-column: 1 / -1;
}

.kb-info-k {
  font-size: 0.75rem;
  color: var(--text-3);
}

.kb-info-v {
  font-size: 0.875rem;
  color: var(--text);
}

/* 版本鏈區 */
.ver-section-title {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.ver-loading {
  font-size: 0.875rem;
  color: var(--text-2);
}

.ver-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.kb-ver-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.kb-ver-item.current {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.kb-ver-dot {
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  margin-top: 0.3125rem;
  background: var(--text-3);
  border-radius: 50%;
}

.kb-ver-item.current .kb-ver-dot {
  background: var(--accent);
}

.kb-ver-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.2rem;
}

.kb-ver-no {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.ver-badge-current {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  margin-left: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: var(--r-pill);
}

.ver-badge-old {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  margin-left: 0.375rem;
  font-size: 0.6875rem;
  color: var(--text-3);
  background: var(--bg-2);
  border-radius: var(--r-pill);
}

.kb-ver-note {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-2);
}

.kb-ver-meta {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-3);
}

.ver-open-btn {
  flex-shrink: 0;
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
  color: var(--accent);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--accent);
  border-radius: var(--r-md);
}

.ver-open-btn:hover {
  color: #fff;
  background: var(--accent);
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

/* 編輯欄位 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
}

.form-textarea {
  box-sizing: border-box;
  padding: 0.625rem 0.875rem;
  font-family: inherit;
  font-size: 0.875rem;
  color: var(--text);
  resize: vertical;
  background: var(--bg-1);
  border: 2px solid var(--border);
  border-radius: var(--r-md);
  transition: border-color 0.15s ease;
}

.form-textarea:hover {
  border-color: var(--border-strong);
}

.form-textarea:focus {
  outline: none;
  border-color: var(--accent);
}

@media (width <= 767px) {
  .kb-info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
