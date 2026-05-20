/**
 * 業務規則驗證（見 ADR-0004、docs/CONTEXT.md §2）
 *
 * 此處集中跨模組共用的業務規則表達式，使「什麼是合法 X」有單一出處。
 * 模組專屬規則仍可放各自 modal/composable 內，但應 import 本檔的原語組合而成。
 */

import type { UserRole } from '@/types/user';

import { requiredIf } from './conditional';
import type { ValidationResult } from './primitives';

/**
 * 非 admin 角色必須指定所屬部門
 *
 * 規則出處：`.claude/rules/domain.md`「Staff ↔ department：只有 admin 可無部門」
 */
export function nonAdminRequiresDepartment(
  role: UserRole | null | undefined,
  departmentId: number | string | null | undefined,
  message = '非 admin 角色必須指定部門'
): ValidationResult {
  if (!role) return null;
  return requiredIf(role !== 'admin', departmentId, message);
}

/**
 * 業務別必須屬於某一部門（建立業務別時）
 *
 * 規則出處:`.claude/rules/domain.md`「Department ↔ business-type：1-to-many，業務別必屬某部門」
 */
export function businessTypeRequiresDepartment(
  departmentId: number | string | null | undefined,
  message = '業務別必須隸屬某部門'
): ValidationResult {
  if (departmentId === null || departmentId === undefined || departmentId === '') {
    return message;
  }
  return null;
}
