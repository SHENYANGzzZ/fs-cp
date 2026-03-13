/**
 * 缓存管理模块
 * 负责处理内容缓存以避免重复爬取
 */

import fs from "fs";
import path from "path";
import { crawlConfig } from "../config";

/**
 * 缓存项接口
 */
interface CacheItem {
  url: string;
  content: string;
  title: string;
  timestamp: number;
}

/**
 * 缓存管理器类
 */
export class CacheManager {
  private cacheDir: string;
  private cacheExpiry: number;

  /**
   * 构造函数
   */
  constructor() {
    this.cacheDir = crawlConfig.cacheConfig.cacheDir;
    this.cacheExpiry = crawlConfig.cacheConfig.cacheExpiry;

    // 确保缓存目录存在
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 生成缓存文件名
   * @param url URL
   */
  private generateCacheFilename(url: string): string {
    const hash = this.hashUrl(url);
    return path.join(this.cacheDir, `${hash}.json`);
  }

  /**
   * 对URL进行哈希处理
   * @param url URL
   */
  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 检查缓存是否有效
   * @param url URL
   */
  async hasValidCache(url: string): Promise<boolean> {
    const cacheFile = this.generateCacheFilename(url);
    
    if (!fs.existsSync(cacheFile)) {
      return false;
    }

    try {
      const cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      const now = Date.now();
      
      // 检查缓存是否过期
      if (now - cacheData.timestamp > this.cacheExpiry) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取缓存内容
   * @param url URL
   */
  async getCache(url: string): Promise<any | null> {
    const cacheFile = this.generateCacheFilename(url);
    
    if (!fs.existsSync(cacheFile)) {
      return null;
    }

    try {
      const cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      const now = Date.now();
      
      // 检查缓存是否过期
      if (now - cacheData.timestamp > this.cacheExpiry) {
        return null;
      }
      
      return cacheData;
    } catch (error) {
      return null;
    }
  }

  /**
   * 设置缓存内容
   * @param url URL
   * @param content 内容
   * @param title 标题
   */
  async setCache(url: string, content: string, title: string): Promise<void> {
    const cacheFile = this.generateCacheFilename(url);
    
    const cacheData: CacheItem = {
      url,
      content,
      title,
      timestamp: Date.now(),
    };

    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
  }

  /**
   * 清理过期缓存
   */
  async cleanExpiredCache(): Promise<void> {
    console.log("开始清理过期缓存...");
    
    if (!fs.existsSync(this.cacheDir)) {
      console.log("缓存目录不存在，无需清理");
      return;
    }

    const files = fs.readdirSync(this.cacheDir);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      
      try {
        const cacheData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        
        if (now - cacheData.timestamp > this.cacheExpiry) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (error) {
        // 忽略无效的缓存文件
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    console.log(`过期缓存清理完成，删除了 ${deletedCount} 个文件`);
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{ total: number; expired: number }> {
    if (!fs.existsSync(this.cacheDir)) {
      return { total: 0, expired: 0 };
    }

    const files = fs.readdirSync(this.cacheDir);
    const now = Date.now();
    let total = 0;
    let expired = 0;

    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      
      try {
        const cacheData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        total++;
        
        if (now - cacheData.timestamp > this.cacheExpiry) {
          expired++;
        }
      } catch (error) {
        // 忽略无效的缓存文件
        expired++;
      }
    }

    return { total, expired };
  }
}