/**
 * API拦截模块
 * 负责拦截网络请求，获取飞书文档的API响应
 */

import { Page } from "puppeteer";

/**
 * API拦截器类
 */
export class ApiInterceptor {
  private page: Page;
  private apiResponses: any[] = [];

  /**
   * 构造函数
   * @param page 页面对象
   */
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 设置API拦截
   */
  async setup(): Promise<void> {
    console.log("设置API拦截...");
    
    this.page.on('response', async (response) => {
      const url = response.url();
      // 查找可能的飞书文档API
      if (url.includes('wiki') || url.includes('doc') || url.includes('api') || url.includes('content')) {
        try {
          const responseBody = await response.text();
          if (responseBody.length > 1000) {
            this.apiResponses.push({ url, body: responseBody });
            console.log(`捕获到API响应: ${url}`);
          }
        } catch (e) {
          // 忽略错误
        }
      }
    });
    
    console.log("API拦截设置完成");
  }

  /**
   * 获取所有API响应
   * @returns API响应列表
   */
  getApiResponses(): any[] {
    return this.apiResponses;
  }

  /**
   * 清空API响应
   */
  clearApiResponses(): void {
    this.apiResponses = [];
  }
}
