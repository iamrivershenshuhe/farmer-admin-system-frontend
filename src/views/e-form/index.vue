<template>
  <!-- 固定視窗容器：外層不捲，flex column -->
  <div class="ef-app">
    <!-- 頂部：StepIndicator 固定 -->
    <div class="ef-top">
      <StepIndicator :current-step="currentStep" />
    </div>

    <!-- 中段：唯一 overflow-y:auto 內容區 -->
    <div class="ef-body">
      <Transition name="step-slide" mode="out-in">
        <!-- 步驟 1：選擇業務別與表單 -->
        <div v-if="currentStep === 1" key="step1" class="ef-step">
          <BusinessSelector
            v-model:selected-business-id="selectedBusinessId"
            v-model:selected-template-ids="selectedTemplateIds"
            :is-admin="isAdmin"
            :is-manager="isManager"
            :user-department-id="userStore.userDepartmentId"
            :user-business-type-ids="userStore.userBusinessTypeIds"
          />
        </div>

        <!-- 步驟 2：填入申請人資訊 -->
        <div v-else-if="currentStep === 2" key="step2" class="ef-step">
          <ApplicantForm
            v-model="applicantData"
            :union-fields="unionFields"
            :selected-count="selectedTemplateIds.length"
            :show-errors="showFormErrors"
          />
        </div>

        <!-- 步驟 3：生成與下載 -->
        <div v-else key="step3" class="ef-step">
          <GenerateResult
            v-if="generateResult"
            :generated-files="generateResult.generatedFiles"
            :business-type-name="generateResult.businessTypeName"
            :zip-url="generateResult.zipUrl"
            :filled-data="applicantData"
            :expires-at="generateResult.expiresAt"
          />
          <div v-else class="ef-generating">
            <div class="gen-spinner" />
            <p class="gen-text">正在生成表單，請稍候…</p>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 底部導覽固定 -->
    <div class="ef-footer">
      <!-- 左：生成歷程按鈕（無寫死 badge） -->
      <IconBtn icon="CLOCK" label="生成歷程" variant="secondary" @click="showHistory = true" />

      <!-- 右：上一步 / 下一步或生成 / 重新開始 -->
      <div class="nav-actions">
        <IconBtn
          v-if="currentStep > 1 && currentStep < 3"
          icon="ARROW_LEFT"
          label="上一步"
          variant="secondary"
          @click="prevStep"
        />

        <!-- 步驟 1、2：下一步 / 生成表單 -->
        <BaseButton
          v-if="currentStep < 3"
          variant="primary"
          :disabled="!canProceed"
          :loading="isGenerating"
          @click="nextStep"
        >
          {{ currentStep === 2 ? '生成表單' : '下一步' }}
        </BaseButton>

        <!-- 步驟 3：重新開始 -->
        <IconBtn
          v-if="currentStep === 3"
          icon="REGENERATE"
          label="重新開始"
          variant="secondary"
          @click="handleRestart"
        />
      </div>
    </div>

    <!-- 側邊歷程抽屜 -->
    <SessionHistory
      :is-open="showHistory"
      :is-admin="isAdmin"
      :is-manager="isManager"
      :user-department-id="userStore.userDepartmentId"
      @close="showHistory = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import BaseButton from '@/components/base/BaseButton.vue';
import IconBtn from '@/components/base/IconBtn.vue';
import { usePermission } from '@/composables/usePermission';
import { useBusinessTypeStore } from '@/stores/business-type';
import { useDepartmentStore } from '@/stores/department';
import { useEFormStore } from '@/stores/eform';
import { useUserStore } from '@/stores/user';
import type { ApplicantFieldDef, GeneratedFile } from '@/types/form';

import ApplicantForm from './components/ApplicantForm.vue';
import BusinessSelector from './components/BusinessSelector.vue';
import GenerateResult from './components/GenerateResult.vue';
import SessionHistory from './components/SessionHistory.vue';
import StepIndicator from './components/StepIndicator.vue';

const { isAdmin, isManager } = usePermission();
const eformStore = useEFormStore();
const userStore = useUserStore();
const departmentStore = useDepartmentStore();
const businessTypeStore = useBusinessTypeStore();

