<template>
  <BaseModal v-model="isOpen" :title="title" size="sm">
    <p class="confirm-text">{{ message }}</p>
    <p class="confirm-hint">停用為可逆操作，可隨時重新啟用，且保留所有歷史關聯。</p>

    <template #footer>
      <button class="btn-secondary" @click="isOpen = false">取消</button>
      <button class="btn-neutral" @click="$emit('confirm')">確認停用</button>
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
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
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

/* 按鈕沿用全域 .btn-secondary / .btn-neutral（main.css @layer components） */
</style>
