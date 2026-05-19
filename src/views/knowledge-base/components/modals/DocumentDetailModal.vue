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
      <template v-if="isEdit">
        <hr class="divider" />
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">文件類別</label>
            <select v-model="form.docType" class="form-select">
              <option v-for="o in docTypeOptions" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">版本</label>
            <input v-model="form.version" type="text" class="form-input" placeholder="如 2024-v1" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">所屬部門</label>
            <select v-model="form.departmentId" class="form-select" @change="onDepartmentChange">
              <option :value="null">全機關公開</option>
              <option v-for="o in departmentOptions" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">業務別</label>
            <div v-if="!form.departmentId" class="bt-hint">請先選擇所屬部門</div>
            <div v-else-if="!filteredBtOptions.length" class="bt-hint">此部門無業務別</div>
            <div v-else class="bt-checklist">
              <label v-for="o in filteredBtOptions" :key="o.value" class="bt-check">
                <input
                  type="checkbox"
                  :value="o.value"
                  :checked="form.businessTypeIds.includes(o.value)"
                  @change="toggleBt(o.value)"
                />
                {{ o.label }}
              </label>
            </div>
          </div>
        </div>

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
      docType: DocType;
      version: string;
      departmentId: string | null;
      businessTypeIds: string[];
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
  docType: 'internal_regulation' as DocType,
  version: '',
  departmentId: null as string | null,
  businessTypeIds: [] as string[],
  description: '',
});

watch(
  () => props.document,
  async (doc) => {
    isEdit.value = false;
    if (doc) {
      form.value = {
        docType: doc.docType,
        version: doc.version,
        departmentId: doc.departmentId,
        businessTypeIds: [...doc.businessTypeIds],
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

// 業務別依所選部門連動過濾
const filteredBtOptions = computed(() =>
  form.value.departmentId
    ? props.businessTypeOptions.filter((o) => o.departmentId === form.value.departmentId)
    : []
);

const onDepartmentChange = () => {
  form.value.businessTypeIds = [];
};

const toggleBt = (id: string) => {
  const list = form.value.businessTypeIds;
  form.value.businessTypeIds = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
};

const onConfirm = () => {
  if (!isEdit.value) {
    if (props.editable) isEdit.value = true;
    else isOpen.value = false;
    return;
  }
  if (!props.document) return;
  emit('save', props.document.id, {
    docType: form.value.docType,
    version: form.value.version,
    departmentId: form.value.docType === 'public_regulation' ? null : form.value.departmentId,
    businessTypeIds: form.value.businessTypeIds,
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
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

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

.form-label.required::after {
  color: var(--error);
  content: ' *';
}

.form-input,
.form-select,
.form-textarea {
  box-sizing: border-box;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: var(--text);
  background: var(--bg-1);
  border: 2px solid var(--border);
  border-radius: var(--r-md);
  transition: border-color 0.15s ease;
}

.form-input:hover,
.form-select:hover,
.form-textarea:hover {
  border-color: var(--border-strong);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.form-select {
  padding-right: 2.25rem;
  appearance: none;
  cursor: pointer;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--text-2) 50%),
    linear-gradient(135deg, var(--text-2) 50%, transparent 50%);
  background-repeat: no-repeat;
  background-position:
    right 16px center,
    right 11px center;
  background-size:
    5px 5px,
    5px 5px;
}

.form-textarea {
  font-family: inherit;
  resize: vertical;
}

.bt-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 7rem;
  padding: 0.5rem;
  overflow-y: auto;
  background: var(--bg-1);
  border: 2px solid var(--border);
  border-radius: var(--r-md);
}

.bt-check {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.8125rem;
  color: var(--text);
}

.bt-hint {
  display: flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0 0.875rem;
  font-size: 0.8125rem;
  color: var(--text-3);
  background: var(--bg-1);
  border: 2px dashed var(--border);
  border-radius: var(--r-md);
}

@media (width <= 767px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .kb-info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
