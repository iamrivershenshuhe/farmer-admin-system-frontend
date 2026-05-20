<template>
  <Teleport to="body">
    <div class="toast-container" role="region" aria-label="通知">
      <TransitionGroup name="toast" tag="div" class="toast-stack">
        <div
          v-for="item in queue"
          :key="item.id"
          class="toast"
          :class="`toast-${item.kind}`"
          role="status"
          :aria-live="item.kind === 'error' ? 'assertive' : 'polite'"
        >
          <span class="toast-accent" aria-hidden="true"></span>
          <span class="toast-message">{{ item.message }}</span>
          <button v-if="item.action" type="button" class="toast-action" @click="handleAction(item)">
            {{ item.action.label }}
          </button>
          <button type="button" class="toast-close" aria-label="關閉通知" @click="dismiss(item.id)">
            ×
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { type ToastItem, useNotification } from '@/composables/useNotification';

const { queue, dismiss } = useNotification();

function handleAction(item: ToastItem): void {
  item.action?.handler();
  dismiss(item.id);
}
</script>

<style scoped>
/*
 * Toast UI primitive（見 ADR-0005、.claude/rules/styling.md）
 *
 * 設計紅線：
 *  - 反相對比：底色 --tooltip-bg，文字 --tooltip-text（淺色=深底白字、深色=淺底深字，自動對應）
 *  - 點綴色用左側細條（綠在點上，不爬整底）
 *  - transition 只在狀態選擇器內，基底不帶 transition（避免主題切換黑閃）
 *  - 零 hardcode 顏色
 */

.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  pointer-events: none;
}

.toast-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-end;
}

.toast {
  position: relative;
  display: inline-flex;
  gap: 12px;
  align-items: center;
  min-width: 240px;
  max-width: 420px;
  padding: 12px 16px 12px 20px;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.5;
  color: var(--tooltip-text);
  pointer-events: auto;
  background: var(--tooltip-bg);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-2);
}

/* 左側點綴條：依 kind 上色（綠在「點」上，不爬整底） */
.toast-accent {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
}

.toast-success .toast-accent {
  background: var(--accent);
}

.toast-error .toast-accent {
  background: var(--error);
}

.toast-warning .toast-accent {
  background: var(--warning);
}

.toast-info .toast-accent {
  background: var(--info);
}

.toast-message {
  flex: 1;
  overflow-wrap: anywhere;
}

.toast-action,
.toast-close {
  padding: 4px 8px;
  font: inherit;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--r-sm);
}

.toast-action:hover,
.toast-close:hover {
  background: var(--bg-hover);
  transition: background-color 0.15s ease;
}

.toast-close {
  padding: 2px 6px;
  font-size: 18px;
  line-height: 1;
}

/* 進出動畫（transition 只在狀態選擇器） */
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-leave-active {
  position: absolute;
  right: 0;
}
</style>
