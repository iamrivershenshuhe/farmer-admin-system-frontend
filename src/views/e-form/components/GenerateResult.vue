<template>
  <div class="generate-result">
    <!-- 成功橫幅 -->
    <div class="success-banner">
      <div class="success-icon-wrap">
        <svg class="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <div>
        <p class="success-title">表單已生成完成</p>
        <p class="success-sub">
          共生成 {{ generatedFiles.length }} 份表單 ·
          <span class="business-badge">{{ businessTypeName }}</span>
        </p>
      </div>
    </div>

    <!-- 填寫摘要（kb-info-grid 風格鍵值） -->
    <div class="info-summary">
      <div class="summary-title">已填入資訊摘要</div>
      <div class="summary-grid">
        <div v-for="(val, key) in filledData" :key="key" class="summary-item">
          <span class="summary-key">{{ labelOf(String(key)) }}</span>
          <span class="summary-val">{{ val }}</span>
        </div>
      </div>
    </div>

    <!-- 到期提示 -->
    <div v-if="expiresAt" class="expires-notice">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="expires-icon">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      下載連結將於 {{ formatExpiry(expiresAt) }} 後失效，請盡速下載
    </div>

    <!-- 生成的表單下載列 -->
    <div class="files-list">
      <div class="files-header">
        <span class="files-title">生成的表單檔案</span>
        <BaseButton variant="primary" size="md" @click="handleDownloadAll">
          全部下載 ZIP
        </BaseButton>
      </div>

      <div class="file-items">
        <div v-for="file in generatedFiles" :key="file.templateId" class="file-row">
          <!-- 左：PDF 章 + 檔名 -->
          <div class="file-left">
            <FileTypeBadge label="PDF" />
            <span class="file-filename">{{ file.filename }}</span>
          </div>
          <!-- 右：預覽（文字）+ 下載（外框 pill） -->
          <div class="file-actions">
            <BaseButton variant="ghost" size="md" @click="handlePreview(file)"> 預覽 </BaseButton>
            <BaseButton variant="outline" size="md" @click="handleDownload(file)">
              下載
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseButton from '@/components/base/BaseButton.vue';
import FileTypeBadge from '@/components/common/FileTypeBadge.vue';
import type { GeneratedFile } from '@/types/form';

const LABEL_MAP: Record<string, string> = {
  applicant_name: '申請人姓名',
  applicant_id_number: '身分證字號',
  applicant_birth_date: '出生日期',
  applicant_phone: '聯絡電話',
  applicant_address: '戶籍地址',
  applicant_email: 'E-mail',
  institution_name: '機構/公司名稱',
  institution_tax_id: '統一編號',
};

interface Props {
  /** 本次生成的檔案清單（含後端暫存 downloadUrl） */
  generatedFiles: GeneratedFile[];
  businessTypeName: string;
  /** 批次打包 ZIP 的後端 URL */
  zipUrl: string;
  filledData: Record<string, string>;
  /** 下載連結到期時間（ISO 字串） */
  expiresAt?: string;
}

const props = withDefaults(defineProps<Props>(), {
  expiresAt: '',
});

function labelOf(key: string): string {
  return LABEL_MAP[key] ?? key;
}

function formatExpiry(iso: string): string {
  try {
    const diff = new Date(iso).getTime() - Date.now();
    const hours = Math.floor(diff / 3600000);
    if (hours > 0) return `${hours} 小時`;
    const minutes = Math.floor(diff / 60000);
    return minutes > 0 ? `${minutes} 分鐘` : '即將';
  } catch {
    return '';
  }
}

/**
 * 預覽 / 下載 / ZIP 皆直接開啟生成階段已取得的後端暫存 URL，
 * 不再重打生成 API（避免重複生成並污染歷程）。
 */
function handlePreview(file: GeneratedFile): void {
  window.open(file.downloadUrl, '_blank');
}

function handleDownload(file: GeneratedFile): void {
  window.open(file.downloadUrl, '_blank');
}

function handleDownloadAll(): void {
  window.open(props.zipUrl, '_blank');
}
</script>

<style scoped>
.generate-result {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 成功橫幅 */
.success-banner {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  border-radius: var(--r-lg);
}

.success-icon-wrap {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 0 6px var(--accent-soft);
}

.success-icon {
  width: 1.375rem;
  height: 1.375rem;
  color: var(--text-on-accent);
}

.success-title {
  margin: 0 0 0.2rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}

.success-sub {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-2);
}

.business-badge {
  padding: 0.2rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: var(--r-pill);
}

/* 到期提示 */
.expires-notice {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  color: var(--warning);
  background: var(--warning-soft);
  border: 1px solid var(--warning);
  border-radius: var(--r-md);
}

.expires-icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  color: var(--warning);
}

/* 摘要（kb-info-grid 風格） */
.info-summary {
  padding: 1rem 1.25rem;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.summary-title {
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.5rem 1rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.summary-key {
  font-size: 0.75rem;
  color: var(--text-2);
}

.summary-val {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text);
}

/* 檔案列表 */
.files-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.files-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.files-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text);
}

.file-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* 深色 pill 列（比照 mockup .ef-filerow） */
.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.file-row:hover {
  border-color: var(--border-strong);
  transition: border-color 0.2s ease;
}

.file-left {
  display: flex;
  flex: 1;
  gap: 0.875rem;
  align-items: center;
  min-width: 0;
}

.file-filename {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}

.file-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
  align-items: center;
}
</style>
