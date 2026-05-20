<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="isOpen" class="drawer-overlay" @click.self="close">
        <div class="drawer-panel">
          <!-- 標頭（固定） -->
          <div class="drawer-header">
            <div class="drawer-title-wrap">
              <svg class="title-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 class="drawer-title">生成歷程</h3>
            </div>
            <IconBtn icon="CLOSE" variant="ghost" size="sm" aria-label="關閉歷程" @click="close" />
          </div>

          <!-- 篩選列（固定；manager 可選帳號、admin 可選部門+帳號） -->
          <div v-if="isAdmin || isManager" class="drawer-filters">
            <FilterSelect
              v-if="isAdmin"
              v-model="filterDeptId"
              :options="deptFilterOptions"
              placeholder="全部部門"
              size="md"
              @update:model-value="onFilterChange"
            />
            <FilterSelect
              v-model="filterCreatedById"
              class="filter-account"
              :options="accountFilterOptions"
              placeholder="全部帳號"
              size="md"
              @update:model-value="onFilterChange"
            />
          </div>

          <!-- 列表區（可滾動；sentinel 觸發無限滾動） -->
          <div ref="listRef" class="drawer-body">
            <div
              v-if="eformStore.sessions.length === 0 && !eformStore.isSessionLoading"
              class="empty-state"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="empty-icon">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>尚無生成歷程</span>
            </div>

            <!-- 手風琴列表 -->
            <Accordion v-else :items="eformStore.sessions" :multiple="true">
              <template #header="{ item: session }">
                <div class="session-header">
                  <div class="session-header-left">
                    <div class="session-business">{{ session.businessTypeName }}</div>
                    <div class="session-meta">
                      <span class="meta-item">{{ session.generatedFiles.length }} 張表單</span>
                      <span class="meta-dot">·</span>
                      <span class="meta-item">{{ session.createdBy }}</span>
                    </div>
                  </div>
                  <div class="session-header-right">
                    <span class="session-time">{{ formatDate(session.createdAt) }}</span>
                    <!-- Accordion 元件已在右側渲染 chevron；此處不重複 -->
                  </div>
                </div>
              </template>

              <template #body="{ item: session }">
                <div class="session-files">
                  <div
                    v-for="file in session.generatedFiles"
                    :key="file.templateId"
                    class="session-file-row"
                  >
                    <FileTypeBadge label="PDF" />
                    <span class="file-name">{{ file.filename }}</span>
                  </div>
                </div>
              </template>
            </Accordion>

            <!-- 無限滾動 sentinel -->
            <div ref="sentinelRef" class="sentinel" />

            <!-- 底部載入指示 -->
            <div v-if="eformStore.isSessionLoading" class="loading-indicator">
              <span class="loading-dot" />
              <span class="loading-dot" />
              <span class="loading-dot" />
            </div>

            <!-- 已全部載入提示 -->
            <div
              v-if="
                !eformStore.hasMoreSessions &&
                eformStore.sessions.length > 0 &&
                !eformStore.isSessionLoading
              "
              class="all-loaded"
            >
              已顯示全部 {{ eformStore.sessions.length }} 筆歷程
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import type { GetSessionsParams } from '@/api/eform';
import IconBtn from '@/components/base/IconBtn.vue';
import Accordion from '@/components/common/Accordion.vue';
import FileTypeBadge from '@/components/common/FileTypeBadge.vue';
import FilterSelect from '@/components/common/FilterSelect.vue';
import { useDepartmentStore } from '@/stores/department';
import { useEFormStore } from '@/stores/eform';
import { useStaffStore } from '@/stores/staff';

interface Props {
  isOpen: boolean;
  /** 是否為 admin */
  isAdmin: boolean;
  /** 是否為 manager */
  isManager: boolean;
  /** 使用者部門 ID（manager 篩選鎖定） */
  userDepartmentId: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  userDepartmentId: null,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const eformStore = useEFormStore();
const departmentStore = useDepartmentStore();
const staffStore = useStaffStore();

const activeDepartments = departmentStore.activeDepartments;

// 部門篩選選項（FilterSelect 格式）
const deptFilterOptions = computed(() =>
  activeDepartments.map((d) => ({ value: d.id, label: d.name }))
);

// 篩選狀態（僅 admin/manager 顯示）
const filterDeptId = ref(props.isAdmin ? '' : (props.userDepartmentId ?? ''));
const filterCreatedById = ref('');

// 帳號篩選選項：依角色 scope（admin 可依所選部門收斂、否則全部；manager 僅本部門）
const accountFilterOptions = computed(() => {
  const scopeDeptId = props.isAdmin ? filterDeptId.value : props.userDepartmentId;
  return staffStore.users
    .filter((u) => !scopeDeptId || u.departmentId === scopeDeptId)
    .map((u) => ({ value: u.id, label: u.name || u.username }));
});

// 滾動容器（IntersectionObserver root）與 sentinel ref（觸發點）
const listRef = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);

// 歷程每頁筆數（無限滾動批次大小）
const SESSION_PAGE_SIZE = 10;

// ── 組合查詢參數 ──────────────────────────────────────────

