<template>
  <BaseModal v-model="isOpen" :title="title" size="sm" @close="$emit('close')">
    <p class="confirm-text">{{ message }}</p>
    <p class="confirm-hint">
      若只是要暫停使用，建議改用<strong>停用</strong>（可隨時復原、保留歷史關聯）。
    </p>
    <p v-if="errorMessage" class="confirm-error">{{ errorMessage }}</p>

    <template #footer>
      <button class="btn-text" @click="isOpen = false">取消</button>
      <button class="btn-ghost" @click="$emit('deactivate')">改為停用</button>
      <button class="btn-danger" @click="$emit('confirm')">仍要刪除</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import BaseModal from '@/components/base/BaseModal.vue';

interface Props {
  modelValue: boolean;
  title: string;
  message: string;
  /** 後端守門回傳（被引用無法刪除）— 以 inline 文字呈現，非 alert */
  errorMessage?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  deactivate: [];
  confirm: [];
  close: [];
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
</script>

<style scoped>
.confirm-text {
  margin: 0 0 0.5rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text);
}

.confirm-hint {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--text-2);
}

.confirm-error {
  margin: 0.75rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--error);
}

.btn-text,
.btn-ghost,
.btn-danger {
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: var(--r-pill);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.btn-text {
  color: var(--text-2);
  background: transparent;
}

.btn-text:hover {
  color: var(--text);
  background: var(--bg-hover);
}

.btn-ghost {
  color: var(--text);
  background: transparent;
  border-color: var(--border-strong);
}

.btn-ghost:hover {
  background: var(--bg-hover);
}

.btn-danger {
  color: var(--text-on-accent);
  background: var(--error);
}

.btn-danger:hover {
  background: var(--error-hover);
}
</style>
