<template>
  <div class="base-input">
    <label v-if="label" class="input-label">
      {{ label }}
      <span v-if="required" class="required-mark">*</span>
    </label>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="['input-field', { error: hasError, disabled }]"
      @input="handleInput"
      @blur="handleBlur"
      @focus="handleFocus"
    />
    <span v-if="hasError" class="error-message">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue: string;
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'date';
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  error: '',
  label: '',
  required: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  blur: [];
  focus: [];
}>();

const hasError = computed(() => !!props.error);

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
};

const handleBlur = () => {
  emit('blur');
};

const handleFocus = () => {
  emit('focus');
};
</script>

<style scoped>
.base-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.input-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
}

.required-mark {
  margin-left: 0.125rem;
  color: var(--error);
}

.input-field {
  width: 100%;
  padding: 0.6875rem 1rem;
  font-size: 0.875rem;
  color: var(--text);
  outline: none;
  background: var(--bg-1);
  border: 2px solid var(--border);
  border-radius: var(--r-md);

  /* transition 不能加在基礎樣式，否則主題切換會黑閃 */
  transition: none;
}

.input-field::placeholder {
  color: var(--text-3);
}

.input-field:hover {
  border-color: var(--border-strong);
  transition: border-color 0.15s ease;
}

.input-field:focus {
  border-color: var(--accent);
  transition: border-color 0.15s ease;
}

.input-field.error {
  border-color: var(--error);
}

.input-field.error:focus {
  border-color: var(--error);
}

.input-field.disabled {
  cursor: not-allowed;
  background: var(--bg-1);
  opacity: 0.5;
}

.error-message {
  margin-top: -0.25rem;
  font-size: 0.8125rem;
  color: var(--error);
}
</style>
