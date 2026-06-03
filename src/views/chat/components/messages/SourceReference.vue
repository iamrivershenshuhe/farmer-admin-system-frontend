<template>
  <div v-if="references && references.length > 0" class="source-references">
    <button type="button" class="source-toggle" :aria-expanded="isOpen" @click="isOpen = !isOpen">
      <svg
        class="toggle-chevron"
        :class="{ open: isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      <span class="toggle-text">參考來源</span>
      <span class="toggle-count">{{ references.length }}</span>
    </button>

    <Transition name="source-expand">
      <div v-if="isOpen" class="source-chips">
        <button
          v-for="(reference, index) in references"
          :key="reference.chunkId"
          type="button"
          class="source-chip"
          :title="reference.docTitle"
          @click="handleFileClick(reference)"
        >
          <span class="chip-number">{{ index + 1 }}</span>
          <span class="chip-name">{{ reference.docTitle }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import { getDocument } from '@/api/knowledge';
import { useFilePreview } from '@/composables/useFilePreview';
import { resolveApiUrl } from '@/config';
import type { DocumentReference } from '@/types/rag';

interface Props {
  references: DocumentReference[];
}

defineProps<Props>();

const { openPreview } = useFilePreview();

const isOpen = ref(false);
// 防重複點擊（以 chunkId 標記載入中的來源）
const loadingId = ref<string | null>(null);

/**
 * 開啟來源原始檔預覽。
 *
 * 後端的簽章下載 URL (`fileUrl`) 是短效 token（會過期），故不存於 message.references；
 * 改在點擊當下查 `GET /knowledge/documents/{id}` 取「當次新鮮」的 fileUrl 與正確副檔名的
 * filename（供預覽 modal 判斷檔型）。RAG 引用之文件必在使用者可見範圍內，故權限相符；
 * 文件已刪除 / 無權限則靜默略過。
 */
const handleFileClick = async (reference: DocumentReference): Promise<void> => {
  if (loadingId.value) return;
  loadingId.value = reference.chunkId;
  try {
    const { data } = await getDocument(reference.documentId);
    const doc = data.document;
    if (!doc?.fileUrl) return;
    openPreview({
      fileName: doc.filename,
      // resolve the backend's root-relative signed URL to an absolute one so the
      // preview's raw fetch hits the backend (dev: FE :5173 ≠ BE :8000), not the SPA
      fileUrl: resolveApiUrl(doc.fileUrl),
      highlightText: reference.snippet,
    });
  } catch (err) {
    console.warn('開啟來源文件失敗（可能已刪除或無權限）:', err);
  } finally {
    loadingId.value = null;
  }
};
</script>

<style scoped>
.source-references {
  margin-top: 1rem;
}

.source-toggle {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  padding: 0.375rem 0.75rem 0.375rem 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-2);
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--border-strong);
  border-radius: 9999px;
}

.source-toggle:hover {
  background-color: var(--bg-hover);
  transition: background-color 0.15s ease;
}

.toggle-chevron {
  width: 0.875rem;
  height: 0.875rem;
  transform: rotate(0);
}

.toggle-chevron.open {
  transform: rotate(90deg);
  transition: transform 0.2s ease;
}

.toggle-count {
  padding: 0.0625rem 0.4375rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  background-color: var(--accent-soft);
  border-radius: 9999px;
}

.source-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.625rem;
}

.source-chip {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  max-width: 18rem;
  padding: 0.375rem 0.75rem 0.375rem 0.375rem;
  font-size: 0.8125rem;
  color: var(--text);
  cursor: pointer;
  background-color: transparent;
  border: 1px solid var(--border-strong);
  border-radius: 9999px;
}

.source-chip:hover {
  background-color: var(--bg-hover);
  transition: background-color 0.15s ease;
}

.chip-number {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent);
  background-color: var(--accent-soft);
  border-radius: 50%;
}

.chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-expand-enter-active,
.source-expand-leave-active {
  overflow: hidden;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.source-expand-enter-from,
.source-expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (width <= 768px) {
  .source-chip {
    max-width: 100%;
  }
}
</style>
