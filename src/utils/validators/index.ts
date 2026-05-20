/**
 * Validators barrel
 *
 * 集中所有純驗證規則的單一出處（見 ADR-0004）。
 * 使用方式：
 *   import { required, nonAdminRequiresDepartment, fileConstraints } from '@/utils/validators'
 *
 * 註：本 barrel 屬於「utils 子目錄內部 barrel」，與 `@/types` 的 barrel-import 禁令不同
 *（types barrel 是設計禁忌，utils 子目錄 barrel 為標準慣例）。
 */

export * from './business';
export * from './conditional';
export * from './file';
export * from './primitives';
