/**
 * 檔案驗證（見 ADR-0004）
 */

import type { ValidationResult, Validator } from './primitives';

/**
 * 檔案大小上限（bytes）
 *
 * @example maxFileSize(10 * 1024 * 1024)  // 10MB
 */
export function maxFileSize(maxBytes: number, message?: string): Validator<File> {
  return (file) => {
    if (!(file instanceof File)) return '不是有效檔案';
    if (file.size > maxBytes) {
      const mb = Math.round((maxBytes / 1024 / 1024) * 10) / 10;
      return message ?? `檔案大小超過 ${mb}MB`;
    }
    return null;
  };
}

/**
 * 允許副檔名清單（不分大小寫，可含或不含前置 dot）
 *
 * @example allowedExtensions(['pdf', 'doc', 'docx'])
 */
export function allowedExtensions(extensions: string[], message?: string): Validator<File> {
  const normalized = new Set(extensions.map((e) => e.toLowerCase().replace(/^\./, '')));
  return (file) => {
    if (!(file instanceof File)) return '不是有效檔案';
    const dot = file.name.lastIndexOf('.');
    const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : '';
    if (!normalized.has(ext)) {
      return message ?? `不支援的檔案類型（允許：${[...normalized].join(', ')}）`;
    }
    return null;
  };
}

/**
 * 同時檢查大小與副檔名；任一失敗回傳第一個錯誤訊息
 */
export function fileConstraints(opts: {
  maxBytes?: number;
  extensions?: string[];
  maxBytesMessage?: string;
  extensionsMessage?: string;
}): Validator<File> {
  const validators: Array<Validator<File>> = [];
  if (opts.extensions) validators.push(allowedExtensions(opts.extensions, opts.extensionsMessage));
  if (opts.maxBytes !== undefined)
    validators.push(maxFileSize(opts.maxBytes, opts.maxBytesMessage));
  return (file) => {
    for (const v of validators) {
      const result: ValidationResult = v(file);
      if (result !== null) return result;
    }
    return null;
  };
}