onMounted(async () => {
  await departmentStore.fetchDepartments();
});

// 步驟狀態
const currentStep = ref(1);

// 步驟 1：業務別與表單選取
const selectedBusinessId = ref('');
const selectedTemplateIds = ref<string[]>([]);

// 步驟 2：申請人填寫資料
const applicantData = ref<Record<string, string>>({});
const showFormErrors = ref(false);

// 步驟 3：生成結果
interface GenerateResultState {
  generatedFiles: GeneratedFile[];
  businessTypeName: string;
  expiresAt: string;
  zipUrl: string;
}
const generateResult = ref<GenerateResultState | null>(null);
const isGenerating = ref(false);

// 歷程抽屜
const showHistory = ref(false);

// Computed
const unionFields = computed<ApplicantFieldDef[]>(() =>
  selectedTemplateIds.value.length > 0 ? eformStore.getUnionFields(selectedTemplateIds.value) : []
);

const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return selectedBusinessId.value !== '' && selectedTemplateIds.value.length > 0;
  }
  if (currentStep.value === 2) {
    return unionFields.value.every((f) => !f.required || !!applicantData.value[f.key]?.trim());
  }
  return false;
});

// 步驟導覽
async function nextStep(): Promise<void> {
  if (currentStep.value === 1) {
    currentStep.value = 2;
    return;
  }

  if (currentStep.value === 2) {
    showFormErrors.value = true;
    if (!canProceed.value) return;

    // 生成：批次呼叫 store action
    isGenerating.value = true;
    try {
      const result = await eformStore.generateBatchPdfs({
        templateIds: selectedTemplateIds.value,
        businessTypeId: selectedBusinessId.value,
        // businessTypeName 需從業務別 store 取，此處先用預留欄
        businessTypeName: _resolveBusinessTypeName(),
        applicantData: applicantData.value,
      });

      // 檔名由後端定義，前端直接採用回傳清單（步驟 3 與歷程一致）
      generateResult.value = {
        generatedFiles: result.files,
        businessTypeName: _resolveBusinessTypeName(),
        expiresAt: result.expiresAt,
        zipUrl: result.downloadUrl,
      };

      currentStep.value = 3;
    } catch (err) {
      console.error('[EForm] 生成失敗：', err);
    } finally {
      isGenerating.value = false;
    }
  }
}

function prevStep(): void {
  showFormErrors.value = false;
  currentStep.value--;
}

function handleRestart(): void {
  currentStep.value = 1;
  selectedBusinessId.value = '';
  selectedTemplateIds.value = [];
  applicantData.value = {};
  showFormErrors.value = false;
  generateResult.value = null;
}

/** 由 businessTypeStore 已載入的清單解析所選業務別名稱 */
function _resolveBusinessTypeName(): string {
  for (const list of Object.values(businessTypeStore.businessTypesByDept)) {
    const found = list.find((bt) => bt.id === selectedBusinessId.value);
    if (found) return found.name;
  }
  return '';
}
</script>

<style scoped>
/* 固定視窗卡片容器：有邊框/圓角/底色，外層不捲（對齊設計系統 mockup） */
.ef-app {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 960px;
  height: calc(100% - 2rem);
  min-height: 0;
  margin: 1rem auto;
  overflow: hidden;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
}

/* 頂部：StepIndicator 固定，不捲 */
.ef-top {
  flex-shrink: 0;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

/* 中段：唯一捲動區 */
.ef-body {
  flex: 1;
  min-height: 0;
  padding: 1.5rem;
  overflow-y: auto;
}

.ef-step {
  width: 100%;
}

/* 底部導覽：固定，不捲 */
.ef-footer {
  display: flex;
  flex-shrink: 0;
  gap: 0.75rem;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--bg);
  border-top: 1px solid var(--border);
}

.nav-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-left: auto;
}

/* 生成中佔位 */
.ef-generating {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  height: 240px;
}

.gen-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid var(--accent-soft);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.gen-text {
  font-size: 0.9rem;
  color: var(--text-2);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 步驟切換動畫 */
.step-slide-enter-active,
.step-slide-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.step-slide-enter-from {
  opacity: 0;
  transform: translateX(16px);
}

.step-slide-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
</style>
