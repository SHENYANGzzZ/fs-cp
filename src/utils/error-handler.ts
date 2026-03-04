/**
 * 错误处理模块
 * 提供统一的错误处理机制
 */

/**
 * 错误类型枚举
 */
export enum ErrorType {
  NETWORK = "网络错误",
  BROWSER = "浏览器错误",
  EXTRACTION = "内容提取错误",
  FILE = "文件操作错误",
  VALIDATION = "参数验证错误",
  OTHER = "其他错误",
}

/**
 * 错误信息接口
 */
export interface ErrorInfo {
  type: ErrorType;
  message: string;
  context: string;
  stack?: string;
  details?: any;
}

/**
 * 处理错误
 * @param error 错误对象
 * @param context 错误上下文
 * @param type 错误类型
 * @param details 错误详情
 */
export function handleError(
  error: any,
  context: string,
  type: ErrorType = ErrorType.OTHER,
  details?: any
): void {
  const errorInfo: ErrorInfo = {
    type,
    message: error.message || "未知错误",
    context,
    stack: error.stack,
    details,
  };

  console.error(`\n=== 错误信息 ===`);
  console.error(`错误类型: ${errorInfo.type}`);
  console.error(`错误上下文: ${errorInfo.context}`);
  console.error(`错误消息: ${errorInfo.message}`);

  if (errorInfo.details) {
    console.error(`错误详情: ${JSON.stringify(errorInfo.details, null, 2)}`);
  }

  if (errorInfo.stack) {
    console.error(`错误堆栈:`);
    console.error(errorInfo.stack);
  }
  console.error(`=== 错误信息结束 ===\n`);
}

/**
 * 验证URL是否有效
 * @param url URL地址
 * @returns 是否有效
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全地执行异步操作
 * @param fn 异步函数
 * @param context 上下文
 * @param type 错误类型
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: string,
  type: ErrorType = ErrorType.OTHER
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context, type);
    return null;
  }
}
