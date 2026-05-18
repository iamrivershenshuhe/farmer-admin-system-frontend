<template>
  <span class="file-type-badge" :class="badgeClass">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  /** 檔案類型標籤（如 PDF / DOC / TXT） */
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: 'PDF',
});

// 與知識庫 DocumentTable 一致的檔案類型配色
const badgeClass = computed(() => {
  const l = props.label.toUpperCase();
  if (l === 'PDF') return 'badge-pdf';
  if (l === 'DOC' || l === 'DOCX') return 'badge-doc';
  if (l === 'TXT') return 'badge-txt';
  return 'badge-default';
});
</script>

<style scoped>
.file-type-badge {
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

.badge-pdf {
  background: #c0392b;
}

.badge-doc {
  background: #1d4ed8;
}

.badge-txt,
.badge-default {
  background: #475569;
}
</style>
