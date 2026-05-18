<template>
  <BaseModal v-model="isOpen" title="變更角色" size="sm" @close="handleClose">
    <div class="modal-stack">
      <div class="info-box">
        <div class="info-row">
          <span>帳號</span><strong>{{ user?.username }}</strong>
        </div>
        <div class="info-row">
          <span>姓名</span><strong>{{ user?.name || '—' }}</strong>
        </div>
        <div class="info-row">
          <span>目前角色</span><strong>{{ currentRoleLabel }}</strong>
        </div>
      </div>

      <div class="field">
        <label class="field-label">新角色 <span class="req">*</span></label>
        <span class="select-wrap">
          <select v-model="newRole" class="select-field">
            <option value="">請選擇角色</option>
            <option value="admin">系統管理員</option>
            <option value="manager">部門主管</option>
            <option value="user">一般員工</option>
          </select>
        </span>
      </div>

      <p class="modal-hint">變更角色後使用者將取得對應系統權限，請謹慎操作。</p>
    </div>

    <template #footer>
      <button class="btn-secondary" @click="isOpen = false">取消</button>
      <button class="btn-primary" :disabled="!newRole" @click="handleSubmit">確認變更</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import BaseModal from '@/components/base/BaseModal.vue';
import type { UserInfo, UserRole } from '@/types/user';
import { ROLE_LABELS } from '@/types/user';

interface Props {
  modelValue: boolean;
  user?: UserInfo | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', userId: string, newRole: UserRole): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const newRole = ref<UserRole | ''>('');

const currentRoleLabel = computed(() => (props.user ? ROLE_LABELS[props.user.role] : '—'));

watch(
  () => props.user,
  () => {
    newRole.value = '';
  },
  { immediate: true }
);

const handleSubmit = () => {
  if (!props.user || !newRole.value) return;
  emit('submit', props.user.id, newRole.value);
};

const handleClose = () => {
  newRole.value = '';
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
</style>
