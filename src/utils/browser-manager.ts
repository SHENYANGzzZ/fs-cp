/**
 * 浏览器管理模块
 * 负责浏览器的启动、配置和操作
 */

import puppeteer, { Browser, Page } from "puppeteer";
import { browserConfig, crawlConfig } from "../config";

/**
 * 浏览器管理类
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private initialBackToTopButtonState: boolean = false;

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
    if (!this.page) {
      throw new Error("页面未初始化");
    }
    
    console.log("初始化回到顶部按钮状态...");
    this.initialBackToTopButtonState = await this.hasBackToTopButton();
    console.log(`回到顶部按钮初始状态: ${this.initialBackToTopButtonState}`);
  }

  /**
   * 检测回到顶部按钮从隐藏到显示的变化
   * @returns 是否检测到按钮从隐藏到显示的变化
   */
  async detectBackToTopButtonVisibilityChange(): Promise<boolean> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }
    
    console.log("检测回到顶部按钮可见性变化...");
    const currentState = await this.hasBackToTopButton();
    console.log(`回到顶部按钮当前状态: ${currentState}, 初始状态: ${this.initialBackToTopButtonState}`);
    
    // 检查是否从隐藏变为显示
    return !this.initialBackToTopButtonState && currentState;
  }

  /**
   * 智能滚动，确保能加载完整内容
   */
  async adaptiveScroll(): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    console.log("开始智能滚动加载内容...");

    // 等待页面完全加载
    await this.waitForPageLoad();
    
    // 初始化回到顶部按钮的初始状态
    await this.initBackToTopButtonState();
    
    // 滚动到页面顶部
    await this.page.evaluate(() => {
      // 尝试滚动飞书文档的实际滚动容器
      const scrollContainers = [
        '.page-main-item.editor',
        '.doc-content',
        '.editor-container',
        '.lark-editor-content',
        document.documentElement,
        document.body
      ];
      
      for (const container of scrollContainers) {
        let element;
        if (typeof container === 'string') {
          element = document.querySelector(container);
        } else {
          element = container;
        }
        
        if (element && element.scrollTop !== undefined) {
          element.scrollTop = 0;
          break;
        }
      }
    });
    
    let scrollCount = 0;
    const maxScrolls = 20;
    let isContentComplete = false;
    
    // 循环滚动，直到内容完全加载或达到最大滚动次数
    while (scrollCount < maxScrolls) {
      // 滚动到页面的下一个位置
      await this.page.evaluate((step) => {
        // 尝试滚动飞书文档的实际滚动容器
        const scrollContainers = [
          '.page-main-item.editor',
          '.doc-content',
          '.editor-container',
          '.lark-editor-content',
          document.documentElement,
          document.body
        ];
        
        for (const container of scrollContainers) {
          let element;
          if (typeof container === 'string') {
            element = document.querySelector(container);
          } else {
            element = container;
          }
          
          if (element && element.scrollTop !== undefined && element.scrollHeight > 0) {
            const scrollPosition = (element.scrollHeight / 10) * (step % 10);
            element.scrollTop = scrollPosition;
            break;
          }
        }
      }, scrollCount);
      
      // 等待内容加载
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 展开折叠内容
      await this.expandContent();
      
      // 检测回到顶部按钮是否从隐藏变为显示
      const hasBackToTopButtonChanged = await this.detectBackToTopButtonVisibilityChange();
      if (hasBackToTopButtonChanged) {
        console.log("回到顶部按钮从隐藏变为显示，内容已完全加载，停止滚动");
        isContentComplete = true;
        break;
      }
      
      // 检查滚动条状态，判断内容是否完整
      const scrollStatus = await this.getScrollStatus();
      console.log(`滚动条状态: 高度=${scrollStatus.scrollHeight}, 滚动位置=${scrollStatus.scrollTop}, 视口高度=${scrollStatus.viewportHeight}, 已到底部=${scrollStatus.isAtBottom}, 有滚动条=${scrollStatus.hasScrollbar}`);
      
      // 尝试滚动到页面底部，然后再次检查滚动条状态
      await this.scrollToBottom();
      const bottomScrollStatus = await this.getScrollStatus();
      console.log(`底部滚动条状态: 高度=${bottomScrollStatus.scrollHeight}, 滚动位置=${bottomScrollStatus.scrollTop}, 视口高度=${bottomScrollStatus.viewportHeight}, 已到底部=${bottomScrollStatus.isAtBottom}, 有滚动条=${bottomScrollStatus.hasScrollbar}`);
      
      // 当滚动到底部时，判断内容是否完整
      if (bottomScrollStatus.isAtBottom) {
        console.log("已滚动到底部，内容已完全加载，停止滚动");
        isContentComplete = true;
        break;
      }
      
      scrollCount++;
      console.log(`滚动次数: ${scrollCount}`);
    }
    
    // 再次滚动到页面底部，确保所有内容加载
    await this.scrollToBottom();
    
    // 最终检查回到顶部按钮
    const finalHasBackToTopButton = await this.hasBackToTopButton();
    console.log(`智能滚动完成，是否出现回到顶部按钮: ${finalHasBackToTopButton}`);
  }

  /**
   * 展开折叠内容
   * @returns 展开的元素数量
   */
  async expandContent(): Promise<number> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    const expandedCount = await this.page.evaluate((selectors) => {
      const expandableElements = document.querySelectorAll(selectors);
      let clicked = 0;

      expandableElements.forEach((element: any) => {
        try {
          // 检查元素是否可见且包含展开文本
          if (
            element.offsetParent !== null &&
            (element.textContent?.includes("展开") ||
              element.innerText?.includes("展开"))
          ) {
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

            // 跳过登录/注册相关的元素
            if (!isLoginRelated) {
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

  /**
   * 滚动到页面底部
   */
  async scrollToBottom(): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    console.log("滚动到页面底部...");
    await this.page.evaluate(() => {
      // 尝试直接操作飞书文档的滚动容器
      const feishuContainers = [
        '.page-main-item.editor',
        '.doc-content',
        '.editor-container',
        '.lark-editor-content'
      ];

      let scrolled = false;
      
      for (const selector of feishuContainers) {
        const container = document.querySelector(selector);
        if (container) {
          console.log(`找到飞书滚动容器: ${selector}`);
          console.log(`滚动前 - 高度: ${container.scrollHeight}, 滚动位置: ${container.scrollTop}`);
          
          // 尝试直接设置scrollTop到最大值
          container.scrollTop = container.scrollHeight;
          console.log(`滚动后 - 高度: ${container.scrollHeight}, 滚动位置: ${container.scrollTop}`);
          
          // 尝试使用scrollIntoView
          const lastElement = container.lastElementChild;
          if (lastElement) {
            lastElement.scrollIntoView({ behavior: 'auto', block: 'end' });
            console.log(`使用scrollIntoView滚动到最后一个元素`);
          }
          
          scrolled = true;
          break;
        }
      }

      if (!scrolled) {
        // 尝试滚动整个页面
        console.log(`未找到飞书滚动容器，尝试滚动整个页面`);
        console.log(`滚动前 - 页面高度: ${document.body.scrollHeight}, 滚动位置: ${window.scrollY}`);
        
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
        console.log(`滚动后 - 页面高度: ${document.body.scrollHeight}, 滚动位置: ${window.scrollY}`);
      }

      // 触发滚动事件
      const scrollEvent = new Event('scroll', { bubbles: true });
      window.dispatchEvent(scrollEvent);
      console.log("触发滚动事件");
    });
    // 等待滚动完成
    await new Promise((resolve) => setTimeout(resolve, 2000));
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
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    return await this.page.evaluate(() => {
      // 增加更多的滚动容器选择器，确保能捕捉到飞书文档的滚动条
      const scrollContainers = [
        '.page-main-item.editor',
        '.doc-content',
        '.editor-container',
        '.lark-editor-content',
        '.docs-doc-content',
        '.docs-editor',
        '.article-content',
        '.content-area',
        '.page-content',
        '.main-content',
        '.document-content',
        '.content-container',
        '.editor-content',
        '.rich-text-editor',
        '.prose-content',
        '.wiki-content',
        '.lark-wiki-content',
        '.feishu-wiki-content',
        'main',
        'article',
        document.documentElement,
        document.body
      ];

      let bestContainer = null;
      let bestContainerName = 'body';
      let maxScrollHeight = 0;

      // 找到滚动高度最大的容器
      for (const container of scrollContainers) {
        let element;
        let containerName;
        if (typeof container === 'string') {
          element = document.querySelector(container);
          containerName = container;
        } else {
          element = container;
          containerName = container === document.documentElement ? 'documentElement' : 'body';
        }
        
        if (element && element.scrollTop !== undefined && element.scrollHeight > 0) {
          if (element.scrollHeight > maxScrollHeight) {
            maxScrollHeight = element.scrollHeight;
            bestContainer = element;
            bestContainerName = containerName;
          }
        }
      }

      // 使用找到的最佳容器
      if (bestContainer) {
        const scrollHeight = bestContainer.scrollHeight;
        const scrollTop = bestContainer.scrollTop;
        const viewportHeight = window.innerHeight || 1080;
        const isAtBottom = scrollTop >= scrollHeight - viewportHeight - 50;
        // 检测是否有滚动条
        const hasScrollbar = scrollHeight > viewportHeight;

        console.log(`滚动容器 ${bestContainerName}: 高度=${scrollHeight}, 滚动位置=${scrollTop}, 视口高度=${viewportHeight}, 已到底部=${isAtBottom}, 有滚动条=${hasScrollbar}`);

        return {
          scrollHeight,
          scrollTop,
          viewportHeight,
          isAtBottom,
          container: bestContainerName,
          hasScrollbar
        };
      }

      // 默认返回body的滚动状态
      const scrollHeight = document.body.scrollHeight;
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight || 1080;
      const isAtBottom = scrollTop >= scrollHeight - viewportHeight - 50;
      const hasScrollbar = scrollHeight > viewportHeight;

      console.log(`默认滚动容器 body: 高度=${scrollHeight}, 滚动位置=${scrollTop}, 视口高度=${viewportHeight}, 已到底部=${isAtBottom}, 有滚动条=${hasScrollbar}`);

      return {
        scrollHeight,
        scrollTop,
        viewportHeight,
        isAtBottom,
        container: 'body',
        hasScrollbar
      };
    });
  }

  /**
   * 检测是否存在回到顶部按钮
   * @returns 是否存在回到顶部按钮
   */
  async hasBackToTopButton(): Promise<boolean> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    return await this.page.evaluate(() => {
      // 飞书文档特有的回到顶部按钮选择器
      const feishuBackToTopSelectors = [
        // 基于用户提供的按钮结构
        'button:has(span.universe-icon)',
        'button:has(svg[data-icon="SpaceUpOutlined"])',
        'button:has(svg path[d*="M12.707 2.293a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 1.414 1.414L11 5.414V22a1 1 0 1 0 2 0V5.414l5.293 5.293a1 1 0 0 0 1.414-1.414l-7-7Z"])',
        // 基于用户提供的截图，添加更通用的向上箭头图标检测
        'button:has(svg[aria-label*="回到顶部"])',
        'button:has(svg[title*="回到顶部"])',
        'button[class*="back-to-top"], button[class*="backtop"]'
      ];
      
      // 检测飞书文档特有的回到顶部按钮
      for (const selector of feishuBackToTopSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (element) {
              // 检查元素是否可见
              const style = window.getComputedStyle(element);
              const isVisible = style.display !== 'none' && 
                              style.visibility !== 'hidden' && 
                              style.opacity !== '0' && 
                              (element as HTMLElement).offsetParent !== null;
              
              // 检查元素位置是否在右下角
              const rect = element.getBoundingClientRect();
              const isBottomRight = rect.right > window.innerWidth * 0.8 && 
                                  rect.bottom > window.innerHeight * 0.8;
              
              // 检查元素是否为按钮
              const isButton = element.tagName === 'BUTTON';
              
              // 检查按钮是否包含向上箭头图标
              let hasUpArrow = false;
              const svgElements = element.querySelectorAll('svg');
              for (let j = 0; j < svgElements.length; j++) {
                const svg = svgElements[j];
                // 检查svg是否包含向上箭头相关的属性或内容
                if (svg.getAttribute('data-icon') === 'SpaceUpOutlined' ||
                    svg.getAttribute('aria-label')?.includes('回到顶部') ||
                    svg.getAttribute('title')?.includes('回到顶部') ||
                    svg.querySelector('path[d*="M12.707 2.293"]') ||
                    svg.querySelector('path[d*="M12 2l-8 8h5v10h6V10h5l-8-8z"]') ||
                    svg.querySelector('path[d*="M18 15l-6-6-6 6"]')) {
                  hasUpArrow = true;
                  break;
                }
              }
              
              // 检查按钮是否有回到顶部相关的文本
              const buttonText = element.textContent?.toLowerCase() || '';
              const hasBackToTopText = buttonText.includes('回到顶部') || 
                                       buttonText.includes('back to top') || 
                                       buttonText.includes('top') || 
                                       buttonText.includes('up');
              
              // 只有当按钮可见、在右下角、是按钮且包含向上箭头或回到顶部文本时才认为是回到顶部按钮
              if (isButton && isVisible && isBottomRight && (hasUpArrow || hasBackToTopText)) {
                console.log(`检测到回到顶部按钮: ${selector}`);
                return true;
              }
            }
          }
        } catch (e) {
          // 忽略选择器语法错误
        }
      }
      
      // 检测所有按钮元素，特别关注右下角的圆形按钮
      const buttons = document.querySelectorAll('button');
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        if (button) {
          // 检查按钮是否可见
          const style = window.getComputedStyle(button);
          const isVisible = style.display !== 'none' && 
                          style.visibility !== 'hidden' && 
                          style.opacity !== '0' && 
                          (button as HTMLElement).offsetParent !== null;
          
          // 检查按钮位置是否在右下角
          const rect = button.getBoundingClientRect();
          const isBottomRight = rect.right > window.innerWidth * 0.8 && 
                              rect.bottom > window.innerHeight * 0.8;
          
          // 检查按钮是否为圆形
          const isRound = style.borderRadius === '50%' || 
                         style.borderRadius === '9999px' || 
                         button.classList.contains('circle') ||
                         button.classList.contains('round') ||
                         button.classList.contains('rounded');
          
          // 检查按钮是否包含向上箭头
          let hasUpArrow = false;
          const svgElements = button.querySelectorAll('svg');
          for (let j = 0; j < svgElements.length; j++) {
            const svg = svgElements[j];
            if (svg.getAttribute('data-icon') === 'SpaceUpOutlined' ||
                svg.getAttribute('aria-label')?.includes('回到顶部') ||
                svg.getAttribute('title')?.includes('回到顶部') ||
                svg.querySelector('path[d*="M12.707 2.293"]') ||
                svg.querySelector('path[d*="M12 2l-8 8h5v10h6V10h5l-8-8z"]') ||
                svg.querySelector('path[d*="M18 15l-6-6-6 6"]')) {
              hasUpArrow = true;
              break;
            }
          }
          
          // 检查按钮是否有回到顶部相关的文本
          const buttonText = button.textContent?.toLowerCase() || '';
          const hasBackToTopText = buttonText.includes('回到顶部') || 
                                   buttonText.includes('back to top') || 
                                   buttonText.includes('top') || 
                                   buttonText.includes('up');
          
          // 只有当按钮可见、在右下角、是圆形且包含向上箭头时才认为是回到顶部按钮
          if (isVisible && isBottomRight && isRound && hasUpArrow) {
            console.log(`检测到回到顶部按钮: 圆形=${isRound}, 有向上箭头=${hasUpArrow}, 有回到顶部文本=${hasBackToTopText}`);
            return true;
          }
        }
      }
      
      return false;
    });
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
