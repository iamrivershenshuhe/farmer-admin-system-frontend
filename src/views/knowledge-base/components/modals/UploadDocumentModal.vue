<template>
  <BaseModal
    v-model="isOpen"
    title="上傳文件"
    size="lg"
    confirm-text="確認上傳"
    :confirm-disabled="!isFormValid || isUploading"
    @confirm="handleSubmit"
    @close="handleClose"
  >
    <div class="upload-form">
      <!-- 拖曳區（多檔） -->
      <div
        class="drop-zone"
        :class="{ 'drop-zone-active': isDragging }"
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
          multiple
          @change="handleFileSelect"
        />
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
        <p class="drop-title">拖曳文件至此，或<span class="drop-link">點擊選取</span></p>
        <p class="drop-hint">支援 PDF、Word（doc/docx）、TXT，單檔上限 10 MB，可多選</p>
      </div>

      <!-- 待上傳清單 -->
      <div v-if="fileItems.length" class="file-list">
        <div v-for="(item, idx) in fileItems" :key="idx" class="file-card">
          <!-- 檔案列標題行 -->
          <div class="file-card-header">
            <span class="file-icon-sm" :class="iconClass(item.file.type)">
              {{ iconLabel(item.file.type) }}
            </span>
            <span class="file-card-name">{{ item.file.name }}</span>
            <span class="file-card-size">{{ formatFileSize(item.file.size) }}</span>
            <button class="file-remove-btn" @click="removeFile(idx)">
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
          <p v-if="item.error" class="file-error">{{ item.error }}</p>

          <!-- 每檔各自欄位 -->
          <div class="file-fields">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label required">文件類別</label>
                <select v-model="item.docType" class="form-select">
                  <option value="">請選擇類別</option>
                  <option v-for="o in docTypeOptions" :key="o.value" :value="o.value">
                    {{ o.label }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">版本</label>
                <input
                  v-model="item.version"
                  type="text"
                  class="form-input"
                  placeholder="如 2024-v1（選填）"
                />
              </div>
            </div>

            <div v-if="item.docType !== 'public_regulation'" class="form-row">
              <div class="form-group">
                <label class="form-label">所屬部門</label>
                <select
                  v-model="item.departmentId"
                  class="form-select"
                  @change="item.businessTypeIds = []"
                >
                  <option :value="null">全機關公開</option>
                  <option v-for="o in departmentOptions" :key="o.value" :value="o.value">
                    {{ o.label }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">所屬業務別</label>
                <div v-if="!item.departmentId" class="bt-hint">請先選擇所屬部門</div>
                <div v-else-if="!filteredBtOptions(item.departmentId).length" class="bt-hint">
                  此部門無業務別
                </div>
                <div v-else class="bt-checklist">
                  <label
                    v-for="o in filteredBtOptions(item.departmentId)"
                    :key="o.value"
                    class="bt-check"
                  >
                    <input
                      type="checkbox"
                      :value="o.value"
                      :checked="item.businessTypeIds.includes(o.value)"
                      @change="toggleBt(item, o.value)"
                    />
                    {{ o.label }}
                  </label>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">說明</label>
              <textarea
                v-model="item.description"
                class="form-textarea"
                rows="2"
                placeholder="選填，簡短描述文件內容"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import BaseModal from '@/components/base/BaseModal.vue';
import { fileTypeOf } from '@/constants/fileType';
import type {
  DocType,
  DocTypeOption,
  UploadDocumentItem,
  UploadKnowledgeDocumentRequest,
} from '@/types/knowledge';
import { nonEmptyString, required } from '@/utils/validators';

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
  docTypeOptions: DocTypeOption[];
  departmentOptions: SelectOption[];
  /** 全部業務別（含所屬部門 id），供每檔依其所屬部門連動過濾 */
  businessTypeOptions: BusinessTypeChoice[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', payload: UploadKnowledgeDocumentRequest): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'txt'];
const MAX_SIZE = 10 * 1024 * 1024;

interface FileItem {
  file: File;
  docType: DocType | '';
  version: string;
  departmentId: string | null;
  businessTypeIds: string[];
  description: string;
  error: string;
}

const isUploading = ref(false);
const isDragging = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const fileItems = ref<FileItem[]>([]);

const validateFile = (file: File): string => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXT.includes(ext)) return `不支援的格式（僅限 ${ALLOWED_EXT.join(' / ')}）`;
  if (file.size > MAX_SIZE) return '檔案超過 10 MB 上限';
  return '';
};

const makeItem = (file: File): FileItem => ({
  file,
  docType: '',
  version: '',
  departmentId: null,
  businessTypeIds: [],
  description: '',
  error: validateFile(file),
});

const addFiles = (files: FileList | File[]) => {
  const list = Array.from(files);
  for (const f of list) {
    if (!fileItems.value.some((i) => i.file.name === f.name && i.file.size === f.size)) {
      fileItems.value.push(makeItem(f));
    }
  }
};

const handleFileSelect = (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  if (files) addFiles(files);
  if (fileInputRef.value) fileInputRef.value.value = '';
};

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
};

const removeFile = (idx: number) => {
  fileItems.value.splice(idx, 1);
};

/** 過濾出屬於該部門的業務別選項；departmentId 為 null 時回傳空陣列 */
const filteredBtOptions = (departmentId: string | null): BusinessTypeChoice[] => {
  if (!departmentId) return [];
  return props.businessTypeOptions.filter((o) => o.departmentId === departmentId);
};

const toggleBt = (item: FileItem, id: string) => {
  item.businessTypeIds = item.businessTypeIds.includes(id)
    ? item.businessTypeIds.filter((x) => x !== id)
    : [...item.businessTypeIds, id];
};

// 規則集中於 utils/validators（ADR-0004）
const isFormValid = computed(
  () =>
    required(fileItems.value) === null &&
    fileItems.value.every((i) => !i.error && nonEmptyString(i.docType) === null)
);

const handleSubmit = () => {
  if (!isFormValid.value) return;
  const items: UploadDocumentItem[] = fileItems.value.map((i) => ({
    file: i.file,
    docType: i.docType as DocType,
    version: i.version || '',
    departmentId: i.docType === 'public_regulation' ? null : i.departmentId,
    businessTypeIds: i.docType === 'public_regulation' || !i.departmentId ? [] : i.businessTypeIds,
    description: i.description || undefined,
  }));
  emit('submit', { items });
  handleClose();
};

const handleClose = () => {
  fileItems.value = [];
  isDragging.value = false;
  isOpen.value = false;
};

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

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 6rem;
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

/* 清單 */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.file-card {
  padding: 0.875rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.file-card-header {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

/* 實心高對比檔案圖示 */
.file-icon-sm {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.875rem;
  height: 1.875rem;
  font-size: 0.5rem;
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

.file-card-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}

.file-card-size {
  font-size: 0.75rem;
  color: var(--text-3);
  white-space: nowrap;
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

.file-error {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  color: var(--error);
}

.file-fields {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

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

/* select 統一外觀：自繪箭頭，離右邊界 16px（與篩選列一致） */
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
}
</style>
