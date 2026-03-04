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
    await this.page.waitForFunction(() => document.readyState === "complete", {
      timeout: crawlConfig.pageLoadTimeout,
    });
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
      const hasScrollSpace =
        document.body.scrollHeight > window.innerHeight + 100;
      // 检查当前是否已经滚动到了底部
      const isAtBottom =
        window.scrollY >= document.body.scrollHeight - window.innerHeight - 50;

      console.log(
        `滚动检测: 总高度=${document.body.scrollHeight}, 视口高度=${window.innerHeight}, 当前滚动位置=${window.scrollY}, 有滚动空间=${hasScrollSpace}, 已到底部=${isAtBottom}`
      );

      return hasScrollSpace && !isAtBottom;
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
   * 自适应滚动，根据内容加载情况动态调整
   */
  async adaptiveScroll(): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    console.log("开始自适应滚动...");

    // 注入进度指示器
    await this.injectProgressIndicator();
    await this.updateProgress(0, "准备中...");

    // 首先等待页面完全加载
    await this.updateProgress(10, "等待页面加载...");
    await this.waitForPageLoad();

    // 滚动到页面顶部，确保从开始位置加载
    console.log("滚动到页面顶部...");
    await this.updateProgress(20, "滚动到页面顶部...");
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
      // 触发滚动事件
      const event = new Event("scroll", { bubbles: true });
      window.dispatchEvent(event);
    });

    // 等待一小段时间，确保页面稳定
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 展开折叠内容
    await this.updateProgress(30, "展开折叠内容...");
    const initialExpanded = await this.expandContent();
    await this.showNotification(
      "爬虫进度",
      `已展开 ${initialExpanded} 个折叠内容`
    );

    // 等待展开内容加载
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let scrollCount = 0;
    const maxScrolls = 50; // 减少最大滚动次数
    let hasMoreContent = true;
    let previousHeight = 0;

    console.log("开始动态滚动...");

    // 循环滚动，直到无法再滚动或达到最大滚动次数
    while (hasMoreContent && scrollCount < maxScrolls) {
      // 获取当前页面高度
      const currentHeight = await this.page.evaluate(
        () => document.body.scrollHeight
      );

      // 检查页面高度是否变化
      if (currentHeight === previousHeight && scrollCount > 0) {
        console.log("页面高度未变化，可能已加载完成");
        break;
      }

      // 检查是否可以滚动
      hasMoreContent = await this.canScroll();
      if (!hasMoreContent) {
        console.log("已滚动到页面底部，停止滚动");
        break;
      }

      // 计算滚动位置（每次滚动到当前高度的90%）
      const scrollPosition = currentHeight * 0.9;
      console.log(
        `滚动次数: ${scrollCount}, 页面高度: ${currentHeight}, 滚动到: ${scrollPosition}`
      );

      // 计算进度
      const progress = Math.min(30 + (scrollCount / maxScrolls) * 50, 80);
      await this.updateProgress(
        progress,
        `滚动中 (${scrollCount}/${maxScrolls})...`
      );

      // 使用直接滚动替代平滑滚动，并触发滚动事件
      await this.page.evaluate((position) => {
        window.scrollTo(0, position);
        // 触发滚动事件，确保内容加载
        const event = new Event("scroll", { bubbles: true });
        window.dispatchEvent(event);
        // 触发鼠标移动事件，模拟用户交互
        const mouseEvent = new MouseEvent("mousemove", {
          bubbles: true,
          clientX: 100,
          clientY: 100,
        });
        document.dispatchEvent(mouseEvent);
      }, scrollPosition);

      // 等待内容加载（动态等待时间，根据页面大小调整）
      const waitTime = Math.min(3000 + (currentHeight / 1000) * 1000, 7000);
      console.log(`等待 ${waitTime}ms 内容加载...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // 展开折叠内容
      await this.updateProgress(progress + 5, "展开折叠内容...");
      const expandedCount = await this.expandContent();

      if (expandedCount > 0) {
        await this.showNotification(
          "爬虫进度",
          `已展开 ${expandedCount} 个新内容`
        );
        // 展开内容后等待更长时间
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // 再次滚动到当前位置，确保展开的内容被加载
      await this.page.evaluate((position) => {
        window.scrollTo(0, position);
        // 再次触发滚动事件
        const event = new Event("scroll", { bubbles: true });
        window.dispatchEvent(event);
      }, scrollPosition);

      // 等待展开的内容加载
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 更新previousHeight
      previousHeight = currentHeight;
      scrollCount++;
    }

    // 滚动到页面底部，确保所有内容加载
    console.log("滚动到页面底部，确保所有内容加载...");
    await this.updateProgress(85, "滚动到页面底部...");
    await this.scrollToBottom();

    // 等待一小段时间，确保内容完全加载
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 再次展开折叠内容
    await this.updateProgress(90, "再次展开折叠内容...");
    await this.expandContent();

    // 再次滚动到页面底部，确保所有内容加载
    console.log("再次滚动到页面底部，确保所有内容加载...");
    await this.updateProgress(95, "再次滚动到页面底部...");
    await this.scrollToBottom();

    // 等待一小段时间，确保内容完全加载
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.updateProgress(100, "滚动完成");
    await this.showNotification("爬虫进度", "内容加载完成，开始提取");

    console.log("自适应滚动完成");
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
      // 使用更直接的滚动方法，确保页面真正滚动
      window.scrollTo(0, document.body.scrollHeight);
      // 触发滚动事件，确保内容加载
      const event = new Event("scroll", { bubbles: true });
      window.dispatchEvent(event);
    });
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
   * 注入进度指示器到页面
   */
  async injectProgressIndicator(): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    await this.page.evaluate(() => {
      // 创建进度指示器元素
      const progressIndicator = document.createElement("div");
      progressIndicator.id = "crawler-progress";
      progressIndicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 4px;
        background: #f0f0f0;
        z-index: 999999;
      `;

      // 创建进度条
      const progressBar = document.createElement("div");
      progressBar.id = "crawler-progress-bar";
      progressBar.style.cssText = `
        width: 0%;
        height: 100%;
        background: #007AFF;
        transition: width 0.3s ease;
      `;

      progressIndicator.appendChild(progressBar);
      document.body.appendChild(progressIndicator);

      // 创建状态信息
      const statusInfo = document.createElement("div");
      statusInfo.id = "crawler-status";
      statusInfo.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 18px;
        border-radius: 8px;
        font-size: 13px;
        z-index: 999999;
        font-family: Arial, sans-serif;
        text-align: center;
        max-width: 70%;
        backdrop-filter: blur(5px);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
      `;
      statusInfo.textContent = "准备中...";
      document.body.appendChild(statusInfo);

      // 尝试关闭可能的登录弹窗
      const closeLoginModal = () => {
        try {
          // 飞书特定的登录弹窗关闭按钮选择器
          const closeButtons = document.querySelectorAll(
            ".login-modal-close, .modal-close, .close-btn, .btn-close, .ud__modal__close, .lx-modal__header__close"
          );
          closeButtons.forEach((button) => {
            // 检查按钮是否可见且可点击
            if ((button as HTMLElement).offsetParent !== null) {
              (button as HTMLElement).click();
            }
          });

          // 尝试点击其他可能的关闭区域
          const loginModals = document.querySelectorAll(
            ".login-modal, .modal-overlay, .login-dialog, .ud__modal, .lx-modal"
          );
          loginModals.forEach((modal) => {
            // 点击模态框外部关闭
            const overlay = modal.querySelector(
              ".modal-overlay, .ud__modal__overlay, .lx-modal__overlay"
            );
            if (overlay && (overlay as HTMLElement).offsetParent !== null) {
              (overlay as HTMLElement).click();
            }
          });
        } catch (e) {
          console.log("关闭登录弹窗失败:", e);
        }
      };

      // 立即尝试关闭登录弹窗
      closeLoginModal();

      // 2秒后再次尝试，确保弹窗完全加载
      setTimeout(closeLoginModal, 2000);

      // 5秒后再次尝试，以防弹窗延迟出现
      setTimeout(closeLoginModal, 5000);

      // 添加元素标识样式
      const style = document.createElement("style");
      style.textContent = `
        /* 已识别的内容元素 */
        .crawler-identified {
          background-color: rgba(167, 243, 208, 0.2) !important;
          border: 1px solid #22c55e !important;
          border-radius: 4px !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 1px 3px rgba(34, 197, 94, 0.2) !important;
        }
        
        /* 已提取的标题 */
        .crawler-heading {
          background-color: rgba(147, 197, 253, 0.2) !important;
          border: 1px solid #3b82f6 !important;
          border-radius: 4px !important;
          font-weight: bold !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 1px 3px rgba(59, 130, 246, 0.2) !important;
        }
        
        /* 未处理的元素 */
        .crawler-unprocessed {
          background-color: rgba(254, 243, 199, 0.2) !important;
          border: 1px dashed #f59e0b !important;
          border-radius: 4px !important;
          transition: all 0.3s ease !important;
        }
        
        /* 提取状态标签 */
        .crawler-status-tag {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #22c55e;
          color: white;
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 12px;
          z-index: 9999;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        /* 排除的元素 - 不标记为已识别 */
        .login, .login-modal, .login-dialog, .ud__modal, .lx-modal, .login-btn, .register-btn, .auth-form,
        .btn, .button, .sidebar, .outline, .catalog, .wiki-sidebar, .doc-outline,
        .header, .footer, .nav, .navigation, .menu, .toolbar, .tool-bar,
        .share, .comment, .like, .favorite, .bookmark, .action, .actions,
        .avatar, .user, .profile, .settings, .preferences, .notification, .notifications,
        .ads, .advertisement, .promotion, .banner, .popup, .modal, .overlay {
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
      `;
      document.head.appendChild(style);
    });
  }

  /**
   * 标记已识别的内容元素
   */
  async markIdentifiedElements(): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    await this.page.evaluate((config: any) => {
      // 检查元素是否应该被排除
      const shouldExcludeElement = (element: Element): boolean => {
        const excludeClasses = [
          'login', 'login-modal', 'login-dialog', 'ud__modal', 'lx-modal', 'login-btn', 'register-btn', 'auth-form',
          'btn', 'button', 'sidebar', 'outline', 'catalog', 'wiki-sidebar', 'doc-outline',
          'header', 'footer', 'nav', 'navigation', 'menu', 'toolbar', 'tool-bar',
          'share', 'comment', 'like', 'favorite', 'bookmark', 'action', 'actions',
          'avatar', 'user', 'profile', 'settings', 'preferences', 'notification', 'notifications',
          'ads', 'advertisement', 'promotion', 'banner', 'popup', 'modal', 'overlay'
        ];
        
        // 检查元素本身的类
        for (const cls of excludeClasses) {
          if (element.classList.contains(cls)) {
            return true;
          }
        }
        
        // 检查元素是否包含排除类的子元素
        for (const cls of excludeClasses) {
          if (element.querySelector('.' + cls)) {
            return true;
          }
        }
        
        // 检查元素是否包含登录/注册相关文本
        const text = element.textContent || '';
        if (text.includes('登录') || text.includes('注册') || text.includes('Login') || text.includes('Register')) {
          return true;
        }
        
        return false;
      };

      // 标记内容容器
      for (const selector of config.contentContainers) {
        const containers = document.querySelectorAll(selector);
        containers.forEach((container: any) => {
          if (!shouldExcludeElement(container)) {
            container.classList.add("crawler-identified");
            // 添加状态标签
            const tag = document.createElement("div");
            tag.className = "crawler-status-tag";
            tag.textContent = "已识别";
            container.style.position = "relative";
            container.appendChild(tag);
          }
        });
      }

      // 标记标题元素
      const headings = document.querySelectorAll(config.headingSelectors);
      headings.forEach((heading: any) => {
        if (!shouldExcludeElement(heading)) {
          heading.classList.add("crawler-heading");
          // 添加状态标签
          const tag = document.createElement("div");
          tag.className = "crawler-status-tag";
          tag.textContent = "标题";
          heading.style.position = "relative";
          heading.appendChild(tag);
        }
      });

      // 标记可展开元素
      const expandableElements = document.querySelectorAll(
        config.expandableSelectors
      );
      expandableElements.forEach((element: any) => {
        if (!shouldExcludeElement(element)) {
          element.classList.add("crawler-identified");
          // 添加状态标签
          const tag = document.createElement("div");
          tag.className = "crawler-status-tag";
          tag.textContent = "可展开";
          element.style.position = "relative";
          element.appendChild(tag);
        }
      });

      console.log(
        `标记了 ${
          document.querySelectorAll(".crawler-identified").length
        } 个已识别元素`
      );
      console.log(
        `标记了 ${
          document.querySelectorAll(".crawler-heading").length
        } 个标题元素`
      );
    }, crawlConfig);
  }

  /**
   * 更新进度指示器
   * @param progress 进度百分比 (0-100)
   * @param status 状态信息
   */
  async updateProgress(progress: number, status: string): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    await this.page.evaluate(
      (progress, status) => {
        const progressBar = document.getElementById("crawler-progress-bar");
        const statusInfo = document.getElementById("crawler-status");

        if (progressBar) {
          progressBar.style.width = `${progress}%`;
        }

        if (statusInfo) {
          statusInfo.textContent = status;
        }
      },
      progress,
      status
    );
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
