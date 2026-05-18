<template>
  <button
    :type="type"
    class="icon-btn"
    :class="[`icon-btn--${variant}`, `icon-btn--${size}`, { 'icon-btn--icon-only': !label }]"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot name="icon">
      <svg v-if="icon" class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="ICONS[icon]" />
      </svg>
    </slot>
    <span v-if="label" class="btn-text">{{ label }}</span>
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import { type IconName, ICONS } from '@/constants/icons';

interface Props {
  icon?: IconName;
  label?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

withDefaults(defineProps<Props>(), {
  type: 'button',
  disabled: false,
  variant: 'ghost',
  size: 'md',
});

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

const handleClick = (event: MouseEvent) => {
  emit('click', event);
};
</script>

<style scoped>
.icon-btn {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: var(--r-pill);
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    opacity 0.15s ease;
}

.icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Variants */

/* Primary = 唯一允許實心綠的 CTA（對齊設計系統 .btn-primary：實心底 + 膠囊圓角） */
.icon-btn--primary {
  color: var(--text-on-accent);
  background-color: var(--accent);
  border-radius: var(--r-pill);
}

.icon-btn--primary:hover:not(:disabled),
.icon-btn--primary:active:not(:disabled) {
  background-color: var(--accent-hover);
}

.icon-btn--secondary {
  color: var(--text);
  background-color: transparent;
  border-color: var(--border-strong);
}

.icon-btn--secondary:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.icon-btn--ghost {
  color: var(--text);
  background-color: transparent;
}

.icon-btn--ghost:hover:not(:disabled) {
  background-color: var(--bg-hover);
}

.icon-btn--danger {
  color: var(--text-on-accent);
  background-color: var(--error);
  border-radius: var(--r-pill);
}

.icon-btn--danger:hover:not(:disabled) {
  background-color: var(--error-hover);
}

/* Sizes */
.icon-btn--sm {
  min-height: 32px;
  padding: 0.375rem 0.625rem;
  font-size: 0.8125rem;
}

.icon-btn--md {
  min-height: 40px;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
}

.icon-btn--lg {
  min-height: 48px;
  padding: 0.75rem 1.25rem;
  font-size: 0.9375rem;
}

/* 純圖示鈕：正方形 + 圓角方形（非膠囊橢圓），hover 底色才不會變橢圓 */
.icon-btn--icon-only {
  padding: 0;
  border-radius: var(--r-md);
}

.icon-btn--icon-only.icon-btn--sm {
  width: 32px;
}

.icon-btn--icon-only.icon-btn--md {
  width: 40px;
}

.icon-btn--icon-only.icon-btn--lg {
  width: 48px;
}

.btn-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

.icon-btn--sm .btn-icon {
  width: 1rem;
  height: 1rem;
}

.btn-text {
  font-weight: 500;
}
</style>
