/**
 * 缓存管理模块
 * 用于避免重复爬取相同的文档
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { crawlConfig } from '../config';

/**
 * 缓存项接口
 */
export interface CacheItem {
  url: string;
  content: string;
  timestamp: number;
  etag?: string;
}

/**
 * 缓存管理器类
 */
export class CacheManager {
  private cacheDir: string;
  private cacheExpiry: number;

  constructor() {
    this.cacheDir = crawlConfig.cacheConfig.cacheDir;
    this.cacheExpiry = crawlConfig.cacheConfig.cacheExpiry;
    
    // 创建缓存目录
    this.createCacheDir();
  }

  /**
   * 创建缓存目录
   */
  private createCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 生成缓存键
   * @param url 文档URL
   */
  private generateCacheKey(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  /**
   * 获取缓存文件路径
   * @param url 文档URL
   */
  private getCachePath(url: string): string {
    const key = this.generateCacheKey(url);
    return path.join(this.cacheDir, `${key}.json`);
  }

  /**
   * 检查缓存是否存在且有效
   * @param url 文档URL
   */
  async hasValidCache(url: string): Promise<boolean> {
    const cachePath = this.getCachePath(url);
    
    if (!fs.existsSync(cachePath)) {
      return false;
    }
    
    try {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const now = Date.now();
      
      // 检查缓存是否过期
      if (now - cacheData.timestamp > this.cacheExpiry) {
        return false;
      }
      
      return true;
    } catch (error) {
      // 缓存文件损坏，视为无效
      return false;
    }
  }

  /**
   * 获取缓存内容
   * @param url 文档URL
   */
  async getCache(url: string): Promise<CacheItem | null> {
    const cachePath = this.getCachePath(url);
    
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    
    try {
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const now = Date.now();
      
      // 检查缓存是否过期
      if (now - cacheData.timestamp > this.cacheExpiry) {
        return null;
      }
      
      return cacheData;
    } catch (error) {
      // 缓存文件损坏，返回null
      return null;
    }
  }

  /**
   * 设置缓存
   * @param url 文档URL
   * @param content 文档内容
   * @param etag ETag（可选）
   */
  async setCache(url: string, content: string, etag?: string): Promise<void> {
    const cachePath = this.getCachePath(url);
    const cacheItem: CacheItem = {
      url,
      content,
      timestamp: Date.now(),
      etag
    };
    
    try {
      fs.writeFileSync(cachePath, JSON.stringify(cacheItem, null, 2));
      console.log(`缓存已保存: ${url}`);
    } catch (error) {
      console.error('保存缓存失败:', error);
    }
  }

  /**
   * 删除缓存
   * @param url 文档URL
   */
  async deleteCache(url: string): Promise<void> {
    const cachePath = this.getCachePath(url);
    
    if (fs.existsSync(cachePath)) {
      try {
        fs.unlinkSync(cachePath);
        console.log(`缓存已删除: ${url}`);
      } catch (error) {
        console.error('删除缓存失败:', error);
      }
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanExpiredCache(): Promise<void> {
    try {
      const files = fs.readdirSync(this.cacheDir);
      const now = Date.now();
      
      files.forEach(file => {
        const filePath = path.join(this.cacheDir, file);
        try {
          const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (now - cacheData.timestamp > this.cacheExpiry) {
            fs.unlinkSync(filePath);
            console.log(`清理过期缓存: ${file}`);
          }
        } catch (error) {
          // 文件损坏，删除
          fs.unlinkSync(filePath);
        }
      });
    } catch (error) {
      console.error('清理过期缓存失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{ total: number; expired: number }> {
    try {
      const files = fs.readdirSync(this.cacheDir);
      const now = Date.now();
      let total = 0;
      let expired = 0;
      
      files.forEach(file => {
        const filePath = path.join(this.cacheDir, file);
        try {
          const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          total++;
          if (now - cacheData.timestamp > this.cacheExpiry) {
            expired++;
          }
        } catch (error) {
          // 文件损坏，不计入统计
        }
      });
      
      return { total, expired };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return { total: 0, expired: 0 };
    }
  }
}
