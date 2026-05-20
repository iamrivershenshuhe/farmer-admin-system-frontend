/**
 * 條件式驗證（見 ADR-0004）
 */

import { required, type ValidationResult } from './primitives';

/**
 * 條件成立時才執行必填檢查
 *
 * @example
 *   // 「非 admin 必須有部門」
 *   requiredIf(role !== 'admin', departmentId, '請選擇部門')
 */
export function requiredIf(condition: boolean, value: unknown, message?: string): ValidationResult {
  if (!condition) return null;
  return required(value, message);
}

/**
 * 條件不成立時才執行必填檢查
 */
export function requiredUnless(
  condition: boolean,
  value: unknown,
  message?: string
): ValidationResult {
  return requiredIf(!condition, value, message);
}
