<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import logoImage from '@/assets/images/national_farmers_logo.png';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseInput from '@/components/base/BaseInput.vue';
import { usePasswordValidation } from '@/composables/usePasswordValidation';
import { ICONS } from '@/constants';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';

/**
 * 修改密碼頁面
 * 用於首次登入強制修改密碼或使用者主動修改密碼
 */

const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();
const { passwordRules, validatePassword, validatePasswordMatch, isSameAsOldPassword } =
  usePasswordValidation();

// 表單資料
const formData = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

// 表單錯誤
const errors = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
  general: '',
});

// 密碼顯示狀態
const showOldPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

// 是否為強制修改密碼（首次登入）
const isMandatory = ref(userStore.user?.mustChangePassword || false);

/**
 * 驗證表單
 * 檢查所有欄位是否符合規則
 */
const validateForm = (): boolean => {
  errors.value = { oldPassword: '', newPassword: '', confirmPassword: '', general: '' };

  // 檢查舊密碼
  if (!formData.value.oldPassword) {
    errors.value.oldPassword = '請輸入舊密碼';
    return false;
  }

  // 檢查新密碼格式
  const passwordValidation = validatePassword(formData.value.newPassword);
  if (!passwordValidation.isValid) {
    errors.value.newPassword = passwordValidation.errors[0];
    return false;
  }

  // 檢查新密碼是否與舊密碼相同
  if (isSameAsOldPassword(formData.value.oldPassword, formData.value.newPassword)) {
    errors.value.newPassword = '新密碼不能與舊密碼相同';
    return false;
  }

  // 檢查確認密碼
  if (!formData.value.confirmPassword) {
    errors.value.confirmPassword = '請再次輸入新密碼';
    return false;
  }

  // 檢查兩次密碼是否一致
  if (!validatePasswordMatch(formData.value.newPassword, formData.value.confirmPassword)) {
    errors.value.confirmPassword = '兩次輸入的密碼不一致';
    return false;
  }

  return true;
};

/**
 * 處理修改密碼
 * 呼叫 Store 的 changePassword 方法
 */
const handleChangePassword = async () => {
  if (!validateForm()) {
    return;
  }

  try {
    await authStore.changePassword(formData.value.oldPassword, formData.value.newPassword);

    // 後端已清除強制改密旗標，守衛下次導航 fetchCurrentUser 會同步；直接導向首頁
    router.push('/chat');
  } catch (error) {
    errors.value.general = error instanceof Error ? error.message : '密碼修改失敗，請稍後再試';
  }
};

/**
 * 清除錯誤訊息
 * 當使用者重新輸入時清除對應欄位的錯誤
 */
const clearError = (field: 'oldPassword' | 'newPassword' | 'confirmPassword') => {
  errors.value[field] = '';
  errors.value.general = '';
};

/**
 * 切換密碼顯示狀態
 */
const togglePasswordVisibility = (field: 'old' | 'new' | 'confirm') => {
  if (field === 'old') {
    showOldPassword.value = !showOldPassword.value;
  } else if (field === 'new') {
    showNewPassword.value = !showNewPassword.value;
  } else {
    showConfirmPassword.value = !showConfirmPassword.value;
  }
};

/**
 * 返回登入頁面
 * 登出當前使用者並跳轉到登入頁面
 */
const backToLogin = () => {
  authStore.logout();
  userStore.clearUser();
  router.push('/login');
};
</script>

