<template>
  <BaseModal
    v-model="isOpen"
    title="上傳新版本"
    size="md"
    confirm-text="確認上傳"
    :confirm-disabled="!isFormValid || isUploading"
    @confirm="handleSubmit"
    @close="handleClose"
  >
    <div class="upload-form" v-if="document">
      <!-- 目標文件唯讀資訊 -->
      <div class="target-card">
        <span class="file-icon-sm" :class="iconClass(document.mimeType)">
          {{ iconLabel(document.mimeType) }}
        </span>
        <div class="target-info">
          <p class="target-name">{{ document.filename }}</p>
          <p class="target-meta">
            {{ docTypeLabel(document.docType) }}
            <template v-if="document.departmentId">
              · {{ deptNameMap[document.departmentId] ?? document.departmentId }}
            </template>
            <template v-if="document.businessTypeIds.length">
              · {{ btLabel(document.businessTypeIds) }}
            </template>
          </p>
        </div>
      </div>

      <!-- 新版本檔案選取 -->
      <div
        class="drop-zone"
        :class="{ 'drop-zone-active': isDragging, 'drop-zone-has-file': selectedFile }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        @click="fileInputRef?.click()"
      >
        <input
          ref="fileInputRef"
          type="file"
          class="file-input-hidden"
          accept=".pdf,.doc,.docx,.txt"
          @change="handleFileSelect"
        />

        <template v-if="!selectedFile">
          <div class="drop-zone-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p class="drop-title">拖曳新版文件至此，或<span class="drop-link">點擊選取</span></p>
          <p class="drop-hint">僅支援 PDF、Word（doc/docx）、TXT，單檔上限 10 MB</p>
        </template>

        <template v-else>
          <div class="file-preview">
            <span class="file-icon-sm" :class="iconClass(selectedFile.type)">
              {{ iconLabel(selectedFile.type) }}
            </span>
            <div class="file-preview-info">
              <p class="file-preview-name">{{ selectedFile.name }}</p>
              <p class="file-preview-size">{{ formatFileSize(selectedFile.size) }}</p>
            </div>
            <button class="file-remove-btn" @click.stop="removeFile">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </template>
      </div>

      <p v-if="fileError" class="file-error">{{ fileError }}</p>

      <!-- 版本號 + 版本說明 -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label required">版本號</label>
          <input v-model="form.version" type="text" class="form-input" placeholder="如 2024-v2" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label required">版本說明</label>
        <textarea
          v-model="form.versionNote"
          class="form-textarea"
          rows="3"
          placeholder="說明此版本與前版的差異"
        />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import BaseModal from '@/components/base/BaseModal.vue';
import { fileTypeOf } from '@/constants/fileType';
import type { KnowledgeDocument, UploadNewVersionRequest } from '@/types/knowledge';
import { DOC_TYPE_LABELS } from '@/types/knowledge';
import { nonEmptyString } from '@/utils/validators';

const props = defineProps<{
  modelValue: boolean;
  document: KnowledgeDocument | null;
  deptNameMap: Record<string, string>;
  btNameMap: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', payload: UploadNewVersionRequest): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'txt'];
const MAX_SIZE = 10 * 1024 * 1024;

const isUploading = ref(false);
const isDragging = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const fileError = ref('');
const form = ref({ version: '', versionNote: '' });

watch(
  () => props.modelValue,
  (open) => {
    if (!open) handleClose();
  }
);

const validateFile = (file: File): string => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXT.includes(ext)) return `不支援的格式（僅限 ${ALLOWED_EXT.join(' / ')}）`;
  if (file.size > MAX_SIZE) return '檔案超過 10 MB 上限';
  return '';
};

const setFile = (file: File) => {
  const err = validateFile(file);
  fileError.value = err;
  selectedFile.value = err ? null : file;
};

const handleFileSelect = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) setFile(file);
  if (fileInputRef.value) fileInputRef.value.value = '';
};

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) setFile(file);
};

const removeFile = () => {
  selectedFile.value = null;
  fileError.value = '';
};

// 規則集中於 utils/validators（ADR-0004）
const isFormValid = computed(
  () =>
    !!selectedFile.value &&
    !fileError.value &&
    nonEmptyString(form.value.version) === null &&
    nonEmptyString(form.value.versionNote) === null
);

const handleSubmit = () => {
  if (!isFormValid.value || !selectedFile.value || !props.document) return;
  emit('submit', {
    targetDocumentId: props.document.id,
    file: selectedFile.value,
    version: form.value.version.trim(),
    versionNote: form.value.versionNote.trim(),
  });
  handleClose();
};

const handleClose = () => {
  selectedFile.value = null;
  fileError.value = '';
  isDragging.value = false;
  form.value = { version: '', versionNote: '' };
  isOpen.value = false;
};

const docTypeLabel = (t: string) => DOC_TYPE_LABELS[t as keyof typeof DOC_TYPE_LABELS] ?? t;
const btLabel = (ids: string[]) => ids.map((id) => props.btNameMap[id] ?? id).join('、');

const iconLabel = (mime: string) => fileTypeOf(mime).label;
const iconClass = (mime: string) => fileTypeOf(mime).cls;
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
</script>

<style scoped>
.upload-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* 目標文件唯讀資訊卡 */
.target-card {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.875rem 1rem;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.target-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.target-name {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}

.target-meta {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-2);
}

/* 實心高對比檔案圖示 */
.file-icon-sm {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
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

/* 拖曳區 */
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 7rem;
  padding: 1.5rem;
  cursor: pointer;
  background: var(--bg-hover);
  border: 2px dashed var(--border);
  border-radius: var(--r-lg);
}

.drop-zone:hover,
.drop-zone-active {
  background: var(--accent-soft);
  border-color: var(--accent);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.drop-zone-has-file {
  background: var(--accent-soft);
  border-color: var(--accent);
  border-style: solid;
}

.file-input-hidden {
  display: none;
}

.drop-zone-icon svg {
  width: 2.25rem;
  height: 2.25rem;
  margin-bottom: 0.375rem;
  color: var(--text-3);
}

.drop-title {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-2);
}

.drop-link {
  margin-left: 0.25rem;
  color: var(--accent);
}

.drop-hint {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--text-3);
}

.file-error {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--error);
}

.file-preview {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  width: 100%;
}

.file-preview-info {
  flex: 1;
  min-width: 0;
}

.file-preview-name {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}

.file-preview-size {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-2);
}

.file-remove-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  color: var(--text-2);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--r-sm);
}

.file-remove-btn:hover {
  color: var(--error);
  background: var(--error-soft);
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.file-remove-btn svg {
  width: 0.875rem;
  height: 0.875rem;
}

/* 表單欄位 */
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
.form-textarea:hover {
  border-color: var(--border-strong);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--accent);
}

.form-textarea {
  font-family: inherit;
  resize: vertical;
}

@media (width <= 767px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
