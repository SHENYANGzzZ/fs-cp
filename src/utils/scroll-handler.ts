/**
 * 滚动处理模块
 * 负责页面滚动逻辑
 */

import { Page } from "puppeteer";
import { crawlConfig } from "../config";

/**
 * 滚动处理器类
 */
export class ScrollHandler {
  private page: Page;

  /**
   * 构造函数
   * @param page 页面对象
   */
  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 检查是否可以滚动
   */
  async canScroll(): Promise<boolean> {
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
    return await this.page.evaluate(() => {
      return window.scrollY;
    });
  }

  /**
   * 滚动到页面底部
   */
  async scrollToBottom(): Promise<void> {
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
   * 滚动到指定标题位置
   * @param index 标题索引
   */
  async scrollToHeading(index: number): Promise<void> {
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
   * 智能滚动，确保能加载完整内容
   * @param backToTopButtonDetector 回到顶部按钮检测器
   */
  async adaptiveScroll(backToTopButtonDetector: () => Promise<boolean>): Promise<void> {
    console.log("开始智能滚动加载内容...");

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
    const maxScrolls = 30; // 增加最大滚动次数
    let isContentComplete = false;
    let previousScrollHeight = 0;
    let stableScrollCount = 0;
    
    // 循环滚动，直到内容完全加载或达到最大滚动次数
    while (scrollCount < maxScrolls) {
      // 检查当前滚动高度
      const currentScrollStatus = await this.getScrollStatus();
      const currentScrollHeight = currentScrollStatus.scrollHeight;
      
      // 检查滚动高度是否稳定
      if (currentScrollHeight === previousScrollHeight) {
        stableScrollCount++;
        if (stableScrollCount >= 3) {
          console.log("滚动高度稳定，内容已完全加载，停止滚动");
          isContentComplete = true;
          break;
        }
      } else {
        stableScrollCount = 0;
      }
      
      previousScrollHeight = currentScrollHeight;
      
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
            // 更细粒度的滚动，确保所有内容都能被加载
            const scrollPosition = (element.scrollHeight / 15) * (step % 15);
            element.scrollTop = scrollPosition;
            break;
          }
        }
      }, scrollCount);
      
      // 等待内容加载
      await new Promise(resolve => setTimeout(resolve, 3000)); // 增加等待时间
      
      // 检查回到顶部按钮是否从隐藏变为显示
      const hasBackToTopButton = await backToTopButtonDetector();
      if (hasBackToTopButton) {
        console.log("检测到回到顶部按钮，内容已完全加载，停止滚动");
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
    
    // 等待最终内容加载
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  /**
   * 检测滚动条状态
   * @returns 滚动条状态信息
   */
  async getScrollStatus(): Promise<{ scrollHeight: number; scrollTop: number; viewportHeight: number; isAtBottom: boolean; container: string; hasScrollbar: boolean }> {
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
}
