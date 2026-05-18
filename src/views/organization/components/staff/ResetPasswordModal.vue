<template>
  <BaseModal v-model="isOpen" title="重設密碼" size="sm" @close="handleClose">
    <div class="modal-stack">
      <div class="info-box">
        <div class="info-row">
          <span>帳號</span><strong>{{ user?.username }}</strong>
        </div>
        <div class="info-row">
          <span>姓名</span><strong>{{ user?.name || '—' }}</strong>
        </div>
      </div>

      <div class="field">
        <label class="field-label">新密碼</label>
        <input
          v-model="newPassword"
          type="text"
          class="input"
          :placeholder="`預設：${DEFAULT_PASSWORD}`"
        />
      </div>

      <label class="modal-checkbox">
        <input v-model="mustChangePassword" type="checkbox" />
        <span>強制下次登入修改密碼</span>
      </label>

      <p class="modal-hint">提示：重設後請通知使用者新密碼。</p>
    </div>

    <template #footer>
      <button class="btn-secondary" @click="isOpen = false">取消</button>
      <button class="btn-primary" @click="handleSubmit">確認重設</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import BaseModal from '@/components/base/BaseModal.vue';
import { DEFAULT_PASSWORD } from '@/mock/staff';
import type { UserInfo } from '@/types/user';

interface Props {
  modelValue: boolean;
  user?: UserInfo | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', userId: string, password: string, mustChange: boolean): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const newPassword = ref(DEFAULT_PASSWORD);
const mustChangePassword = ref(true);

watch(
  () => props.user,
  () => {
    newPassword.value = DEFAULT_PASSWORD;
    mustChangePassword.value = true;
  },
  { immediate: true }
);

const handleSubmit = () => {
  if (!props.user) return;
  emit('submit', props.user.id, newPassword.value, mustChangePassword.value);
};

const handleClose = () => {
  newPassword.value = DEFAULT_PASSWORD;
  mustChangePassword.value = true;
};
</script>

<style scoped>
.modal-stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.info-box {
  padding: 0.75rem 1rem;
  background: var(--bg-2);
  border-radius: var(--r-md);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.375rem 0;
  font-size: 0.875rem;
}

.info-row span {
  color: var(--text-2);
}

.info-row strong {
  font-weight: 600;
  color: var(--text);
}

.modal-checkbox {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.875rem;
  color: var(--text);
  cursor: pointer;
}

.modal-checkbox input[type='checkbox'] {
  width: 1.125rem;
  height: 1.125rem;
  cursor: pointer;
}
</style>
