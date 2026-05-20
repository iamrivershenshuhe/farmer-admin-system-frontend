/**
 * 純驗證原語（見 ADR-0004）
 *
 * 規則：
 *  - 純函式，輸入 → `ValidationResult`
 *  - `null` = 通過；`string` = 錯誤訊息
 *  - 零依賴（不引用 ref/reactive、API、store）
 */

export type ValidationResult = string | null;

/** Validator：接 value 回 ValidationResult */
export type Validator<T = unknown> = (value: T) => ValidationResult;

/**
 * 必填：拒絕 null / undefined / 空字串（trim 後）/ 空陣列
 */
export function required(value: unknown, message = '此欄位必填'): ValidationResult {
  if (value === null || value === undefined) return message;
  if (typeof value === 'string' && value.trim() === '') return message;
  if (Array.isArray(value) && value.length === 0) return message;
  return null;
}

/**
 * 非空字串：拒絕非 string / trim 後為空
 */
export function nonEmptyString(value: unknown, message = '不可為空'): ValidationResult {
  if (typeof value !== 'string' || value.trim() === '') return message;
  return null;
}

/**
 * 最小長度
 */
export function minLength(min: number, message?: string): Validator<string> {
  return (value) => {
    if (typeof value !== 'string' || value.length < min) {
      return message ?? `至少 ${min} 個字元`;
    }
    return null;
  };
}

/**
 * 最大長度
 */
export function maxLength(max: number, message?: string): Validator<string> {
  return (value) => {
    if (typeof value === 'string' && value.length > max) {
      return message ?? `不可超過 ${max} 個字元`;
    }
    return null;
  };
}

/**
 * 整數
 */
export function isInteger(value: unknown, message = '必須為整數'): ValidationResult {
  if (typeof value !== 'number' || !Number.isInteger(value)) return message;
  return null;
}

/**
 * 數值範圍（含端點）
 */
export function inRange(min: number, max: number, message?: string): Validator<number> {
  return (value) => {
    if (typeof value !== 'number' || value < min || value > max) {
      return message ?? `須介於 ${min} ~ ${max}`;
    }
    return null;
  };
}

/**
 * 套用多個 validator，回傳第一個失敗訊息；全部通過則 null。
 */
export function combine<T>(...validators: Array<Validator<T>>): Validator<T> {
  return (value) => {
    for (const v of validators) {
      const result = v(value);
      if (result !== null) return result;
    }
    return null;
  };
}
