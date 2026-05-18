<template>
  <button
    :type="type"
    :class="[
      'base-button',
      `variant-${variant}`,
      `size-${size}`,
      { 'full-width': fullWidth, disabled: disabled || loading, loading },
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="loading-spinner"></span>
    <span :class="{ 'button-content': true, 'with-spinner': loading }">
      <slot></slot>
    </span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false,
  type: 'button',
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event);
  }
};
</script>

<style scoped>
.base-button {
  position: relative;
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  outline: none;
  border: 1px solid transparent;
  border-radius: var(--r-pill);
  transition:
    background-color var(--t),
    color var(--t),
    border-color var(--t);
}

/* 尺寸變體（高度對齊 IconBtn：sm32 / md40 / lg48，確保並列按鈕等高） */
.size-sm {
  min-height: 32px;
  padding: 0 1rem;
  font-size: 0.8125rem;
}

.size-md {
  min-height: 40px;
  padding: 0 1.25rem;
  font-size: 0.875rem;
}

.size-lg {
  min-height: 48px;
  padding: 0 1.5rem;
  font-size: 0.9375rem;
}

/* 樣式變體 */
.variant-primary {
  color: var(--text-on-accent);
  background: var(--accent);
}

.variant-primary:hover:not(.disabled) {
  background: var(--accent-hover);
  transition: background-color 0.15s ease;
}

.variant-primary:active:not(.disabled) {
  background: var(--accent-hover);
}

.variant-secondary {
  color: var(--text);
  background: transparent;
  border-color: var(--border-strong);
}

.variant-secondary:hover:not(.disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.variant-outline {
  color: var(--text);
  background: transparent;
  border-color: var(--border-strong);
}

.variant-outline:hover:not(.disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.variant-ghost {
  color: var(--text);
  background: transparent;
}

.variant-ghost:hover:not(.disabled) {
  background: var(--bg-hover);
  transition: background-color 0.15s ease;
}

.variant-danger {
  color: var(--text-on-accent);
  background: var(--error);
}

.variant-danger:hover:not(.disabled) {
  background: var(--error-hover);
  transition: background-color 0.15s ease;
}

/* 狀態 */
.full-width {
  width: 100%;
}

.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.loading {
  cursor: wait;
}

.button-content.with-spinner {
  opacity: 0;
}

/* 載入動畫 */
.loading-spinner {
  position: absolute;
  width: 1rem;
  height: 1rem;
  border: 2px solid currentcolor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
