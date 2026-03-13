/**
 * 滚动控制器
 * 负责页面滚动和懒加载处理
 * 确保页面内容完全加载后再进行截图
 */

import { Page } from "puppeteer";
import {
  ViewportInfo,
  ScrollOptions,
  DEFAULT_SCROLL_OPTIONS,
} from "./types";

export class ScrollController {
  private page: Page;
  private options: ScrollOptions;

  constructor(page: Page, options?: Partial<ScrollOptions>) {
    this.page = page;
    this.options = { ...DEFAULT_SCROLL_OPTIONS, ...options };
  }

  /**
   * 获取视口信息
   * 包括视口尺寸、滚动位置、文档高度等
   */
  async getViewportInfo(): Promise<ViewportInfo> {
    const info = await this.page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      
      // 直接返回原始数据，不进行复杂计算
      return {
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        scrollY: window.scrollY,
        scrollHeight: Math.max(body.scrollHeight, html.scrollHeight, html.offsetHeight),
        scrollWidth: document.documentElement.scrollWidth,
        devicePixelRatio: window.devicePixelRatio,
        debug: {
          bodyScrollHeight: body.scrollHeight,
          htmlScrollHeight: html.scrollHeight,
          htmlOffsetHeight: html.offsetHeight,
          contentHeight: 0,
          foundContent: false,
          iframeCount: document.querySelectorAll('iframe').length,
        },
      };
    });
    
    console.log(`  DOM高度: body=${info.debug.bodyScrollHeight}, html=${info.debug.htmlScrollHeight}, 最终=${info.scrollHeight}, 滚动位置: ${info.scrollY}px`);
    
    return {
      innerHeight: info.innerHeight,
      innerWidth: info.innerWidth,
      scrollY: info.scrollY,
      scrollHeight: info.scrollHeight,
      scrollWidth: info.scrollWidth,
      devicePixelRatio: info.devicePixelRatio,
    };
  }

  /**
   * 滚动到页面底部并等待懒加载完成
   * 通过检测页面高度稳定性判断懒加载是否完成
   */
  async scrollToBottomAndWait(): Promise<void> {
    console.log("正在滚动到底部并等待懒加载...");

    // 首先设置一个较大的视口，确保能看到更多内容
    await this.page.setViewport({
      width: 1280,
      height: 1000,
      deviceScaleFactor: 1
    });

    await this.waitForDelay(2000);

    // 找到飞书文档的实际滚动容器
    const scrollContainer = await this.page.evaluate(() => {
      // 飞书文档的主要滚动容器
      const selectors = [
        '.bear-web-x-container',
        '.wiki-content',
        '.doc-content',
        '.content',
        '.main-content',
        '[role="main"]',
        'main'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          return {
            selector: selector,
            found: true,
            scrollHeight: element.scrollHeight,
            scrollTop: (element as HTMLElement).scrollTop
          };
        }
      }
      
      return {
        selector: 'body',
        found: false,
        scrollHeight: document.body.scrollHeight,
        scrollTop: document.body.scrollTop
      };
    });
    
    console.log(`  找到滚动容器: ${scrollContainer.selector}, 找到=${scrollContainer.found}, 滚动高度=${scrollContainer.scrollHeight}, 滚动位置=${scrollContainer.scrollTop}`);

    const startTime = Date.now();
    let lastHeight = scrollContainer.scrollHeight;
    let stableCount = 0;
    const requiredStableCount = 3;
    let scrollAttempts = 0;
    const maxScrollAttempts = 30;

    while (Date.now() - startTime < this.options.lazyLoadTimeout && scrollAttempts < maxScrollAttempts) {
      console.log(`  执行第 ${scrollAttempts + 1} 次滚动`);
      
      // 直接操作滚动容器
      if (scrollContainer.found) {
        console.log(`  直接滚动飞书容器...`);
        const scrollResult = await this.page.evaluate((selector) => {
          const element = document.querySelector(selector) as HTMLElement;
          if (element) {
            const beforeScroll = element.scrollTop;
            element.scrollTop = element.scrollHeight;
            const afterScroll = element.scrollTop;
            return {
              beforeScroll: beforeScroll,
              afterScroll: afterScroll,
              scrollHeight: element.scrollHeight
            };
          }
          return {
            beforeScroll: 0,
            afterScroll: 0,
            scrollHeight: 0
          };
        }, scrollContainer.selector);
        
        console.log(`  容器滚动结果: 滚动前=${scrollResult.beforeScroll}, 滚动后=${scrollResult.afterScroll}, 滚动高度=${scrollResult.scrollHeight}`);
      } else {
        // 没有找到特定容器，使用窗口滚动
        console.log(`  使用窗口滚动...`);
        await this.page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
        });
      }
      
      // 等待内容加载
      await this.waitForDelay(4000);

      // 获取最新的容器状态
      const containerStatus = await this.page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement;
        if (element) {
          return {
            scrollHeight: element.scrollHeight,
            scrollTop: element.scrollTop
          };
        }
        return {
          scrollHeight: document.body.scrollHeight,
          scrollTop: document.body.scrollTop
        };
      }, scrollContainer.selector);
      
      console.log(`  容器状态: 滚动高度=${containerStatus.scrollHeight}px, 滚动位置=${containerStatus.scrollTop}px`);

      if (containerStatus.scrollHeight === lastHeight && lastHeight > 0) {
        stableCount++;
        if (stableCount >= requiredStableCount) {
          console.log("页面高度稳定，懒加载完成");
          return;
        }
      } else {
        stableCount = 0;
        lastHeight = containerStatus.scrollHeight;
      }

      scrollAttempts++;
    }

    if (scrollAttempts >= maxScrollAttempts) {
      console.log("达到最大滚动次数，继续执行");
    } else {
      console.log("达到最大等待时间，继续执行");
    }
    
    // 最后一次尝试
    console.log("  最后一次尝试滚动");
    
    // 直接设置滚动容器到底部
    if (scrollContainer.found) {
      await this.page.evaluate((selector) => {
        const element = document.querySelector(selector) as HTMLElement;
        if (element) {
          element.scrollTop = element.scrollHeight;
        }
      }, scrollContainer.selector);
    } else {
      // 没有找到特定容器，使用窗口滚动
      await this.page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
    }
    
    await this.waitForDelay(3000);
    
    // 检查最终状态
    const finalStatus = await this.page.evaluate((selector) => {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        return {
          scrollHeight: element.scrollHeight,
          scrollTop: element.scrollTop
        };
      }
      return {
        scrollHeight: document.body.scrollHeight,
        scrollTop: document.body.scrollTop
      };
    }, scrollContainer.selector);
    
    console.log(`  最终状态: 滚动高度=${finalStatus.scrollHeight}px, 滚动位置=${finalStatus.scrollTop}px`);
  }

  /**
   * 滚动到页面顶部
   */
  async scrollToTop(): Promise<void> {
    console.log("滚动到页面顶部...");
    
    // 使用直接的滚动方法
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    });
    
    await this.waitForDelay(1000);
    
    // 验证滚动位置
    const viewportInfo = await this.getViewportInfo();
    console.log(`  滚动到顶部后位置: ${viewportInfo.scrollY}px`);
  }

  /**
   * 滚动到指定Y坐标
   * @param y Y坐标位置
   */
  async scrollTo(y: number): Promise<void> {
    console.log(`滚动到位置 ${y}px...`);
    
    // 使用直接的滚动方法
    await this.page.evaluate((targetY) => {
      window.scrollTo(0, targetY);
      document.body.scrollTop = targetY;
      document.documentElement.scrollTop = targetY;
    }, y);
    
    await this.waitForDelay(800);
    
    // 验证滚动位置
    const viewportInfo = await this.getViewportInfo();
    console.log(`  滚动后位置: ${viewportInfo.scrollY}px (目标: ${y}px)`);
  }

  /**
   * 检测是否已到达页面底部
   */
  async isAtBottom(): Promise<boolean> {
    const viewportInfo = await this.getViewportInfo();
    const scrolledTo = viewportInfo.scrollY + viewportInfo.innerHeight;
    return scrolledTo >= viewportInfo.scrollHeight - 5;
  }

  /**
   * 根据视口高度每次往下滚动固定高度
   * @returns 实际滚动的高度
   */
  async scrollByViewportHeight(): Promise<number> {
    console.log("根据视口高度滚动...");
    
    // 获取视口信息
    const viewportInfo = await this.getViewportInfo();
    const viewportHeight = viewportInfo.innerHeight;
    const currentScrollY = viewportInfo.scrollY;
    
    // 计算目标滚动位置
    const targetScrollY = currentScrollY + viewportHeight;
    
    // 确保不超过文档高度
    const maxScrollY = viewportInfo.scrollHeight - viewportHeight;
    const finalScrollY = Math.min(targetScrollY, maxScrollY);
    
    // 执行滚动
    await this.scrollTo(finalScrollY);
    
    // 计算实际滚动的高度
    const newViewportInfo = await this.getViewportInfo();
    const actualScrollHeight = newViewportInfo.scrollY - currentScrollY;
    
    console.log(`  视口高度: ${viewportHeight}px, 当前位置: ${currentScrollY}px, 目标位置: ${finalScrollY}px, 实际滚动: ${actualScrollHeight}px`);
    
    return actualScrollHeight;
  }

  /**
   * 计算需要截取的次数
   * @param viewportHeight 视口高度
   */
  async calculateScreenshotCount(viewportHeight: number): Promise<number> {
    const viewportInfo = await this.getViewportInfo();
    const totalHeight = viewportInfo.scrollHeight;
    return Math.ceil(totalHeight / viewportHeight);
  }

  /**
   * 等待指定时间
   * @param ms 毫秒数
   */
  private async waitForDelay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
