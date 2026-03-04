/**
 * 并行处理模块
 * 用于提高爬取速度
 */

import { crawlConfig } from '../config';
import { crawlFeishuDoc } from '../crawler';

/**
 * 并行处理器类
 */
export class ParallelProcessor {
  private maxParallel: number;

  constructor() {
    this.maxParallel = crawlConfig.parallelConfig.maxParallel;
  }

  /**
   * 并行处理多个URL
   * @param urls 文档URL列表
   */
  async processMultipleUrls(urls: string[]): Promise<void> {
    console.log(`开始并行处理 ${urls.length} 个URL...`);
    console.log(`最大并行数: ${this.maxParallel}`);

    // 分批处理
    const batches = this.batchUrls(urls, this.maxParallel);
    
    for (const batch of batches) {
      console.log(`处理批次: ${batches.indexOf(batch) + 1}/${batches.length}`);
      
      // 并行处理当前批次
      const batchPromises = batch.map(url => this.processSingleUrl(url));
      await Promise.all(batchPromises);
    }

    console.log('并行处理完成');
  }

  /**
   * 处理单个URL
   * @param url 文档URL
   */
  private async processSingleUrl(url: string): Promise<void> {
    try {
      console.log(`开始处理: ${url}`);
      await crawlFeishuDoc(url);
      console.log(`处理完成: ${url}`);
    } catch (error) {
      console.error(`处理失败: ${url}`, error);
    }
  }

  /**
   * 将URL列表分批
   * @param urls URL列表
   * @param batchSize 批次大小
   */
  private batchUrls(urls: string[], batchSize: number): string[][] {
    const batches: string[][] = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      batches.push(urls.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * 并行处理函数
   * @param items 待处理项列表
   * @param processor 处理函数
   */
  async parallelProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    console.log(`开始并行处理 ${items.length} 个项...`);
    
    // 分批处理
    const batches = this.batchItems(items, this.maxParallel);
    const results: R[] = [];
    
    for (const batch of batches) {
      console.log(`处理批次: ${batches.indexOf(batch) + 1}/${batches.length}`);
      
      // 并行处理当前批次
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
    }
    
    console.log('并行处理完成');
    return results;
  }

  /**
   * 将项列表分批
   * @param items 项列表
   * @param batchSize 批次大小
   */
  private batchItems<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }
}