<template>
  <div class="change-password-page">
    <!-- Logo 區域 -->
    <div class="logo-section">
      <img :src="logoImage" alt="農會標誌" class="logo-image" />
      <h1 class="logo-text">{{ isMandatory ? '首次登入需要修改密碼' : '修改密碼' }}</h1>
    </div>

    <!-- 修改密碼表單區域 -->
    <div class="form-wrapper">
      <!-- 錯誤提示 -->
      <div v-if="errors.general" class="error-banner">
        <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="ICONS.ERROR" />
        </svg>
        {{ errors.general }}
      </div>

      <!-- 表單 -->
      <form class="change-password-form" @submit.prevent="handleChangePassword">
        <!-- 舊密碼 -->
        <div class="password-field">
          <BaseInput
            v-model="formData.oldPassword"
            :type="showOldPassword ? 'text' : 'password'"
            placeholder="請輸入舊密碼"
            label="舊密碼"
            :error="errors.oldPassword"
            required
            @focus="clearError('oldPassword')"
          />
          <button
            type="button"
            class="toggle-password"
            @click="togglePasswordVisibility('old')"
            :title="showOldPassword ? '隱藏密碼' : '顯示密碼'"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="showOldPassword ? ICONS.EYE_OFF : ICONS.EYE"
              />
            </svg>
          </button>
        </div>

        <!-- 新密碼 -->
        <div class="password-field">
          <BaseInput
            v-model="formData.newPassword"
            :type="showNewPassword ? 'text' : 'password'"
            placeholder="請輸入新密碼"
            label="新密碼"
            :error="errors.newPassword"
            required
            @focus="clearError('newPassword')"
          />
          <button
            type="button"
            class="toggle-password"
            @click="togglePasswordVisibility('new')"
            :title="showNewPassword ? '隱藏密碼' : '顯示密碼'"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="showNewPassword ? ICONS.EYE_OFF : ICONS.EYE"
              />
            </svg>
          </button>
        </div>

        <!-- 確認新密碼 -->
        <div class="password-field">
          <BaseInput
            v-model="formData.confirmPassword"
            :type="showConfirmPassword ? 'text' : 'password'"
            placeholder="請再次輸入新密碼"
            label="確認新密碼"
            :error="errors.confirmPassword"
            required
            @focus="clearError('confirmPassword')"
          />
          <button
            type="button"
            class="toggle-password"
            @click="togglePasswordVisibility('confirm')"
            :title="showConfirmPassword ? '隱藏密碼' : '顯示密碼'"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="showConfirmPassword ? ICONS.EYE_OFF : ICONS.EYE"
              />
            </svg>
          </button>
        </div>

        <!-- 密碼規則提示 -->
        <div class="password-rules">
          <p class="rules-title">密碼規則：</p>
          <ul class="rules-list">
            <li v-for="rule in passwordRules" :key="rule.message" class="rule-item">
              {{ rule.message }}
            </li>
          </ul>
        </div>

        <!-- 提交按鈕 -->
        <BaseButton
          type="submit"
          variant="primary"
          size="lg"
          full-width
          :loading="authStore.isLoggingIn"
        >
          確認修改
        </BaseButton>

        <!-- 返回登入按鈕 -->
        <div class="back-to-login">
          <button type="button" class="back-link" @click="backToLogin">返回登入頁面</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.change-password-page {
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
  gap: 1rem;
  align-items: center;
  text-align: center;
}

.logo-image {
  width: 5rem;
  height: 5rem;
  object-fit: contain;
}

.logo-text {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: white;
  letter-spacing: 0.05em;
}

.mandatory-notice {
  margin: 0;
  font-size: 0.875rem;
  color: var(--warning);
}

/* 表單區域 */
.form-wrapper {
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

/* 表單 */
.change-password-form {
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

/* 密碼規則 */
.password-rules {
  padding: 1rem;
  background: rgb(255 255 255 / 3%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: var(--r-md);
}

.rules-title {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(255 255 255 / 80%);
}

.rules-list {
  padding-left: 1.25rem;
  margin: 0;
  list-style-type: disc;
}

.rule-item {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: rgb(255 255 255 / 60%);
}

/* 返回登入 */
.back-to-login {
  margin-top: -0.5rem;
  text-align: center;
}

.back-link {
  padding: 0;
  font-size: 0.875rem;
  color: rgb(255 255 255 / 60%);
  text-decoration: none;
  cursor: pointer;
  background: none;
  border: none;
  transition: color 0.2s;
}

.back-link:hover {
  color: rgb(255 255 255 / 90%);
  text-decoration: underline;
}

/* 響應式 */
@media (width <= 640px) {
  .change-password-page {
    gap: 2rem;
    padding: 1.5rem;
  }

  .logo-image {
    width: 4rem;
    height: 4rem;
  }

  .logo-text {
    font-size: 1.5rem;
  }

  .form-wrapper {
    max-width: 100%;
  }
}
</style>
