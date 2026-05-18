<template>
  <BaseModal
    v-model="isOpen"
    :title="isEdit ? '編輯業務別' : '新增業務別'"
    size="md"
    @close="handleClose"
  >
    <form class="form-grid" @submit.prevent="handleSubmit">
      <div class="field">
        <label class="field-label">業務別名稱 <span class="req">*</span></label>
        <input v-model="formData.name" type="text" class="input" placeholder="例如：放款業務" />
      </div>

      <div class="field">
        <label class="field-label">所屬部門 <span class="req">*</span></label>
        <span class="select-wrap">
          <select v-model="departmentId" class="select-field">
            <option value="" disabled>請選擇部門</option>
            <option v-for="d in departmentOptions" :key="d.value" :value="d.value">
              {{ d.label }}
            </option>
          </select>
        </span>
      </div>

      <div class="field full">
        <label class="field-label">說明（選填）</label>
        <textarea
          v-model="formData.description"
          class="input"
          placeholder="選填，簡短描述業務別範圍"
        />
      </div>

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
import type {
  BusinessType,
  CreateBusinessTypePayload,
  UpdateBusinessTypePayload,
} from '@/types/business-type';

interface DeptOption {
  value: string;
  label: string;
}

interface Props {
  modelValue: boolean;
  businessType?: BusinessType | null;
  departmentOptions: DeptOption[];
  /** 由部門下鑽新增時預設帶入部門（仍可改） */
  lockedDepartmentId?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  submit: [
    data: (CreateBusinessTypePayload | UpdateBusinessTypePayload) & { departmentId: string },
  ];
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const isEdit = computed(() => !!props.businessType);
const errorMessage = ref('');

const defaultFormData = { name: '', description: '', active: true };
const formData = ref({ ...defaultFormData });
const departmentId = ref('');

const statusModel = computed({
  get: () => (formData.value.active ? 'active' : 'inactive'),
  set: (v: string) => {
    formData.value.active = v === 'active';
  },
});

const isFormValid = computed(() => formData.value.name.trim() !== '' && departmentId.value !== '');

watch(
  [() => props.businessType, () => props.modelValue],
  () => {
    const bt = props.businessType;
    if (bt) {
      formData.value = { name: bt.name, description: bt.description ?? '', active: bt.active };
      departmentId.value = bt.departmentId ?? '';
    } else {
      formData.value = { ...defaultFormData };
      departmentId.value = props.lockedDepartmentId ?? '';
    }
    errorMessage.value = '';
  },
  { immediate: true }
);

const handleSubmit = () => {
  if (!isFormValid.value) return;
  errorMessage.value = '';
  emit('submit', {
    name: formData.value.name.trim(),
    description: formData.value.description.trim() || undefined,
    active: formData.value.active,
    departmentId: departmentId.value,
  });
};

const handleClose = () => {
  formData.value = { ...defaultFormData };
  departmentId.value = '';
  errorMessage.value = '';
};

function setError(msg: string) {
  errorMessage.value = msg;
}

defineExpose({ setError });
</script>
