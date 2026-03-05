/**
 * 简单的HTTP请求模块
 * 用于当puppeteer无法使用时获取页面内容
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * 简单的HTTP请求类
 */
export class SimpleFetcher {
  /**
   * 获取页面内容
   * @param {string} url 页面URL
   * @returns {Promise<string>} 页面内容
   */
  static async fetch(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      return response.data;
    } catch (error) {
      console.error('HTTP请求失败:', error);
      throw error;
    }
  }

  /**
   * 解析HTML内容
   * @param {string} html HTML内容
   * @returns {Object} 解析后的Cheerio对象
   */
  static parseHtml(html) {
    return cheerio.load(html);
  }

  /**
   * 从HTML中提取飞书文档内容
   * @param {string} html HTML内容
   * @returns {Object} 提取的内容
   */
  static extractFeishuContent(html) {
    const $ = this.parseHtml(html);
    
    let content = '';
    let title = '';
    let images = [];
    
    // 提取标题
    title = $('title').text().trim();
    
    // 尝试从script标签中提取JSON数据
    let jsonData = null;
    $('script').each((index, script) => {
      const scriptContent = $(script).html();
      if (scriptContent) {
        // 尝试找到包含文档内容的JSON数据
        const jsonMatches = scriptContent.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
        if (jsonMatches) {
          try {
            jsonData = JSON.parse(jsonMatches[1]);
          } catch (error) {
            // 忽略JSON解析错误
          }
        }
        
        // 尝试找到其他可能包含文档内容的JSON数据
        if (!jsonData) {
          const otherJsonMatches = scriptContent.match(/({"data":{[\s\S]*?}})/);
          if (otherJsonMatches) {
            try {
              jsonData = JSON.parse(otherJsonMatches[1]);
            } catch (error) {
              // 忽略JSON解析错误
            }
          }
        }
      }
    });
    
    // 如果找到JSON数据，尝试从中提取内容
    if (jsonData) {
      console.log('找到JSON数据，尝试从中提取内容...');
      // 这里可以根据飞书文档的JSON结构来提取内容
      // 由于不同版本的飞书文档可能有不同的JSON结构，这里只做简单处理
      content = JSON.stringify(jsonData);
    } else {
      // 尝试从不同的选择器中提取内容
      const contentSelectors = [
        '.page-main-item.editor',
        '.doc-content',
        '.editor-content',
        '.page-content',
        '.lark-wiki-page',
        '.wiki-page-content',
        '.content-container',
        '.document-content',
        '.article-content',
        '.main-content',
        '.body-content',
        '.content'
      ];
      
      // 尝试提取内容
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim();
          if (content.length > 0) {
            break;
          }
        }
      }
      
      // 如果没有找到内容，尝试提取整个body的内容
      if (!content) {
        content = $('body').text().trim();
      }
    }
    
    // 提取图片
    $('img').each((index, img) => {
      const src = $(img).attr('src');
      const alt = $(img).attr('alt') || '';
      if (src) {
        images.push({ src, alt });
      }
    });
    
    return {
      title,
      content,
      images
    };
  }
}
