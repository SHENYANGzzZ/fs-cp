/**
 * 飞书文档爬虫模块
 * 负责从飞书文档中提取内容并转换为Markdown格式
 */

import { CrawlerConfig } from "../types";
import { isValidUrl } from "../utils/http";
import { handleError, ErrorType } from "../utils/error-handler";
import { BrowserManager } from "../utils/browser-manager";
import { ContentExtractor, PageInfo } from "../utils/content-extractor";
import { WordProcessor } from "../utils/word-processor";
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
  const wordProcessor = new WordProcessor();
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

          // 生成Word文档
          const doc = wordProcessor.generateWord(pageInfo);

          // 保存Word文件
          await wordProcessor.saveWord(pageInfo, doc);

          // 打印内容信息
          console.log(`从缓存生成Word文档成功: ${pageInfo.title}`);
          return;
        }
      }
    }

    // 启动浏览器
    await browserManager.launch();

    // 获取页面
    const page = browserManager.getPage();
    if (!page) {
      throw new Error("页面未初始化");
    }

    // 监控网络请求，查找飞书文档的API调用
    console.log("监控网络请求...");
    let apiResponses: any[] = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      // 查找可能的飞书文档API
      if (url.includes('wiki') || url.includes('doc') || url.includes('api') || url.includes('content')) {
        try {
          const responseBody = await response.text();
          if (responseBody.length > 1000) {
            apiResponses.push({ url, body: responseBody });
            console.log(`捕获到API响应: ${url}`);
          }
        } catch (e) {
          // 忽略错误
        }
      }
    });

    // 访问页面
    await browserManager.navigate(url);

    // 等待页面元素加载
    await browserManager.waitForElement(".page-main-item.editor");

    // 增加等待时间，确保页面完全加载
    console.log("等待页面内容完全加载...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 初始检测滚动条状态，确保能捕捉到界面加载后的滚动条
    console.log("初始检测滚动条状态...");
    const initialScrollStatus = await browserManager.getScrollStatus();
    console.log(`初始滚动条状态: 容器=${initialScrollStatus.container}, 总高度=${initialScrollStatus.scrollHeight}, 当前位置=${initialScrollStatus.scrollTop}, 视口高度=${initialScrollStatus.viewportHeight}, 是否已到底部=${initialScrollStatus.isAtBottom}, 有滚动条=${initialScrollStatus.hasScrollbar}`);

    // 针对飞书文档的特殊结构进行优化
    console.log("开始滚动和展开内容...");

    // 重置内容提取器状态
    contentExtractor.reset();

    // 检查是否捕获到API响应
    if (apiResponses.length > 0) {
      console.log(`捕获到 ${apiResponses.length} 个API响应`);
      // 尝试从API响应中提取内容
      let extractedContentFromApi = "";
      let extractedTitle = "";
      
      for (const response of apiResponses) {
        try {
          const json = JSON.parse(response.body);
          
          // 专门查找飞书文档内容的API响应
          if (json && (
            (json.data && (json.data.content || json.data.body || json.data.title)) ||
            (json.content && typeof json.content === 'string') ||
            (json.body && typeof json.body === 'string')
          )) {
            console.log(`从API响应中找到内容数据`);
            // 保存API响应到文件，方便分析
            const fs = require('fs');
            const path = require('path');
            const apiDir = path.join(__dirname, '../../api-responses');
            if (!fs.existsSync(apiDir)) {
              fs.mkdirSync(apiDir, { recursive: true });
            }
            const fileName = `api_response_${Date.now()}.json`;
            fs.writeFileSync(path.join(apiDir, fileName), JSON.stringify(json, null, 2));
            console.log(`API响应已保存到: ${fileName}`);
            
            // 尝试从API响应中提取文本内容，更精确地过滤
            const extractTextFromJson = (obj: any): string => {
              let text = '';
              if (typeof obj === 'string') {
                // 只过滤明显的元数据和过长的随机字符串
                if (
                  obj.length > 5 && // 过滤太短的字符串
                  !obj.match(/^[0-9a-zA-Z]{30,}$/) && // 过滤过长的随机字符串
                  !obj.match(/^[0-9_]+$/) // 过滤纯数字和下划线
                ) {
                  text += obj + '\n';
                }
              } else if (Array.isArray(obj)) {
                obj.forEach((item) => {
                  text += extractTextFromJson(item);
                });
              } else if (typeof obj === 'object' && obj !== null) {
                for (const key in obj) {
                  // 优先提取可能包含实际内容的字段
                  if (key === 'text' || key === 'content' || key === 'body' || key === 'value') {
                    text += extractTextFromJson(obj[key]);
                  } else if (key === 'title' && typeof obj[key] === 'string') {
                    // 提取标题
                    if (obj[key].length > 5 && obj[key].length < 100) {
                      extractedTitle = obj[key];
                    }
                  } else if (
                    // 只递归处理可能包含内容的对象
                    typeof obj[key] === 'object' && 
                    obj[key] !== null && 
                    !Array.isArray(obj[key]) &&
                    !key.includes('config') &&
                    !key.includes('style') &&
                    !key.includes('meta') &&
                    !key.includes('header') &&
                    !key.includes('footer')
                  ) {
                    text += extractTextFromJson(obj[key]);
                  }
                }
              }
              return text;
            };
            
            const jsonContent = extractTextFromJson(json);
            if (jsonContent.length > extractedContentFromApi.length) {
              extractedContentFromApi = jsonContent;
              console.log('从API响应中提取到内容，长度:', jsonContent.length);
            }
          }
        } catch (e) {
          // 忽略错误
        }
      }
      
      // 如果从API响应中提取到了内容，直接使用
    if (extractedContentFromApi.length > 500) {
        console.log(`使用从API响应中提取的内容，长度: ${extractedContentFromApi.length}`);
        
        // 清理提取的内容，去除多余的空白和重复内容
        let cleanedContent = extractedContentFromApi
          .replace(/\n{3,}/g, '\n\n') // 最多保留两个连续换行
          .replace(/\s{2,}/g, ' ') // 多个空格替换为单个空格
          .trim();
        
        // 保存API提取的内容到文件
        const fs = require('fs');
        const path = require('path');
        const outputDir = path.join(__dirname, '../../out', 'api_extracted');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        const apiOutputPath = path.join(outputDir, 'api_extracted_content.txt');
        fs.writeFileSync(apiOutputPath, cleanedContent, 'utf8');
        console.log(`API提取的内容已保存到: ${apiOutputPath}`);
        
        // 直接使用API提取的内容
        const pageInfo: PageInfo = {
          title: extractedTitle || "AutoGen篇-AutoGen快速入门",
          textContent: cleanedContent,
          headings: [],
          images: [],
          links: [],
          codeBlocks: [],
          contentLength: cleanedContent.length,
          elementCount: 0
        };
        
        // 处理图片
        if (pageInfo.images && pageInfo.images.length > 0) {
          console.log(`开始处理 ${pageInfo.images.length} 张图片...`);
          pageInfo.images = await contentExtractor.processImages(pageInfo.images);
          console.log(`图片处理完成，成功下载 ${pageInfo.images.length} 张图片`);
        }
        
        // 输出提取的内容到文本文件，以便与原文比较
        const outputDir2 = path.join(__dirname, '../../out', pageInfo.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_'));
        if (!fs.existsSync(outputDir2)) {
          fs.mkdirSync(outputDir2, { recursive: true });
        }
        const textOutputPath = path.join(outputDir2, 'extracted_content.txt');
        fs.writeFileSync(textOutputPath, pageInfo.textContent, 'utf8');
        console.log(`提取的内容已保存到: ${textOutputPath}`);
        
        // 关闭浏览器
        await browserManager.close();
        
        // 保存缓存
        if (useCache) {
          await cacheManager.setCache(url, JSON.stringify(pageInfo));
        }
        
        // 检查文档质量
        wordProcessor.checkDocumentQuality(pageInfo);

        // 生成Word文档
        const doc = wordProcessor.generateWord(pageInfo);

        // 保存Word文件
        await wordProcessor.saveWord(pageInfo, doc);

        // 生成HTML预览
        wordProcessor.generateHtmlPreview(pageInfo);

        // 打印内容信息
        console.log(`Word文档生成成功: ${pageInfo.title}`);
        return;
      }
    }

    // 初始提取
    let incrementalResult = await contentExtractor.extractIncremental(page);
    contentExtractor.updateExtractedState(
      incrementalResult.newContent,
      incrementalResult.newHeadings
    );

    // 使用自适应滚动，根据内容加载情况动态调整
    await browserManager.adaptiveScroll();

    // 增加等待时间，确保滚动后内容完全加载
    console.log("等待滚动后内容完全加载...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 检测滚动条状态，确保内容完全加载
    console.log("检测滚动条状态...");
    const scrollStatus = await browserManager.getScrollStatus();
    console.log(`滚动条状态: 容器=${scrollStatus.container}, 总高度=${scrollStatus.scrollHeight}, 当前位置=${scrollStatus.scrollTop}, 视口高度=${scrollStatus.viewportHeight}, 是否已到底部=${scrollStatus.isAtBottom}, 有滚动条=${scrollStatus.hasScrollbar}`);

    // 检测是否出现回到顶部按钮
    console.log("检测回到顶部按钮...");
    const hasBackToTop = await browserManager.hasBackToTopButton();
    console.log(`是否出现回到顶部按钮: ${hasBackToTop}`);

    // 最终提取
    let pageInfo = await contentExtractor.extract(page);

    // 处理图片
    if (pageInfo.images && pageInfo.images.length > 0) {
      console.log(`开始处理 ${pageInfo.images.length} 张图片...`);
      pageInfo.images = await contentExtractor.processImages(pageInfo.images);
      console.log(`图片处理完成，成功下载 ${pageInfo.images.length} 张图片`);
    }

    // 输出提取的内容到文本文件，以便与原文比较
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(__dirname, '../../out', pageInfo.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_'));
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const textOutputPath = path.join(outputDir, 'extracted_content.txt');
    fs.writeFileSync(textOutputPath, pageInfo.textContent, 'utf8');
    console.log(`提取的内容已保存到: ${textOutputPath}`);

    // 关闭浏览器
    await browserManager.close();

    if (!pageInfo) {
      throw new Error("无法获取页面信息");
    }

    // 保存缓存
    if (useCache) {
      await cacheManager.setCache(url, JSON.stringify(pageInfo));
    }

    // 检查文档质量
    wordProcessor.checkDocumentQuality(pageInfo);

    // 生成Word文档
    const doc = wordProcessor.generateWord(pageInfo);

    // 保存Word文件
    await wordProcessor.saveWord(pageInfo, doc);

    // 生成HTML预览
    wordProcessor.generateHtmlPreview(pageInfo);

    // 打印内容信息
    console.log(`Word文档生成成功: ${pageInfo.title}`);
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
