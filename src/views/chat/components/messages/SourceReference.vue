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

import { useFilePreview } from '@/composables/useFilePreview';
import type { DocumentReference } from '@/types/rag';

interface Props {
  references: DocumentReference[];
}

defineProps<Props>();

const { openPreview } = useFilePreview();

const isOpen = ref(false);

const handleFileClick = (reference: DocumentReference): void => {
  const fileUrl = `/api/v1/knowledge/documents/${reference.documentId}/download`;
  openPreview({
    fileName: reference.docTitle,
    fileUrl,
    highlightText: reference.snippet,
  });
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
