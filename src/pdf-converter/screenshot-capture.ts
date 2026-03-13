/**
 * 截图捕获器
 * 负责页面的滚动截图操作
 * 支持隐藏固定定位元素以避免重复出现
 */

import { Page } from "puppeteer";
import {
  ScreenshotOptions,
  ScreenshotResult,
  DEFAULT_SCREENSHOT_OPTIONS,
} from "./types";
import { ScrollController } from "./scroll-controller";

export class ScreenshotCapture {
  private page: Page;
  private options: ScreenshotOptions;
  private scrollController: ScrollController;
  private fixedElementsStyle: string = "";

  constructor(page: Page, options?: Partial<ScreenshotOptions>) {
    this.page = page;
    this.options = { ...DEFAULT_SCREENSHOT_OPTIONS, ...options };
    this.scrollController = new ScrollController(page);
  }

  /**
   * 捕获完整页面的截图序列
   * @returns 截图结果数组
   */
  async captureFullPage(): Promise<ScreenshotResult[]> {
    console.log("开始捕获页面截图...");

    const screenshots: ScreenshotResult[] = [];
    
    // 步骤1: 先滚动到底部，确保所有内容加载完毕
    console.log("步骤1: 滚动到底部，加载所有内容...");
    await this.scrollController.scrollToBottomAndWait();
    
    // 步骤2: 再次滚动到底部，确保所有懒加载内容都已加载
    console.log("步骤2: 再次滚动到底部，确保内容完全加载...");
    await this.scrollController.scrollToBottomAndWait();
    
    // 步骤3: 隐藏不需要的元素（侧边栏、大纲等）
    console.log("步骤3: 隐藏不需要的元素...");
    await this.hideFixedElements();
    
    // 步骤4: 重新获取视口信息，确保准确的页面高度
    const viewportInfo = await this.scrollController.getViewportInfo();
    const viewportHeight = viewportInfo.innerHeight;
    
    // 步骤5: 再次滚动到底部，确保隐藏元素后页面高度正确
    console.log("步骤4: 再次滚动到底部，调整页面高度...");
    await this.scrollController.scrollToBottomAndWait();
    
    // 步骤6: 重新计算页面总高度
    const updatedViewportInfo = await this.scrollController.getViewportInfo();
    const totalHeight = updatedViewportInfo.scrollHeight;

    console.log(`视口高度: ${viewportHeight}px, 文档总高度: ${totalHeight}px`);

    const estimatedCount = Math.ceil(totalHeight / viewportHeight);
    console.log(`预计需要截取 ${estimatedCount} 张截图`);

    // 步骤7: 回到顶部开始截图
    console.log("步骤5: 回到顶部开始截图...");
    await this.scrollController.scrollToTop();
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 延长等待时间，确保页面稳定

    let currentY = 0;
    let index = 0;

    // 增加最大截图数量限制，避免无限循环
    const maxScreenshots = 200;
    let screenshotCount = 0;

    while (currentY < totalHeight && screenshotCount < maxScreenshots) {
      await this.scrollController.scrollTo(currentY);
      
      // 等待页面稳定，确保内容完全渲染
      await new Promise((resolve) => setTimeout(resolve, 800));

      const screenshot = await this.takeScreenshot();
      screenshots.push({
        buffer: screenshot,
        scrollY: currentY,
        index: index,
      });

      console.log(`已截取第 ${index + 1} 张截图 (位置: ${currentY}px, 总进度: ${((currentY / totalHeight) * 100).toFixed(1)}%)`);

      // 使用新的滚动方法，根据视口高度滚动
      const scrolledHeight = await this.scrollController.scrollByViewportHeight();
      
      // 如果滚动高度为0，说明已经到达底部
      if (scrolledHeight === 0) {
        break;
      }
      
      // 更新当前滚动位置
      const viewportInfo = await this.scrollController.getViewportInfo();
      currentY = viewportInfo.scrollY;
      
      index++;
      screenshotCount++;
    }
    
    // 确保捕获页面底部的内容
    if (screenshots.length > 0) {
      const lastScreenshot = screenshots[screenshots.length - 1];
      if (lastScreenshot.scrollY < totalHeight - 1) {
        await this.scrollController.scrollTo(totalHeight - 1);
        await new Promise((resolve) => setTimeout(resolve, 800));
        const finalScreenshot = await this.takeScreenshot();
        screenshots.push({
          buffer: finalScreenshot,
          scrollY: totalHeight - 1,
          index: index,
        });
        console.log(`已截取最后一张截图 (位置: ${totalHeight - 1}px, 总进度: 100.0%)`);
      }
    }

    await this.restoreFixedElements();

    console.log(`截图完成，共 ${screenshots.length} 张`);
    return screenshots;
  }

  /**
   * 隐藏不需要的元素
   * 包括固定定位元素和侧边栏/大纲
   */
  private async hideFixedElements(): Promise<void> {
    console.log("隐藏不需要的元素...");

    this.fixedElementsStyle = await this.page.evaluate(() => {
      const styleId = "pdf-converter-hide-fixed-style";
      let existingStyle = document.getElementById(styleId);

      if (existingStyle) {
        return existingStyle.textContent || "";
      }

      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        /* 隐藏固定定位元素 */
        [style*="position: fixed"],
        [style*="position:fixed"],
        .fixed,
        .sticky,
        [class*="header"][class*="fixed"],
        [class*="footer"][class*="fixed"],
        [class*="Header"][class*="Fixed"],
        [class*="Footer"][class*="Fixed"],
        nav[style*="fixed"],
        header[style*="fixed"],
        footer[style*="fixed"] {
          visibility: hidden !important;
          opacity: 0 !important;
        }
        
        /* 隐藏侧边栏和大纲 */
        .sidebar,
        .outline,
        .toc,
        [class*="sidebar"],
        [class*="outline"],
        [class*="TOC"],
        [class*="toc"],
        [role="navigation"],
        [class*="nav"][class*="side"],
        [class*="Nav"][class*="Side"],
        .wiki-sidebar,
        .doc-sidebar,
        .sidebar-content,
        .outline-content,
        .left-sidebar,
        .right-sidebar {
          visibility: hidden !important;
          opacity: 0 !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: 0 !important;
          display: none !important;
        }
        
        /* 确保主内容区域占据完整宽度 */
        .main-content,
        .content-main,
        .wiki-content,
        .doc-content,
        [class*="main"][class*="content"],
        [class*="content"][class*="main"],
        article,
        main {
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
      `;
      document.head.appendChild(style);

      return style.textContent;
    });
  }

  /**
   * 恢复固定定位元素
   */
  private async restoreFixedElements(): Promise<void> {
    console.log("恢复固定定位元素...");

    await this.page.evaluate(() => {
      const styleId = "pdf-converter-hide-fixed-style";
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    });
  }

  /**
   * 执行单次截图
   */
  private async takeScreenshot(): Promise<Buffer> {
    const screenshot = await this.page.screenshot({
      type: this.options.type,
      encoding: "binary",
    });

    return screenshot as Buffer;
  }

  /**
   * 设置视口尺寸
   */
  async setViewport(): Promise<void> {
    await this.page.setViewport({
      width: this.options.viewportWidth,
      height: this.options.viewportHeight,
      deviceScaleFactor: this.options.deviceScaleFactor,
    });
  }

  /**
   * 获取当前截图选项
   */
  getOptions(): ScreenshotOptions {
    return { ...this.options };
  }
}
