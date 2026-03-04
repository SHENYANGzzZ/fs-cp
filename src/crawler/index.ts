/**
 * 飞书文档爬虫模块
 * 负责从飞书文档中提取内容并转换为Markdown格式
 */

import { CrawlerConfig } from "../types";
import { isValidUrl } from "../utils/http";
import { handleError, ErrorType } from "../utils/error-handler";
import { BrowserManager } from "../utils/browser-manager";
import { ContentExtractor, PageInfo } from "../utils/content-extractor";
import { MarkdownProcessor } from "../utils/markdown-processor";
import { CacheManager } from "../utils/cache-manager";
import { ParallelProcessor } from "../utils/parallel-processor";
import { crawlConfig } from "../config";

/**
 * 爬取飞书文档内容
 * @param url 飞书文档URL
 * @param config 爬取配置
 * @param useCache 是否使用缓存
 */
export async function crawlFeishuDoc(
  url: string,
  config?: CrawlerConfig,
  useCache: boolean = true
) {
  // 初始化模块
  const browserManager = new BrowserManager();
  const contentExtractor = new ContentExtractor();
  const markdownProcessor = new MarkdownProcessor();
  const cacheManager = new CacheManager();

  try {
    console.log("开始获取飞书文档内容...");
    console.log(`目标URL: ${url}`);

    // 验证URL
    if (!isValidUrl(url)) {
      throw new Error(`无效的URL: ${url}`);
    }

    // 检查缓存
    if (useCache) {
      const hasCache = await cacheManager.hasValidCache(url);
      if (hasCache) {
        const cachedData = await cacheManager.getCache(url);
        if (cachedData) {
          console.log("使用缓存内容");
          // 解析缓存的内容
          const pageInfo: PageInfo = JSON.parse(cachedData.content);

          // 生成Markdown内容
          const mdContent = markdownProcessor.generateMarkdown(pageInfo);

          // 保存Markdown文件
          markdownProcessor.saveMarkdown(pageInfo, mdContent);

          // 打印内容信息
          markdownProcessor.printContentInfo(pageInfo, mdContent);
          return;
        }
      }
    }

    // 启动浏览器
    await browserManager.launch();

    // 访问页面
    await browserManager.navigate(url);

    // 等待页面元素加载
    await browserManager.waitForElement(".page-main-item.editor");

    // 针对飞书文档的特殊结构进行优化
    console.log("开始滚动和展开内容...");

    // 重置内容提取器状态
    contentExtractor.reset();

    // 获取页面
    const page = browserManager.getPage();
    if (!page) {
      throw new Error("页面未初始化");
    }

    // 标记已识别的元素
    console.log("标记已识别的内容元素...");
    await browserManager.markIdentifiedElements();

    // 初始提取
    let incrementalResult = await contentExtractor.extractIncremental(page);
    contentExtractor.updateExtractedState(
      incrementalResult.newContent,
      incrementalResult.newHeadings
    );

    // 使用自适应滚动，根据内容加载情况动态调整
    await browserManager.adaptiveScroll();

    // 最终提取
    const pageInfo = await contentExtractor.extract(page);

    // 关闭浏览器
    await browserManager.close();

    if (!pageInfo) {
      throw new Error("无法获取页面信息");
    }

    // 保存缓存
    if (useCache) {
      await cacheManager.setCache(url, JSON.stringify(pageInfo));
    }

    // 生成Markdown内容
    const mdContent = markdownProcessor.generateMarkdown(pageInfo);

    // 保存Markdown文件
    markdownProcessor.saveMarkdown(pageInfo, mdContent);

    // 打印内容信息
    markdownProcessor.printContentInfo(pageInfo, mdContent);
  } catch (error) {
    // 确保浏览器关闭
    try {
      await browserManager.close();
    } catch (closeError) {
      // 忽略关闭错误
    }

    handleError(error, "获取文档内容", ErrorType.OTHER);
  }
}

/**
 * 并行爬取多个飞书文档
 * @param urls 飞书文档URL列表
 * @param config 爬取配置
 * @param useCache 是否使用缓存
 */
export async function crawlMultipleFeishuDocs(
  urls: string[],
  config?: CrawlerConfig,
  useCache: boolean = true
) {
  const parallelProcessor = new ParallelProcessor();
  await parallelProcessor.processMultipleUrls(urls);
}

/**
 * 清理过期缓存
 */
export async function cleanExpiredCache() {
  const cacheManager = new CacheManager();
  await cacheManager.cleanExpiredCache();
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats() {
  const cacheManager = new CacheManager();
  return await cacheManager.getCacheStats();
}
