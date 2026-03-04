/**
 * HTTP工具模块
 * 提供HTTP相关的工具函数
 */

import { validateUrl } from "./error-handler";

/**
 * 验证URL是否有效
 * @param url URL地址
 * @returns 是否有效
 */
export function isValidUrl(url: string): boolean {
  return validateUrl(url);
}
