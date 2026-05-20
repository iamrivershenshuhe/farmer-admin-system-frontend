import { reactive, readonly } from 'vue';

import { ApiError } from '@/types/api';

/**
 * Toast 種類
 *
 * 對應視覺點綴色（見 Toast.vue）：
 *  - success → --accent
 *  - error   → --error
 *  - warning → --warning
 *  - info    → --info
 */
export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  handler: () => void;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** 0 = 不自動消失，需手動呼叫 dismiss */
  duration: number;
  action?: ToastAction;
}

export interface ToastOptions {
  /** 自訂顯示時長（ms）；0 = 不自動消失 */
  duration?: number;
  action?: ToastAction;
}

const DEFAULT_DURATIONS: Record<ToastKind, number> = {
  success: 3000,
  info: 3000,
  warning: 4000,
  error: 5000,
};

/** 堆疊上限；超過時擠掉最舊一則 */
const MAX_TOASTS = 5;

// 模組級單例佇列：Toast UI 元件監聽此佇列渲染。
// 註：這是「真正全域 UI 狀態」（同 useFilePreview 之類偽 store 的對立面）：
// 因為 toast 通知本質上屬整個應用的單一視覺資源，不該由特定元件持有。
const queue = reactive<ToastItem[]>([]);
let nextId = 1;

function push(kind: ToastKind, message: string, options?: ToastOptions): number {
  const id = nextId++;
  const duration = options?.duration ?? DEFAULT_DURATIONS[kind];
  const item: ToastItem = { id, kind, message, duration, action: options?.action };

  if (queue.length >= MAX_TOASTS) {
    queue.shift();
  }
  queue.push(item);

  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id: number): void {
  const idx = queue.findIndex((t) => t.id === id);
  if (idx !== -1) queue.splice(idx, 1);
}

function clear(): void {
  queue.splice(0, queue.length);
}

/**
 * 全域通知接縫（見 ADR-0005）
 *
 * 使用方式：
 *   const notify = useNotification()
 *   notify.success('儲存成功')
 *   notify.error('刪除失敗')
 *
 *   try { await store.action() }
 *   catch (e) { notify.fromApiError(e, '操作失敗') }
 *
 * 約束：
 *  - view 永遠透過此接縫，**不**自己渲染 toast DOM
 *  - store action **不**呼叫此接縫（責任邊界見 ADR-0005 §4）
 *  - 樣式呈現由 Toast.vue 元件負責；本檔僅維護資料佇列
 */
export function useNotification() {
  function success(message: string, options?: ToastOptions): number {
    return push('success', message, options);
  }

  function error(message: string, options?: ToastOptions): number {
    return push('error', message, options);
  }

  function warning(message: string, options?: ToastOptions): number {
    return push('warning', message, options);
  }

  function info(message: string, options?: ToastOptions): number {
    return push('info', message, options);
  }

  /**
   * 從未知錯誤一鍵呈現
   *
   * 處理順序：
   *  1. ApiError → 使用 err.message
   *  2. 一般 Error → 使用 err.message
   *  3. 其他 → 使用 fallback
   */
  function fromApiError(err: unknown, fallback = '操作失敗'): number {
    if (ApiError.isApiError(err)) {
      return error(err.message || fallback);
    }
    if (err instanceof Error) {
      return error(err.message || fallback);
    }
    return error(fallback);
  }

  return {
    /** 唯讀佇列；Toast 元件監聽渲染 */
    queue: readonly(queue),
    success,
    error,
    warning,
    info,
    fromApiError,
    dismiss,
    clear,
  };
}
