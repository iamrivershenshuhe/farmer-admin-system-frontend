<script setup lang="ts">
import { ref } from 'vue';

import logoImage from '@/assets/images/national_farmers_logo.png';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseInput from '@/components/base/BaseInput.vue';
import { useLogin } from '@/composables/useLogin';
import { ICONS } from '@/constants';
import { useAuthStore } from '@/stores/auth';

/**
 * 登入頁面
 * 使用 username + password 進行登入
 */

const authStore = useAuthStore();
const { login } = useLogin();

// 表單資料
const formData = ref({
  username: '',
  password: '',
});

// 表單錯誤
const errors = ref({
  username: '',
  password: '',
  general: '',
});

// 密碼顯示狀態
const showPassword = ref(false);

/**
 * 表單驗證
 *
 * 登入只驗「非空」：不檢查密碼長度 / 強度。
 * 密碼強度政策僅適用於修改密碼頁（usePasswordValidation 為唯一來源），
 * 既有帳號可能不符新政策，登入端不得擋下。
 */
const validateForm = (): boolean => {
  errors.value = { username: '', password: '', general: '' };

  if (!formData.value.username.trim()) {
    errors.value.username = '請輸入用戶名';
    return false;
  }

  if (!formData.value.password) {
    errors.value.password = '請輸入密碼';
    return false;
  }

  return true;
};

/**
 * 處理登入
 * 驗證表單後委由 useLogin 封裝執行登入編排
 */
const handleLogin = async () => {
  if (!validateForm()) {
    return;
  }

  const result = await login({
    username: formData.value.username,
    password: formData.value.password,
  });

  if (result !== true) {
    errors.value.general = result;
  }
};

/**
 * 清除錯誤訊息
 * 當使用者重新輸入時清除對應欄位的錯誤
 */
const clearError = (field: 'username' | 'password') => {
  errors.value[field] = '';
  errors.value.general = '';
};

/**
 * 切換密碼顯示狀態
 */
const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
};
</script>

<template>
  <div class="login-page">
    <!-- Logo 區域 -->
    <div class="logo-section">
      <img :src="logoImage" alt="農會標誌" class="logo-image" />
      <h1 class="logo-text">農會AI智慧管理系統</h1>
    </div>

    <!-- 登入表單區域 -->
    <div class="login-form-wrapper">
      <!-- 錯誤提示 -->
      <div v-if="errors.general" class="error-banner">
        <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {{ errors.general }}
      </div>

      <!-- 登入表單 -->
      <form class="login-form" @submit.prevent="handleLogin">
        <BaseInput
          v-model="formData.username"
          type="text"
          placeholder="請輸入用戶名"
          label="用戶名"
          :error="errors.username"
          required
          @focus="clearError('username')"
        />

        <!-- 密碼輸入框（包含顯示/隱藏按鈕） -->
        <div class="password-field">
          <BaseInput
            v-model="formData.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="請輸入密碼"
            label="密碼"
            :error="errors.password"
            required
            @focus="clearError('password')"
          />
          <button
            type="button"
            class="toggle-password"
            @click="togglePasswordVisibility"
            :title="showPassword ? '隱藏密碼' : '顯示密碼'"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="showPassword ? ICONS.EYE_OFF : ICONS.EYE"
              />
            </svg>
          </button>
        </div>

        <BaseButton
          type="submit"
          variant="primary"
          size="lg"
          full-width
          :loading="authStore.isLoggingIn"
        >
          登入
        </BaseButton>

        <!-- 忘記密碼連結 -->
        <div class="forgot-password-link">
          <router-link to="/forgot-password">忘記密碼？</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  align-items: center;
  width: 100%;
  padding: 2rem;
}

/* Logo 區域 */
.logo-section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  align-items: center;
  text-align: center;
}

.logo-image {
  width: 6rem;
  height: 6rem;
  object-fit: contain;
}

.logo-text {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: white;
  letter-spacing: 0.05em;
}

/* 登入表單區域 */
.login-form-wrapper {
  width: 100%;
  max-width: 26rem;
}

/* 錯誤提示 */
.error-banner {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.875rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: var(--error);
  background: rgb(239 68 68 / 10%);
  border: 1px solid rgb(239 68 68 / 25%);
  border-radius: var(--r-md);
}

.error-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

/* 登入表單 */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 密碼欄位（包含顯示/隱藏按鈕） */
.password-field {
  position: relative;
}

.toggle-password {
  position: absolute;
  top: 2.375rem;
  right: 1rem;
  padding: 0.25rem;
  color: rgb(255 255 255 / 50%);
  cursor: pointer;
  background: none;
  border: none;
  transition: color 0.2s;
}

.toggle-password:hover {
  color: rgb(255 255 255 / 80%);
}

.toggle-password svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* 忘記密碼連結 */
.forgot-password-link {
  margin-top: -0.5rem;
  text-align: center;
}

.forgot-password-link a {
  font-size: 0.875rem;
  color: var(--accent);
  text-decoration: none;
  transition: color 0.2s;
}

.forgot-password-link a:hover {
  color: var(--accent-hover);
  text-decoration: underline;
}

/* 響應式 */
@media (width <= 640px) {
  .login-page {
    gap: 2rem;
    padding: 1.5rem;
  }

  .logo-image {
    width: 5rem;
    height: 5rem;
  }

  .logo-text {
    font-size: 1.5rem;
  }

  .login-form-wrapper {
    max-width: 100%;
  }
}
</style>
