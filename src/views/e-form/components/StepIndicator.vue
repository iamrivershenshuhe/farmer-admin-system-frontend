<template>
  <div class="ef-steps">
    <template v-for="(step, index) in steps" :key="step.id">
      <div
        class="ef-step"
        :class="{
          'is-done': currentStep > step.id,
          'is-active': currentStep === step.id,
        }"
      >
        <span class="ef-step-dot">
          <svg
            v-if="currentStep > step.id"
            class="ef-step-check"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <template v-else>{{ step.id }}</template>
        </span>
        <span class="ef-step-label">{{ step.label }}</span>
      </div>
      <span
        v-if="index < steps.length - 1"
        class="ef-step-line"
        :class="{ 'is-done': currentStep > step.id }"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentStep: number;
}

withDefaults(defineProps<Props>(), {
  currentStep: 1,
});

const steps = [
  { id: 1, label: '選擇業務別與表單' },
  { id: 2, label: '填入申請人資訊' },
  { id: 3, label: '生成與下載' },
] as const;
</script>

<style scoped>
.ef-steps {
  display: flex;
  align-items: center;
}

.ef-step {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.ef-step-dot {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 50%;
}

.ef-step.is-active .ef-step-dot {
  color: var(--text-on-accent);
  background: var(--accent);
  border-color: var(--accent);
}

.ef-step.is-done .ef-step-dot {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
}

.ef-step-check {
  width: 16px;
  height: 16px;
}

.ef-step-label {
  font-size: 13px;
  color: var(--text-3);
}

.ef-step.is-active .ef-step-label,
.ef-step.is-done .ef-step-label {
  color: var(--text);
}

.ef-step-line {
  flex: 1;
  min-width: 24px;
  height: 1px;
  margin: 0 0.75rem;
  background: var(--border);
}

.ef-step-line.is-done {
  background: var(--accent);
}

@media (width <= 767px) {
  .ef-step-label {
    display: none;
  }
}
</style>
