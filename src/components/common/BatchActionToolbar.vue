<template>
  <div class="batch-toolbar">
    <span class="batch-count">已選取 {{ count }} 項</span>
    <div class="batch-actions">
      <button v-if="showLifecycle" class="btn-cancel" @click="$emit('confirm-activate')">
        啟用
      </button>
      <button v-if="showLifecycle" class="btn-cancel" @click="$emit('confirm-deactivate')">
        停用
      </button>
      <button class="btn-danger-outline" @click="$emit('confirm-delete')">刪除</button>
      <button class="btn-cancel" @click="$emit('cancel')">取消</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  count: number;
  /** 啟用後顯示「啟用 / 停用」批次按鈕（組織管理用，其他頁預設不顯示） */
  showDeactivate?: boolean;
}

const props = withDefaults(defineProps<Props>(), { showDeactivate: false });
const showLifecycle = computed(() => props.showDeactivate);

defineEmits<{
  'confirm-delete': [];
  'confirm-deactivate': [];
  'confirm-activate': [];
  cancel: [];
}>();
</script>

<style scoped>
.batch-toolbar {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.625rem 1rem;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.batch-count {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
}

.batch-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

/* 對齊設計系統 .btn 家族：同尺寸、膠囊圓角 */
.btn-danger-outline,
.btn-cancel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: var(--r-pill);
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

/* 刪除＝實心 danger（設計系統唯一允許實心紅的確認動作） */
.btn-danger-outline {
  color: var(--text-on-accent);
  background: var(--error);
}

.btn-danger-outline:hover {
  background: var(--error-hover);
}

/* 取消＝中性 ghost */
.btn-cancel {
  color: var(--text);
  background: transparent;
  border-color: var(--border-strong);
}

.btn-cancel:hover {
  background: var(--bg-hover);
}
</style>
