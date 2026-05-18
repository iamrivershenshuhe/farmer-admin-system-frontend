<template>
  <BaseModal
    v-model="isOpen"
    :title="isEdit ? '編輯部門' : '新增部門'"
    size="md"
    @close="handleClose"
  >
    <form class="form-grid" @submit.prevent="handleSubmit">
      <div class="field">
        <label class="field-label">部門代碼 <span class="req">*</span></label>
        <input
          v-model="formData.code"
          type="text"
          class="input"
          placeholder="例如：CR01"
          :disabled="isEdit"
        />
      </div>

      <div class="field">
        <label class="field-label">部門名稱 <span class="req">*</span></label>
        <input v-model="formData.name" type="text" class="input" placeholder="例如：信用部" />
      </div>

      <div class="field full">
        <label class="field-label">部門主管（選填）</label>
        <span class="select-wrap">
          <select v-model="formData.managerName" class="select-field">
            <option value="">暫不指派</option>
            <option v-for="m in availableManagers" :key="m.id" :value="m.name">{{ m.name }}</option>
          </select>
        </span>
      </div>

      <p class="modal-hint">ⓘ 可先建立部門，稍後再從人員管理指派主管</p>

      <div class="field">
        <label class="field-label">狀態</label>
        <span class="select-wrap">
          <select v-model="statusModel" class="select-field">
            <option value="active">啟用</option>
            <option value="inactive">停用</option>
          </select>
        </span>
      </div>

      <p v-if="errorMessage" class="modal-error">{{ errorMessage }}</p>
    </form>

    <template #footer>
      <button class="btn-secondary" @click="isOpen = false">取消</button>
      <button class="btn-primary" :disabled="!isFormValid" @click="handleSubmit">確認儲存</button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import BaseModal from '@/components/base/BaseModal.vue';
import { useStaffStore } from '@/stores/staff';
import type { Department, DepartmentFormData } from '@/types/department';

interface Props {
  modelValue: boolean;
  department?: Department | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', data: DepartmentFormData): void;
}>();

const staffStore = useStaffStore();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const isEdit = computed(() => !!props.department);
const availableManagers = computed(() => staffStore.managers);

const defaultFormData: DepartmentFormData = { code: '', name: '', managerName: '', active: true };
const formData = ref<DepartmentFormData>({ ...defaultFormData });
const errorMessage = ref('');

const statusModel = computed({
  get: () => (formData.value.active ? 'active' : 'inactive'),
  set: (v: string) => {
    formData.value.active = v === 'active';
  },
});

const isFormValid = computed(
  () => formData.value.code.trim() !== '' && formData.value.name.trim() !== ''
);

watch(
  () => props.department,
  (dept) => {
    formData.value = dept
      ? {
          code: dept.code,
          name: dept.name,
          managerName: dept.managerName || '',
          active: dept.active,
        }
      : { ...defaultFormData };
    errorMessage.value = '';
  },
  { immediate: true }
);

const handleSubmit = () => {
  if (!isFormValid.value) return;
  errorMessage.value = '';
  // 未指派主管統一送 null（見 domain.md：未指派一律 null）
  emit('submit', { ...formData.value, managerName: formData.value.managerName || null });
};

const handleClose = () => {
  formData.value = { ...defaultFormData };
  errorMessage.value = '';
};

function setError(msg: string) {
  errorMessage.value = msg;
}

defineExpose({ setError });
</script>
