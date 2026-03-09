/**
 * 浏览器管理模块
 * 负责浏览器的启动、配置和操作
 */

import puppeteer, { Browser, Page } from "puppeteer";
import { browserConfig, crawlConfig } from "../config";
import { ScrollHandler } from "./scroll-handler";
import { ButtonDetector } from "./button-detector";
import { ContentExpander } from "./content-expander";
import { ApiInterceptor } from "./api-interceptor";

/**
 * 浏览器管理类
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private scrollHandler: ScrollHandler | null = null;
  private buttonDetector: ButtonDetector | null = null;
  private contentExpander: ContentExpander | null = null;
  private apiInterceptor: ApiInterceptor | null = null;

  /**
   * 启动浏览器
   */
  async launch(): Promise<void> {
    console.log("启动浏览器...");
    // 启动浏览器时指定忽略默认的空白页面
    this.browser = await puppeteer.launch({
      ...browserConfig,
      defaultViewport: null, // 禁用默认视口，使用浏览器的默认视口
    });

    // 获取浏览器的所有页面
    const pages = await this.browser.pages();

    // 关闭所有现有页面，只保留一个
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }

    // 使用第一个页面（如果有的话），否则创建新页面
    if (pages.length > 0) {
      this.page = pages[0];
    } else {
      this.page = await this.browser.newPage();
    }

    // 初始化模块
    this.scrollHandler = new ScrollHandler(this.page);
    this.buttonDetector = new ButtonDetector(this.page);
    this.contentExpander = new ContentExpander(this.page);
    this.apiInterceptor = new ApiInterceptor(this.page);

    // 设置API拦截
    await this.apiInterceptor.setup();

    // 设置浏览器参数
    await this.setupBrowser();
  }

  /**
   * 设置浏览器参数
   */
  private async setupBrowser(): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    // 设置用户代理
    await this.page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
    );

    // 启用JavaScript
    await this.page.setJavaScriptEnabled(true);

    // 注释掉自动请求通知权限，避免每次打开浏览器都弹出弹窗
    // await this.page.evaluate(() => {
    //   if ("Notification" in window) {
    //     Notification.requestPermission().catch(err => {
    //       console.log("通知权限请求失败:", err);
    //     });
    //   }
    // });
  }

  /**
   * 访问页面
   * @param url 目标URL
   */
  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    console.log("正在访问页面...");
    await this.page.goto(url, {
      waitUntil: "networkidle2",
      timeout: crawlConfig.pageLoadTimeout,
    });
  }

  /**
   * 获取页面加载状态
   * @returns 页面是否完全加载
   */
  async getPageLoadStatus(): Promise<boolean> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    try {
      // 检查文档是否准备就绪
      const readyState = await this.page.evaluate(() => document.readyState);
      console.log(`页面加载状态: ${readyState}`);
      return readyState === "complete";
    } catch (error) {
      console.error("获取页面加载状态失败:", error);
      return false;
    }
  }

  /**
   * 等待页面完全加载
   */
  async waitForPageLoad(): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    console.log("等待页面完全加载...");
    
    // 等待文档状态变为complete
    await this.page.waitForFunction(() => document.readyState === "complete", {
      timeout: crawlConfig.pageLoadTimeout,
    });
    console.log("文档状态已变为complete");
    
    // 等待网络请求完成
    await this.page.waitForNetworkIdle({ timeout: crawlConfig.pageLoadTimeout });
    console.log("网络请求已完成");
    
    // 再等待一段时间，确保所有动态内容都已加载
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("页面已完全加载");
  }

  /**
   * 等待元素加载
   * @param selector 元素选择器
   */
  async waitForElement(selector: string): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    console.log(`等待元素加载: ${selector}`);
    await this.page.waitForSelector(selector, {
      timeout: crawlConfig.elementWaitTimeout,
    });
  }

  /**
   * 滚动到指定标题位置
   * @param index 标题索引
   */
  async scrollToHeading(index: number): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    console.log(`滚动到第 ${index} 个标题位置...`);

    await this.page.evaluate(
      (index, selectors) => {
        // 尝试找到第N个标题元素
        const headings = document.querySelectorAll(selectors);

        if (headings[index - 1]) {
          headings[index - 1].scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } else {
          // 如果找不到标题，滚动到页面的相应位置
          const scrollHeight = document.body.scrollHeight;
          const scrollPosition = (scrollHeight / 11) * (index - 1);
          window.scrollTo({ top: scrollPosition, behavior: "smooth" });
        }
      },
      index,
      crawlConfig.headingSelectors
    );

    // 等待内容加载
    await new Promise((resolve) =>
      setTimeout(resolve, crawlConfig.scrollWaitTime)
    );
  }

  /**
   * 检查是否可以滚动
   */
  async canScroll(): Promise<boolean> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    return await this.page.evaluate(() => {
      // 检查页面是否有滚动空间
      const hasScrollSpace = document.body.scrollHeight > window.innerHeight + 100;
      // 检查当前是否已经滚动到了底部
      const isAtBottom = window.scrollY >= document.body.scrollHeight - window.innerHeight - 50;

      console.log(
        `滚动检测: 总高度=${document.body.scrollHeight}, 视口高度=${window.innerHeight}, 当前滚动位置=${window.scrollY}, 有滚动空间=${hasScrollSpace}, 已到底部=${isAtBottom}`
      );

      // 即使没有滚动空间，也返回true，确保至少尝试滚动一次
      // 这样可以触发飞书文档的内容加载机制
      return true;
    });
  }

  /**
   * 获取当前滚动位置
   */
  async getScrollPosition(): Promise<number> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    return await this.page.evaluate(() => {
      return window.scrollY;
    });
  }

  /**
   * 初始化回到顶部按钮的初始状态
   */
  async initBackToTopButtonState(): Promise<void> {
    if (!this.buttonDetector) {
      throw new Error("按钮检测器未初始化");
    }
    
    await this.buttonDetector.initBackToTopButtonState();
  }

  /**
   * 检测回到顶部按钮从隐藏到显示的变化
   * @returns 是否检测到按钮从隐藏到显示的变化
   */
  async detectBackToTopButtonVisibilityChange(): Promise<boolean> {
    if (!this.buttonDetector) {
      throw new Error("按钮检测器未初始化");
    }
    
    return await this.buttonDetector.detectBackToTopButtonVisibilityChange();
  }

  /**
   * 智能滚动，确保能加载完整内容
   */
  async adaptiveScroll(): Promise<void> {
    if (!this.scrollHandler || !this.buttonDetector || !this.contentExpander) {
      throw new Error("模块未初始化");
    }

    console.log("开始智能滚动加载内容...");

    // 等待页面完全加载
    await this.waitForPageLoad();
    
    // 初始化回到顶部按钮的初始状态
    await this.buttonDetector.initBackToTopButtonState();
    
    // 执行智能滚动
    await this.scrollHandler.adaptiveScroll(() => this.buttonDetector!.hasBackToTopButton());
    
    // 展开折叠内容
    await this.contentExpander.expandContent();
    
    // 最终检查回到顶部按钮
    const finalHasBackToTopButton = await this.buttonDetector.hasBackToTopButton();
    console.log(`智能滚动完成，是否出现回到顶部按钮: ${finalHasBackToTopButton}`);
  }

  /**
   * 展开折叠内容
   * @returns 展开的元素数量
   */
  async expandContent(): Promise<number> {
    if (!this.contentExpander) {
      throw new Error("内容展开器未初始化");
    }

    return await this.contentExpander.expandContent();
  }

  /**
   * 滚动到页面底部
   */
  async scrollToBottom(): Promise<void> {
    if (!this.scrollHandler) {
      throw new Error("滚动处理器未初始化");
    }

    await this.scrollHandler.scrollToBottom();
  }

  /**
   * 执行页面评估
   * @param fn 评估函数
   * @param args 函数参数
   */
  async evaluate<T>(
    fn: (arg1: any, ...args: any[]) => T,
    ...args: any[]
  ): Promise<T> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    return (await this.page.evaluate(fn, ...args)) as T;
  }

  /**
   * 显示浏览器通知
   * @param title 通知标题
   * @param message 通知内容
   */
  async showNotification(title: string, message: string): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    await this.page.evaluate(
      (title, message) => {
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(title, {
              body: message,
              icon: "https://www.feishu.cn/favicon.ico",
            });
          } catch (err) {
            console.log("发送通知失败:", err);
          }
        }
      },
      title,
      message
    );
  }

  /**
   * 检测滚动条状态
   * @returns 滚动条状态信息
   */
  async getScrollStatus(): Promise<{ scrollHeight: number; scrollTop: number; viewportHeight: number; isAtBottom: boolean; container: string; hasScrollbar: boolean }> {
    if (!this.scrollHandler) {
      throw new Error("滚动处理器未初始化");
    }

    return await this.scrollHandler.getScrollStatus();
  }

  /**
   * 检测是否存在回到顶部按钮
   * @returns 是否存在回到顶部按钮
   */
  async hasBackToTopButton(): Promise<boolean> {
    if (!this.buttonDetector) {
      throw new Error("按钮检测器未初始化");
    }

    return await this.buttonDetector.hasBackToTopButton();
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.browser) {
      console.log("关闭浏览器...");
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * 获取当前页面
   */
  getPage(): Page | null {
    return this.page;
  }
}
