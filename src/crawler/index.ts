/**
 * 核心爬虫模块
 * 负责协调整个爬取流程
 */

import { BrowserManager } from "../utils/browser-manager";
import { ContentExtractor } from "../utils/content-extractor";
import { WordProcessor } from "../utils/word-processor";
import { CacheManager } from "../utils/cache-manager";
import { PageInfo } from "../types";
import { fileConfig } from "../config";

/**
 * 爬取飞书文档
 * @param url 飞书文档URL
 * @param title 文档标题（可选）
 * @param useCache 是否使用缓存
 */
export async function crawlFeishuDoc(
  url: string,
  title?: string,
  useCache: boolean = true
): Promise<string> {
  const browserManager = new BrowserManager();
  const contentExtractor = new ContentExtractor();
  const wordProcessor = new WordProcessor();
  const cacheManager = new CacheManager();

  if (useCache) {
    const cache = await cacheManager.getCache(url);
    if (cache) {
      console.log("使用缓存内容");

      const pageInfo: PageInfo = {
        title: cache.title,
        textContent: cache.content,
        headings: [],
        images: [],
        links: [],
        codeBlocks: [],
        contentLength: cache.content.length,
        elementCount: 0,
      };

      const outputPath = await wordProcessor.generateWordDocument(pageInfo);
      console.log(`从缓存生成Word文档成功: ${cache.title}`);
      return outputPath;
    }
  }

  try {
    console.log("启动浏览器...");
    await browserManager.launch();

    console.log(`正在访问页面: ${url}`);
    await browserManager.navigate(url);

    await browserManager.waitForPageReady();

    const pageTitle = await browserManager.evaluate(() => document.title);
    const safeTitle = pageTitle
      .replace(fileConfig.safeTitleRegex, fileConfig.safeTitleReplace)
      .replace(/_{2,}/g, "_")
      .trim();
    const outputDir = fileConfig.outputDir(safeTitle);
    
    const pageInfo = await contentExtractor.extract(browserManager.getPage()!, outputDir);
    console.log(`内容提取完成，提取到 ${pageInfo.contentLength} 个字符`);

    console.log("正在处理图片...");
    const processedImages = await contentExtractor.processImages(pageInfo.images);
    pageInfo.images = processedImages;
    console.log(`图片处理完成，成功下载 ${processedImages.length} 张图片`);

    console.log("正在生成Word文档...");
    const outputPath = await wordProcessor.generateWordDocument(pageInfo, outputDir);
    console.log("Word文档生成成功");

    if (useCache) {
      await cacheManager.setCache(url, pageInfo.textContent, pageInfo.title);
      console.log("缓存已保存");
    }

    console.log(`飞书文档爬取完成: ${pageInfo.title}`);
    return outputPath;
  } catch (error) {
    console.error("爬取失败:", error);
    throw error;
  } finally {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await browserManager.close();
  }
}
