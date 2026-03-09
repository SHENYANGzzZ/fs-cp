/**
 * 内容展开模块
 * 负责展开页面中的折叠内容
 */

import { Page } from "puppeteer";
import { crawlConfig } from "../config";

/**
 * 内容展开器类
 */
export class ContentExpander {
  private page: Page;

  /**
   * 构造函数
   * @param page 页面对象
   */
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 展开折叠内容
   * @returns 展开的元素数量
   */
  async expandContent(): Promise<number> {
    const expandedCount = await this.page.evaluate((selectors) => {
      // 扩展的折叠元素选择器
      const expandableSelectors = [
        ...selectors,
        'button:contains("展开")',
        'span:contains("展开")',
        '.expand-btn',
        '.collapse-btn',
        '.toggle-btn',
        '.expand-icon',
        '[data-action="expand"]',
        '[class*="expand"]',
        '[class*="toggle"]',
        '[class*="collapse"]'
      ];
      
      const expandableElements = new Set<HTMLElement>();
      
      // 收集所有可能的折叠元素
      expandableSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            expandableElements.add(element as HTMLElement);
          });
        } catch (e) {
          // 忽略选择器错误
        }
      });
      
      let clicked = 0;

      expandableElements.forEach((element: any) => {
        try {
          // 检查元素是否可见
          if (element.offsetParent !== null) {
            // 检查元素是否包含展开相关文本或类
            const hasExpandText = element.textContent?.includes("展开") || 
                               element.innerText?.includes("展开") ||
                               element.title?.includes("展开") ||
                               element.getAttribute('aria-label')?.includes("展开");
            
            const hasExpandClass = element.classList.contains("expand") ||
                                element.classList.contains("toggle") ||
                                element.classList.contains("collapse") ||
                                element.classList.contains("expand-btn") ||
                                element.classList.contains("toggle-btn") ||
                                element.classList.contains("collapse-btn");
            
            // 检查元素是否与登录/注册相关
            const isLoginRelated = 
              element.classList.contains("login") ||
              element.classList.contains("register") ||
              element.classList.contains("auth") ||
              element.classList.contains("ud__modal") ||
              element.classList.contains("lx-modal") ||
              element.textContent?.includes("登录") ||
              element.textContent?.includes("注册") ||
              element.innerText?.includes("登录") ||
              element.innerText?.includes("注册") ||
              element.querySelector(".login") ||
              element.querySelector(".register") ||
              element.querySelector(".auth");

            // 只点击与展开相关且非登录相关的元素
            if ((hasExpandText || hasExpandClass) && !isLoginRelated) {
              // 尝试点击元素
              element.click();
              clicked++;
            }
          }
        } catch (e) {
          // 忽略点击错误
        }
      });

      return clicked;
    }, crawlConfig.expandableSelectors);

    console.log(`展开了 ${expandedCount} 个元素`);

    // 等待展开内容加载
    if (expandedCount > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, crawlConfig.expandWaitTime)
      );
    }

    return expandedCount;
  }
}