function buildParams(): Omit<GetSessionsParams, 'page'> {
  const params: Omit<GetSessionsParams, 'page'> = { pageSize: SESSION_PAGE_SIZE };
  if (filterDeptId.value) params.departmentId = filterDeptId.value;
  if (filterCreatedById.value.trim()) params.createdById = filterCreatedById.value.trim();
  return params;
}

// ── 開啟抽屜時載入第一頁 ─────────────────────────────────

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      if (staffStore.users.length === 0) await staffStore.fetchStaff();
      await eformStore.fetchSessions(buildParams());
      // 開啟後掛載 sentinel observer
      setupObserver();
    } else {
      teardownObserver();
    }
  }
);

// ── 篩選變更：重新載入 ────────────────────────────────────

let filterTimer: ReturnType<typeof setTimeout> | null = null;

function onFilterChange(): void {
  if (filterTimer) clearTimeout(filterTimer);
  // 簡單 debounce：300ms 後才發請求
  filterTimer = setTimeout(async () => {
    await eformStore.fetchSessions(buildParams());
  }, 300);
}

// ── IntersectionObserver（無限滾動 sentinel） ──────────────

let observer: IntersectionObserver | null = null;

function setupObserver(): void {
  if (observer) return;
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting && eformStore.hasMoreSessions && !eformStore.isSessionLoading) {
        eformStore.loadMoreSessions(buildParams());
      }
    },
    { root: listRef.value, threshold: 0.1 }
  );
  if (sentinelRef.value) {
    observer.observe(sentinelRef.value);
  }
}

function teardownObserver(): void {
  observer?.disconnect();
  observer = null;
}

// sentinel DOM 就緒後需重新 observe（Teleport 延遲渲染）
watch(sentinelRef, (el) => {
  if (el && observer) {
    observer.observe(el);
  }
});

onBeforeUnmount(() => {
  teardownObserver();
  if (filterTimer) clearTimeout(filterTimer);
});

// ── 工具 ─────────────────────────────────────────────────

function close(): void {
  emit('close');
}

function formatDate(dateStr: string): string {
  // 顯示 yyyy/MM/dd 部分
  try {
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr.split(' ')[0] ?? dateStr;
  }
}
</script>

<style scoped>
/* 外框無圓角、左側分隔線、滿版高度 */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  justify-content: flex-end;
  background: rgb(0 0 0 / 40%);
  backdrop-filter: blur(2px);
}

.drawer-panel {
  display: flex;
  flex-direction: column;
  width: 400px;
  max-width: 92vw;
  height: 100%;
  background: var(--bg-1);
  border-left: 1px solid var(--border);
  border-radius: 0; /* 無圓角 */
  box-shadow: var(--shadow-3);
}

/* 標頭（固定） */
.drawer-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid var(--border);
}

.drawer-title-wrap {
  display: flex;
  gap: 0.625rem;
  align-items: center;
}

.title-icon {
  width: 1.25rem;
  height: 1.25rem;

  /* 改為與標題同色（深色主題即為白色），不再用主色綠 */
  color: var(--text);
}

.drawer-title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text);
}

/* 篩選列（固定） */
.drawer-filters {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
}

.drawer-filters :deep(.filter-select) {
  flex: 1;
  min-width: 120px;
}

.filter-account {
  flex: 1;
  min-width: 120px;
}

/* 列表區（唯一滾動區） */
.drawer-body {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

/* 抽屜內手風琴改為帶邊框圓角卡片 + 間距（對齊 mockup .ef-acc） */
.drawer-body :deep(.accordion-item) {
  margin-bottom: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}

.drawer-body :deep(.accordion-item:first-child) {
  border-top: 1px solid var(--border);
}

.drawer-body :deep(.accordion-body) {
  border-top: 1px solid var(--border);
}

/* 空狀態 */
.empty-state {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  padding: 3rem 1rem;
  font-size: 0.875rem;
  color: var(--text-2);
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  opacity: 0.4;
}

/* Accordion 內 session header */
.session-header {
  display: flex;
  flex: 1;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
}

.session-header-left {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}

.session-business {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}

.session-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
}

.meta-item {
  font-size: 0.8rem;
  color: var(--text-2);
}

.meta-dot {
  font-size: 0.75rem;
  color: var(--border);
}

.session-header-right {
  flex-shrink: 0;
  padding-left: 0.5rem;
}

.session-time {
  font-size: 0.8rem;
  color: var(--text-2);
  white-space: nowrap;
}

/* 展開的檔案列表 */
.session-files {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.session-file-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.5rem 0;
}

.file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8125rem;
  color: var(--text);
  white-space: nowrap;
}

/* 無限滾動 sentinel */
.sentinel {
  height: 1px;
}

/* 載入指示（三點） */
.loading-indicator {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.loading-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  background: var(--accent);
  border-radius: 50%;
  animation: dot-bounce 1.2s ease-in-out infinite;
}

.loading-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dot-bounce {
  0%,
  80%,
  100% {
    opacity: 0.5;
    transform: scale(0.7);
  }

  40% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 已全部載入 */
.all-loaded {
  padding: 0.75rem 1rem;
  font-size: 0.8rem;
  color: var(--text-2);
  text-align: center;
}

/* 抽屜動畫 */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease;
}

.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}
</style>
