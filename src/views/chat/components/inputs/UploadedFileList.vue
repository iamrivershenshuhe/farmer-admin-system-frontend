<script setup lang="ts">
import { ICONS } from '@/constants';
import type { UploadedFile } from '@/types/upload';

interface Props {
  files: UploadedFile[];
}

defineProps<Props>();

const emit = defineEmits<{
  remove: [fileId: string];
}>();

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round(bytes / Math.pow(k, i))} ${sizes[i]}`;
};

/**
 * 處理移除文件
 */
const handleRemove = (fileId: string): void => {
  emit('remove', fileId);
};
</script>

<template>
  <div v-if="files.length > 0" class="uploaded-file-list">
    <div v-for="file in files" :key="file.id" class="file-item" :title="file.name">
      <!-- 文件名（頂部） -->
      <div class="file-name">{{ file.name }}</div>

      <!-- 底部區域：圖標 + 大小 + 狀態 + 刪除按鈕 -->
      <div class="file-footer">
        <!-- 左側：圖標 + 大小 -->
        <div class="file-meta-left">
          <svg class="icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              :d="ICONS.DOCUMENT"
            />
          </svg>
          <span class="file-size">{{ formatFileSize(file.size) }}</span>
        </div>

        <!-- 右側：狀態 + 刪除按鈕 -->
        <div class="file-meta-right">
          <!-- 上傳進度 -->
          <span v-if="file.status === 'uploading'" class="file-progress">
            {{ file.progress }}%
          </span>

          <!-- 錯誤信息 -->
          <span v-if="file.status === 'error'" class="file-error">
            {{ file.error || '上傳失敗' }}
          </span>

          <!-- 狀態指示器 -->
          <div v-if="file.status !== 'pending'" class="file-status">
            <!-- 上傳中 -->
            <svg
              v-if="file.status === 'uploading'"
              class="status-icon loading"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
                fill="none"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>

            <!-- 成功 -->
            <svg
              v-else-if="file.status === 'success'"
              class="status-icon success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="ICONS.CHECK"
              />
            </svg>

            <!-- 錯誤 -->
            <svg
              v-else-if="file.status === 'error'"
              class="status-icon error"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="ICONS.ERROR"
              />
            </svg>
          </div>

          <!-- 移除按鈕 -->
          <button class="remove-button" title="移除" @click="handleRemove(file.id)">
            <svg class="remove-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="ICONS.CLOSE"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- 進度條 -->
      <div v-if="file.status === 'uploading'" class="progress-bar">
        <div class="progress-fill" :style="{ width: `${file.progress}%` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========== 文件列表容器 ========== */
.uploaded-file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  width: 100%;
  max-width: 52rem;
  margin: 0 auto 0.75rem;

  /* 移除 padding，避免位移 */
}

/* ========== 文件項 ========== */
.file-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: calc(25% - 0.5625rem);

  /* 1/4 寬度，減去 gap */
  min-width: 200px;
  padding: 0.75rem;
  cursor: default;
  background-color: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  transition: all 0.2s;
}

.file-item:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

/* ========== 文件名 ========== */
.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--text);
  white-space: nowrap;
}

/* ========== 底部區域 ========== */
.file-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.file-meta-left {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.icon-svg {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  color: var(--text-2);
}

.file-size {
  font-size: 0.75rem;
  color: var(--text-2);
}

.file-meta-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.file-progress {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--accent);
}

.file-error {
  font-size: 0.75rem;
  color: var(--error);
}

/* ========== 進度條 ========== */
.progress-bar {
  width: 100%;
  height: 0.25rem;
  overflow: hidden;
  background-color: var(--bg-hover);
  border-radius: 9999px;
}

.progress-fill {
  height: 100%;
  background-color: var(--accent);
  border-radius: 9999px;
  transition: width 0.3s ease;
}

/* ========== 狀態指示器 ========== */
.file-status {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.status-icon {
  width: 1rem;
  height: 1rem;
}

.status-icon.loading {
  color: var(--accent);
  animation: spin 1s linear infinite;
}

.status-icon.success {
  color: var(--success);
}

.status-icon.error {
  color: var(--error);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ========== 移除按鈕 ========== */
.remove-button {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  color: var(--text-3);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: var(--r-md);
  transition: all 0.2s;
}

.remove-icon {
  width: 0.875rem;
  height: 0.875rem;
}

/* ========== 響應式設計 ========== */
@media (width <=768px) {
  .uploaded-file-list {
    padding: 0 0.75rem;
  }

  .file-item {
    width: calc(50% - 0.375rem);

    /* 小屏幕顯示 2 列 */
    min-width: 150px;
  }
}

@media (width <=480px) {
  .file-item {
    width: 100%;

    /* 超小屏幕顯示 1 列 */
  }
}
</style>
