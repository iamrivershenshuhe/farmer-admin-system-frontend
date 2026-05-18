<template>
  <div class="accordion">
    <div v-for="(item, index) in items" :key="index" class="accordion-item">
      <button
        type="button"
        class="accordion-header"
        :aria-expanded="openSet.has(index)"
        @click="toggle(index)"
      >
        <slot name="header" :item="item" :index="index" :is-open="openSet.has(index)">
          <span class="accordion-header-label">{{ item }}</span>
        </slot>
        <svg
          class="accordion-chevron"
          :class="{ 'accordion-chevron--open': openSet.has(index) }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div class="accordion-body-wrap" :class="{ 'is-open': openSet.has(index) }">
        <div class="accordion-body-inner">
          <div class="accordion-body">
            <slot name="body" :item="item" :index="index" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { ref, watch } from 'vue';

interface Props {
  /** 資料陣列，每筆對應一個手風琴項目 */
  items: T[];
  /**
   * 預設展開的索引集合（非受控預設值）
   * 若需受控模式請搭配 v-model:openIndexes
   */
  defaultOpen?: number[];
  /** 是否允許多個同時展開（true = 多展開；false = 單一展開） */
  multiple?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpen: () => [],
  multiple: true,
});

const emit = defineEmits<{
  /** 展開狀態改變時 emit，帶出目前展開的索引集合 */
  (e: 'update:openIndexes', indexes: number[]): void;
}>();

const openSet = ref<Set<number>>(new Set(props.defaultOpen));

watch(
  () => props.defaultOpen,
  (val) => {
    openSet.value = new Set(val);
  }
);

function toggle(index: number): void {
  const next = new Set(openSet.value);
  if (next.has(index)) {
    next.delete(index);
  } else {
    if (!props.multiple) next.clear();
    next.add(index);
  }
  openSet.value = next;
  emit('update:openIndexes', [...next]);
}
</script>

<style scoped>
.accordion {
  display: flex;
  flex-direction: column;
}

.accordion-item {
  border-bottom: 1px solid var(--border);
}

.accordion-item:first-child {
  border-top: 1px solid var(--border);
}

.accordion-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  outline: none;
  background: transparent;
  border: none;
}

.accordion-header:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.accordion-header:hover {
  background: var(--bg-hover);
  transition: background-color 0.15s ease;
}

.accordion-header-label {
  flex: 1;
}

.accordion-chevron {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  color: var(--text-2);
  transition: transform 0.25s ease;
}

.accordion-chevron--open {
  transform: rotate(180deg);
}

/* 平滑展開：grid-template-rows 0fr↔1fr（不需固定 max-height 猜值，無卡頓） */
.accordion-body-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.24s ease;
}

.accordion-body-wrap.is-open {
  grid-template-rows: 1fr;
}

.accordion-body-inner {
  min-height: 0;
  overflow: hidden;
}

.accordion-body {
  padding: 0 1rem 0.875rem;
}
</style>
