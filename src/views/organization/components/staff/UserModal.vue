<template>
  <BaseModal
    v-model="isOpen"
    :title="isEdit ? '編輯人員' : '新增人員'"
    size="md"
    @close="handleClose"
  >
    <form class="form-grid" @submit.prevent="handleSubmit">
      <div class="field">
        <label class="field-label">帳號 <span class="req">*</span></label>
        <input
          v-model="formData.username"
          type="text"
          class="input"
          placeholder="例如：user001"
          :disabled="isEdit"
        />
      </div>

      <div class="field">
        <label class="field-label">姓名</label>
        <input v-model="formData.name" type="text" class="input" placeholder="請輸入姓名" />
      </div>

      <div class="field full">
        <label class="field-label">帳號權限 <span class="req">*</span></label>
        <span class="select-wrap">
          <select v-model="formData.role" class="select-field" :disabled="!canEditRole">
            <option value="">請選擇權限</option>
            <option value="admin">系統管理員</option>
            <option value="manager">部門主管</option>
            <option value="user">一般員工</option>
          </select>
        </span>
        <span v-if="!canEditRole" class="modal-hint">部門主管無法調整使用者權限</span>
      </div>

      <div class="field">
        <label class="field-label">
          部門
          <span v-if="formData.role !== 'admin'" class="req">*</span>
          <span v-else class="req-soft">·系統管理員可不限部門</span>
        </label>
        <span class="select-wrap">
          <select v-model="formData.department" class="select-field">
            <option value="">{{ formData.role === 'admin' ? '不限部門' : '請選擇部門' }}</option>
            <option v-for="dept in availableDepartments" :key="dept.id" :value="dept.name">
              {{ dept.name }}
            </option>
          </select>
        </span>
      </div>

      <div class="field">
        <label class="field-label"
          >業務範圍 <span class="req-soft">·依部門連動，可多選</span></label
        >
        <div v-if="!selectedDeptId" class="bt-hint">請先選擇部門</div>
        <div v-else-if="!deptBts.length" class="bt-hint">此部門無業務別</div>
        <div v-else class="bt-checklist">
          <label v-for="bt in deptBts" :key="bt.id" class="bt-check">
            <input
              type="checkbox"
              :value="bt.id"
              :checked="formData.businessTypeIds.includes(bt.id)"
              @change="toggleBt(bt.id)"
            />
            {{ bt.name }}
          </label>
        </div>
      </div>

      <div v-if="!isEdit" class="field full">
        <label class="field-label">預設密碼</label>
        <input
          v-model="formData.password"
          type="text"
          class="input"
          placeholder="系統將自動產生預設密碼"
          disabled
        />
      </div>

      <label v-if="!isEdit" class="modal-checkbox full">
        <input v-model="formData.mustChangePassword" type="checkbox" />
        <span>首次登入強制修改密碼</span>
      </label>

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
import { usePermission } from '@/composables/usePermission';
import { useBusinessTypeStore } from '@/stores/business-type';
import { useDepartmentStore } from '@/stores/department';
import type { UserInfo, UserRole } from '@/types/user';

interface UserFormData {
  username: string;
  name?: string;
  role: UserRole | '';
  department: string;
  departmentId: string;
  businessTypeIds: string[];
  password?: string;
  mustChangePassword?: boolean;
}

interface Props {
  modelValue: boolean;
  user?: UserInfo | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', data: UserFormData): void;
}>();

const { isAdmin } = usePermission();
const departmentStore = useDepartmentStore();
const businessTypeStore = useBusinessTypeStore();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const isEdit = computed(() => !!props.user);
const canEditRole = computed(() => isAdmin.value);
const availableDepartments = computed(() => departmentStore.departments);

const defaultFormData: UserFormData = {
  username: '',
  name: '',
  role: '',
  department: '',
  departmentId: '',
  businessTypeIds: [],
  password: '',
  mustChangePassword: true,
};

const formData = ref<UserFormData>({ ...defaultFormData });
const errorMessage = ref('');

// 部門名稱 → ID（業務別依部門 ID 連動）
const selectedDeptId = computed(
  () => availableDepartments.value.find((d) => d.name === formData.value.department)?.id ?? ''
);

const deptBts = computed(() =>
  selectedDeptId.value ? (businessTypeStore.businessTypesByDept[selectedDeptId.value] ?? []) : []
);

// 安全契約：非 admin 帳號必須有部門（避免無部門非 admin 觸發越權哨兵；見 domain.md）
const isFormValid = computed(
  () =>
    formData.value.username.trim() !== '' &&
    formData.value.role !== '' &&
    (formData.value.role === 'admin' || formData.value.department !== '')
);

// 部門變更：載入該部門業務別，清掉不屬於新部門的已選項
watch(selectedDeptId, (id, prev) => {
  if (id) businessTypeStore.fetchBusinessTypes(id);
  if (prev !== undefined && id !== prev) {
    formData.value.businessTypeIds = formData.value.businessTypeIds.filter((bid) =>
      (businessTypeStore.businessTypesByDept[id] ?? []).some((b) => b.id === bid)
    );
  }
});

watch(
  () => props.user,
  (user) => {
    formData.value = user
      ? {
          username: user.username,
          name: user.name || '',
          role: user.role,
          department: user.department || '',
          departmentId: user.departmentId ?? '',
          businessTypeIds: [...(user.businessTypeIds ?? [])],
          password: '',
          mustChangePassword: true,
        }
      : { ...defaultFormData, businessTypeIds: [] };
    errorMessage.value = '';
    if (selectedDeptId.value) businessTypeStore.fetchBusinessTypes(selectedDeptId.value);
  },
  { immediate: true }
);

const toggleBt = (id: string) => {
  const list = formData.value.businessTypeIds;
  formData.value.businessTypeIds = list.includes(id) ? list.filter((b) => b !== id) : [...list, id];
};

const handleSubmit = () => {
  if (!isFormValid.value) return;
  errorMessage.value = '';
  emit('submit', { ...formData.value, departmentId: selectedDeptId.value });
};

const handleClose = () => {
  formData.value = { ...defaultFormData, businessTypeIds: [] };
  errorMessage.value = '';
};

function setError(msg: string) {
  errorMessage.value = msg;
}

defineExpose({ setError });
</script>

<style scoped>
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

.req-soft {
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--accent);
}

/* 業務別多選：對齊知識庫上傳文件之 bt-checklist */
.bt-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 7rem;
  padding: 0.5rem;
  overflow-y: auto;
  background: var(--bg-1);
  border: 2px solid var(--border);
  border-radius: var(--r-md);
}

.bt-check {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.8125rem;
  color: var(--text);
}

.bt-hint {
  display: flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0 0.875rem;
  font-size: 0.8125rem;
  color: var(--text-3);
  background: var(--bg-1);
  border: 2px dashed var(--border);
  border-radius: var(--r-md);
}
</style>
