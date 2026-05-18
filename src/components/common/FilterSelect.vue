<template>
  <select
    :value="modelValue"
    class="filter-select"
    :class="[`filter-select--${size}`, { 'filter-select--disabled': disabled }]"
    :disabled="disabled"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option value="">{{ placeholder }}</option>
    <option v-for="opt in normalizedOptions" :key="opt.value" :value="opt.value">
      {{ opt.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: Array<string | { value: string; label: string }>;
    placeholder: string;
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
  }>(),
  {
    size: 'md',
    disabled: false,
  }
);

defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const normalizedOptions = computed(() =>
  props.options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt))
);
</script>

<style scoped>
.filter-select {
  box-sizing: border-box;
  color: var(--text);
  appearance: none;
  cursor: pointer;
  background-color: var(--bg-1);

  /*
   * Chevron anchored from the right edge of the element's padding box
   * (box-sizing: border-box). Using `right` offsets instead of
   * `calc(100% - N)` prevents the chevron from shifting when border
   * width changes between states.
   */
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
  border: 2px solid var(--border);
  border-radius: var(--r-md);
  transition: border-color 0.15s ease;
}

.filter-select--sm {
  min-height: 32px;
  padding: 0.375rem 36px 0.375rem 0.625rem;
  font-size: 0.8125rem;
}

.filter-select--md {
  min-height: 40px;
  padding: 0.5rem 36px 0.5rem 0.75rem;
  font-size: 0.875rem;
}

.filter-select--lg {
  min-height: 48px;
  padding: 0.625rem 36px 0.625rem 1rem;
  font-size: 0.9375rem;
}

.filter-select--disabled {
  color: var(--text-2);
  cursor: not-allowed;
  background-color: var(--bg-2);
  opacity: 1;
}

.filter-select:not(.filter-select--disabled):hover {
  border-color: var(--border-strong);
}

/* focus 必須勝過 hover：同等 specificity 且置於 hover 之後，
   否則聚焦時若游標仍懸停會被 hover 的 border-strong 蓋掉（移開才變綠） */
.filter-select:not(.filter-select--disabled):focus {
  outline: none;
  border-color: var(--accent);
}

/* Mobile: 自動套用 sm 尺寸（不需 view 傳 prop） */
@media (width <= 767px) {
  .filter-select {
    min-height: 32px;
    padding: 0.375rem 36px 0.375rem 0.625rem;
    font-size: 0.8125rem;
  }
}
</style>
