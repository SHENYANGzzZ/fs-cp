/**
 * 飞书文档爬虫主模块
 */

import { BrowserManager } from '../utils/browser-manager.js';
import { ContentExtractor } from '../utils/content-extractor.js';
import { FileProcessor } from '../utils/file-processor.js';
import { fileConfig } from '../config/index.js';
import path from 'path';

/**
 * 飞书文档爬虫类
 */
export class FeishuCrawler {
  constructor() {
    this.browserManager = new BrowserManager();
    this.contentExtractor = new ContentExtractor();
  }

  /**
   * 爬取飞书文档
   * @param {string} url 飞书文档URL
   * @returns {Promise<Object>} 爬取结果
   */
  async crawl(url) {
    let result = {
      success: false,
      message: '',
      data: null,
    };

    try {
      // 初始化浏览器
      await this.browserManager.init();
      
      // 导航到文档URL
      await this.browserManager.navigate(url);
      
      // 智能滚动加载内容
      await this.browserManager.smartScroll();

      // 获取拦截到的API响应
      const apiResponses = this.browserManager.getApiResponses();
      console.log(`拦截到 ${apiResponses.length} 个API响应`);

      // 尝试从API响应中提取内容
      let pageInfo = null;
      if (apiResponses.length > 0) {
        console.log('尝试从API响应中提取内容...');
        pageInfo = await this.contentExtractor.extractFromApiResponses(apiResponses);
      }

      // 如果API提取失败，使用传统DOM提取
      if (!pageInfo || pageInfo.contentLength < 500) {
        console.log('API提取内容不足，使用DOM提取...');
        const page = this.browserManager.getPage();
        pageInfo = await this.contentExtractor.extract(page);
      }

      console.log(`最终提取内容长度: ${pageInfo.contentLength}`);

      // 生成安全的文件名
      const safeFileName = FileProcessor.generateSafeFileName(pageInfo.title);
      
      // 创建输出目录
      const outputDir = path.join(fileConfig.outputDir, safeFileName);
      
      // 保存提取的内容
      FileProcessor.saveTextFile(pageInfo.textContent, 'extracted_content', outputDir);
      
      // 保存Markdown文件
      if (fileConfig.fileTypes.markdown) {
        FileProcessor.saveMarkdownFile(pageInfo.textContent, safeFileName, outputDir);
      }
      
      // 保存Word文档
      if (fileConfig.fileTypes.word) {
        await FileProcessor.saveWordFile(pageInfo.textContent, safeFileName, outputDir);
      }
      
      // 保存页面信息
      FileProcessor.saveJsonFile(pageInfo, 'page_info', outputDir);
      
      // 处理图片
      if (pageInfo.images && pageInfo.images.length > 0) {
        const processedImages = await this.contentExtractor.processImages(pageInfo.images);
        FileProcessor.saveJsonFile(processedImages, 'images', outputDir);
      }
      
      // 关闭浏览器
      await this.browserManager.close();
      
      // 更新结果
      result.success = true;
      result.message = '爬取成功';
      result.data = {
        title: pageInfo.title,
        contentLength: pageInfo.contentLength,
        headings: pageInfo.headings.length,
        images: pageInfo.images.length,
        outputDir: outputDir,
      };
      
      console.log('爬取完成:', result.data);
      
    } catch (error) {
      console.error('爬取失败:', error);
      result.message = `爬取失败: ${error.message}`;
      
      // 尝试关闭浏览器
      try {
        await this.browserManager.close();
      } catch (closeError) {
        console.error('关闭浏览器失败:', closeError);
      }
      
      // 尝试使用简单HTTP请求作为备用方案
      console.log('尝试使用简单HTTP请求作为备用方案...');
      try {
        const pageInfo = await this.contentExtractor.extractFromUrl(url);
        
        // 生成安全的文件名
        const safeFileName = FileProcessor.generateSafeFileName(pageInfo.title);
        
        // 创建输出目录
        const outputDir = path.join(fileConfig.outputDir, safeFileName);
        
        // 保存提取的内容
        FileProcessor.saveTextFile(pageInfo.textContent, 'extracted_content', outputDir);
        
        // 保存Markdown文件
        if (fileConfig.fileTypes.markdown) {
          FileProcessor.saveMarkdownFile(pageInfo.textContent, safeFileName, outputDir);
        }
        
        // 保存Word文档
        if (fileConfig.fileTypes.word) {
          await FileProcessor.saveWordFile(pageInfo.textContent, safeFileName, outputDir);
        }
        
        // 保存页面信息
        FileProcessor.saveJsonFile(pageInfo, 'page_info', outputDir);
        
        // 更新结果
        result.success = true;
        result.message = '使用备用方案爬取成功';
        result.data = {
          title: pageInfo.title,
          contentLength: pageInfo.contentLength,
          headings: pageInfo.headings.length,
          images: pageInfo.images.length,
          outputDir: outputDir,
        };
        
        console.log('备用方案爬取完成:', result.data);
        
      } catch (fetchError) {
        console.error('备用方案也失败了:', fetchError);
        result.message += `，备用方案也失败: ${fetchError.message}`;
      }
    }

    return result;
  }
}

/**
 * 主函数
 */
async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('请提供飞书文档URL');
    process.exit(1);
  }
  
  const url = args[0];
  console.log(`开始爬取飞书文档: ${url}`);
  
  // 创建爬虫实例
  const crawler = new FeishuCrawler();
  
  // 执行爬取
  const result = await crawler.crawl(url);
  
  // 输出结果
  console.log('爬取结果:', result);
  
  if (result.success) {
    console.log('爬取成功！');
    process.exit(0);
  } else {
    console.error('爬取失败！');
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
