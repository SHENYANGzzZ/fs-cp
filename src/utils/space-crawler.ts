/**
 * 飞书知识库空间爬虫
 * 负责从知识库空间页面提取所有文档链接
 */

import { BrowserManager } from "./browser-manager";
import { Page } from "puppeteer";

export interface SpaceDocument {
  title: string;
  url: string;
  type: string; // wiki, doc, sheet等
}

export class SpaceCrawler {
  private browserManager: BrowserManager;

  constructor() {
    this.browserManager = new BrowserManager();
  }

  /**
   * 从知识库空间页面提取所有文档链接
   * @param spaceUrl 知识库空间URL
   * @returns 文档列表
   */
  async extractDocuments(spaceUrl: string): Promise<SpaceDocument[]> {
    const documents: SpaceDocument[] = [];

    try {
      console.log("启动浏览器...");
      await this.browserManager.launch();

      const page = this.browserManager.getPage();
      if (!page) {
        throw new Error("页面未初始化");
      }

      console.log(`访问知识库空间: ${spaceUrl}`);
      await this.browserManager.navigate(spaceUrl);

      // 等待页面加载
      console.log("等待页面加载...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 尝试多种选择器来查找文档链接
      const docLinks = await this.findDocumentLinks(page);

      console.log(`找到 ${docLinks.length} 个文档链接`);

      for (const link of docLinks) {
        documents.push(link);
      }

      await this.browserManager.close();
    } catch (error) {
      console.error("提取文档链接失败:", error);
      await this.browserManager.close();
      throw error;
    }

    return documents;
  }

  /**
   * 查找页面中的文档链接
   */
  private async findDocumentLinks(page: Page): Promise<SpaceDocument[]> {
    const documents: SpaceDocument[] = [];

    try {
      // 等待可能的文档列表容器加载
      await page.waitForSelector('body', { timeout: 10000 });

      // 提取所有可能的文档链接
      const links = await page.evaluate(() => {
        const results: Array<{ title: string; url: string; type: string }> = [];

        // 查找所有包含 wiki 或 doc 的链接
        const allLinks = document.querySelectorAll('a[href*="wiki"], a[href*="doc"], a[href*="docx"]');

        allLinks.forEach((link) => {
          const href = (link as HTMLAnchorElement).href;
          const title = link.textContent?.trim() || '';

          // 过滤掉无效链接
          if (href && title && title.length > 0 && title.length < 200) {
            let type = 'unknown';
            if (href.includes('/wiki/')) {
              type = 'wiki';
            } else if (href.includes('/doc/')) {
              type = 'doc';
            } else if (href.includes('/docx/')) {
              type = 'docx';
            }

            results.push({ title, url: href, type });
          }
        });

        return results;
      });

      // 去重
      const uniqueUrls = new Set<string>();
      for (const link of links) {
        if (!uniqueUrls.has(link.url)) {
          uniqueUrls.add(link.url);
          documents.push(link);
        }
      }

      console.log(`提取到 ${documents.length} 个唯一文档链接`);

      // 打印前5个链接作为示例
      console.log("示例文档:");
      documents.slice(0, 5).forEach((doc, index) => {
        console.log(`  ${index + 1}. [${doc.type}] ${doc.title}`);
        console.log(`     ${doc.url}`);
      });

    } catch (error) {
      console.error("查找文档链接时出错:", error);
    }

    return documents;
  }

  /**
   * 滚动页面以加载更多内容
   */
  private async scrollToLoadMore(page: Page): Promise<void> {
    console.log("滚动页面以加载更多内容...");

    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.body.scrollHeight);
    let noChangeCount = 0;

    while (noChangeCount < 3) {
      // 滚动到底部
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // 等待新内容加载
      await new Promise((resolve) => setTimeout(resolve, 2000));

      previousHeight = currentHeight;
      currentHeight = await page.evaluate(() => document.body.scrollHeight);

      if (currentHeight === previousHeight) {
        noChangeCount++;
      } else {
        noChangeCount = 0;
      }
    }

    console.log("滚动完成");
  }
}
