/**
 * 重试机制模块
 */

export interface RetryOptions {
  maxRetries: number;
  delay: number; // 延迟时间（毫秒）
  backoff: boolean; // 是否使用指数退避
  onRetry?: (error: Error, attempt: number) => void;
}

export class RetryHandler {
  private options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      delay: options.delay || 1000,
      backoff: options.backoff !== false,
      onRetry: options.onRetry,
    };
  }

  /**
   * 执行带重试的异步函数
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.options.maxRetries) {
          const delay = this.options.backoff
            ? this.options.delay * Math.pow(2, attempt - 1)
            : this.options.delay;

          console.log(
            `${context ? `[${context}] ` : ''}第 ${attempt} 次尝试失败，${delay}ms 后重试...`
          );
          console.log(`错误信息: ${lastError.message}`);

          if (this.options.onRetry) {
            this.options.onRetry(lastError, attempt);
          }

          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `${context ? `[${context}] ` : ''}执行失败，已重试 ${this.options.maxRetries} 次。最后错误: ${lastError?.message}`
    );
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
