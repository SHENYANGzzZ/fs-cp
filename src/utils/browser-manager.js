/**
 * 浏览器管理模块
 * 负责浏览器的启动、页面加载和滚动等操作
 */

import puppeteer from 'puppeteer';
import { browserConfig, crawlConfig } from '../config/index.js';
import fs from 'fs';

/**
 * 浏览器管理类
 */
export class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
    this.scrollCount = 0;
    this.maxScrolls = crawlConfig.scroll.maxScrolls;
    this.isContentComplete = false;
    this.previousScrollHeight = 0;
    this.heightStableCount = 0;
    this.noNewContentCount = 0;
    this.lastContentLength = 0;
    this.backToTopButtonAppeared = false;
    this.apiResponses = []; // 存储拦截到的API响应
  }

  /**
   * 初始化浏览器
   * @returns {Promise<void>}
   */
  async init() {
    console.log('启动浏览器...');
    
    try {
      // 尝试使用系统中已有的Chrome浏览器
      const executablePath = this.findChromeExecutable();
      
      this.browser = await puppeteer.launch({
        ...browserConfig,
        executablePath: executablePath,
      });
      this.page = await this.browser.newPage();
      
      // 设置页面视口
      await this.page.setViewport(browserConfig.defaultViewport);

      // 设置API拦截
      await this.setupApiInterception();

      console.log('浏览器启动成功');
    } catch (error) {
      console.error('启动浏览器失败:', error);
      throw error;
    }
  }

  /**
   * 查找系统中已有的Chrome浏览器
   * @returns {string|null} Chrome浏览器的可执行文件路径
   */
  findChromeExecutable() {
    const paths = [
      // Mac
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      // Linux
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      // Windows
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe'
    ];
    
    for (const path of paths) {
      if (fs.existsSync(path)) {
        console.log(`找到Chrome浏览器: ${path}`);
        return path;
      }
    }
    
    console.log('未找到Chrome浏览器');
    return null;
  }

  /**
   * 设置API拦截
   * @returns {Promise<void>}
   */
  async setupApiInterception() {
    console.log('设置API拦截...');

    // 启用CDP的Network域
    const client = await this.page.target().createCDPSession();
    await client.send('Network.enable');

    // 监听所有网络响应
    client.on('Network.responseReceived', async (params) => {
      try {
        const url = params.response.url;

        // 只处理飞书相关的请求
        if (!url.includes('feishu.cn')) {
          return;
        }

        // 获取响应体
        const responseBody = await client.send('Network.getResponseBody', {
          requestId: params.requestId
        }).catch(() => null);

        if (responseBody && responseBody.body) {
          try {
            // 尝试解析JSON
            const data = JSON.parse(responseBody.body);

            // 存储API响应
            this.apiResponses.push({
              url: url,
              status: params.response.status,
              data: data,
              timestamp: Date.now()
            });

            // 保存到文件
            const fs = await import('fs');
            const path = await import('path');
            const debugDir = 'debug-api-responses';
            if (!fs.existsSync(debugDir)) {
              fs.mkdirSync(debugDir, { recursive: true });
            }

            const urlParts = url.split('/');
            const apiName = urlParts[urlParts.length - 1].split('?')[0] || 'unknown';
            const filename = `cdp_api_${this.apiResponses.length}_${apiName}.json`;

            fs.writeFileSync(
              path.join(debugDir, filename),
              JSON.stringify({ url, data }, null, 2)
            );

            console.log(`[CDP] 拦截到API响应 [${this.apiResponses.length}]: ${url.substring(0, 80)}...`);
          } catch (e) {
            // 不是JSON，忽略
          }
        }
      } catch (error) {
        // 忽略错误
      }
    });

    console.log('API拦截设置完成（使用CDP）');
  }

  /**
   * 获取拦截到的API响应
   * @returns {Array} API响应数组
   */
  getApiResponses() {
    return this.apiResponses;
  }

  /**
   * 导航到指定URL
   * @param {string} url 要导航的URL
   * @returns {Promise<void>}
   */
  async navigate(url) {
    console.log(`导航到: ${url}`);
    try {
      await this.page.goto(url, {
        waitUntil: 'domcontentloaded', // 只等待DOM内容加载完成，不等待网络请求完成
        timeout: 120000, // 增加导航超时时间到120秒
      });
      console.log('页面加载完成');
    } catch (error) {
      console.error('导航失败:', error);
      throw error;
    }
  }

  /**
   * 智能滚动加载内容
   * @returns {Promise<boolean>} 是否成功加载所有内容
   */
  async smartScroll() {
    console.log('开始智能滚动加载内容...');

    try {
      // 等待页面完全加载
      console.log('等待页面完全加载...');
      await this.page.waitForFunction(() => document.readyState === 'complete', {
        timeout: 30000,
      });
      console.log('文档状态已变为complete');

      // 等待网络请求完成
      await this.page.waitForNetworkIdle({ timeout: 30000 });
      console.log('网络请求已完成');

      console.log('页面已完全加载');

      // 方案1: 尝试找到文档编辑器的根元素
      console.log('分析页面DOM结构...');
      const domInfo = await this.page.evaluate(() => {
        const info = {
          editorElements: [],
          contentElements: [],
          allTextLength: 0
        };

        // 查找所有可能的编辑器容器
        const selectors = [
          '.editor-content',
          '.doc-content',
          '.page-main-item.editor',
          '[data-zone-id]',
          '[data-block-id]',
          '.render-unit-wrapper',
          '.suite-editor-container',
          '.lark-editor-container'
        ];

        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            info.editorElements.push({
              selector,
              count: elements.length,
              firstElementText: elements[0].innerText.substring(0, 200)
            });
          }
        });

        // 获取所有文本内容
        const bodyText = document.body.innerText;
        info.allTextLength = bodyText.length;

        return info;
      });

      console.log('DOM结构分析结果:');
      console.log(JSON.stringify(domInfo, null, 2));

      // 方案2: 使用截图OCR方案
      console.log('\n准备使用截图方案提取内容...');

      // 获取页面总高度
      const dimensions = await this.page.evaluate(() => {
        return {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight
        };
      });

      console.log(`页面尺寸: 宽度=${dimensions.width}, 高度=${dimensions.height}, 视口高度=${dimensions.viewportHeight}`);

      // 分段截图并提取内容
      const screenshots = [];
      const scrollStep = Math.floor(dimensions.viewportHeight * 0.8); // 每次滚动80%视口高度，保证有重叠
      let currentScroll = 0;
      let screenshotCount = 0;

      console.log('开始分段截图...');

      while (currentScroll < dimensions.height && screenshotCount < 50) {
        // 滚动到指定位置
        await this.page.evaluate((scroll) => {
          window.scrollTo(0, scroll);
        }, currentScroll);

        // 等待渲染
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 截图
        const screenshot = await this.page.screenshot({
          encoding: 'base64',
          fullPage: false
        });

        screenshots.push({
          position: currentScroll,
          data: screenshot
        });

        screenshotCount++;
        currentScroll += scrollStep;

        if (screenshotCount % 5 === 0) {
          console.log(`已截图 ${screenshotCount} 张，当前位置: ${currentScroll}/${dimensions.height}`);
        }
      }

      console.log(`截图完成，共 ${screenshots.length} 张`);

      // 将截图数据保存到页面上下文中
      await this.page.evaluate((data) => {
        window.__screenshots = data;
      }, screenshots);

      // 方案3: 直接提取所有可见文本
      console.log('\n尝试直接提取所有文本内容...');
      const allText = await this.page.evaluate(() => {
        // 尝试多种方式提取文本
        const methods = [];

        // 方法1: 从编辑器容器提取
        const editor = document.querySelector('.page-main-item.editor') ||
                      document.querySelector('.doc-content') ||
                      document.querySelector('.editor-content');
        if (editor) {
          methods.push({
            method: 'editor',
            text: editor.innerText,
            length: editor.innerText.length
          });
        }

        // 方法2: 从所有data-block-id元素提取
        const blocks = document.querySelectorAll('[data-block-id]');
        if (blocks.length > 0) {
          let blockText = '';
          blocks.forEach(block => {
            blockText += block.innerText + '\n\n';
          });
          methods.push({
            method: 'data-block-id',
            text: blockText,
            length: blockText.length
          });
        }

        // 方法3: 从body提取
        methods.push({
          method: 'body',
          text: document.body.innerText,
          length: document.body.innerText.length
        });

        return methods;
      });

      console.log('文本提取结果:');
      allText.forEach(method => {
        console.log(`  ${method.method}: ${method.length} 字符`);
      });

      // 选择最长的文本
      const bestMethod = allText.reduce((prev, current) =>
        (current.length > prev.length) ? current : prev
      );

      console.log(`选择最佳方法: ${bestMethod.method} (${bestMethod.length} 字符)`);

      // 保存提取的文本
      await this.page.evaluate((text) => {
        window.__extractedText = text;
      }, bestMethod.text);

      return true;
    } catch (error) {
      console.error('智能滚动失败:', error);
      return false;
    }
  }

  /**
   * 滚动容器
   * @returns {Promise<void>}
   */
  async scrollContainer() {
    try {
      const scrollResult = await this.page.evaluate(() => {
        // 尝试多种滚动方法
        let success = false;
        
        // 方法1: 使用window.scrollTo滚动到页面底部
        window.scrollTo(0, document.body.scrollHeight);
        console.log(`使用window.scrollTo滚动到页面底部: ${window.pageYOffset}`);
        
        // 方法2: 直接设置documentElement.scrollTop到页面底部
        document.documentElement.scrollTop = document.documentElement.scrollHeight;
        console.log(`使用documentElement.scrollTop滚动到页面底部: ${document.documentElement.scrollTop}`);
        
        // 方法3: 直接设置body.scrollTop到页面底部
        document.body.scrollTop = document.body.scrollHeight;
        console.log(`使用body.scrollTop滚动到页面底部: ${document.body.scrollTop}`);
        
        // 尝试滚动飞书文档的特定容器
        const feishuContainers = [
          '.page-main-item.editor',
          '.doc-content',
          '.editor-content',
          '.page-content'
        ];
        
        for (const selector of feishuContainers) {
          const container = document.querySelector(selector);
          if (container) {
            const containerScrollTop = container.scrollTop;
            container.scrollTop = container.scrollHeight;
            console.log(`滚动飞书容器 ${selector} 从 ${containerScrollTop} 到 ${container.scrollTop}`);
            success = true;
          }
        }
        
        return { 
          success, 
          lastScrollTop: window.pageYOffset,
          documentElementScrollTop: document.documentElement.scrollTop,
          bodyScrollTop: document.body.scrollTop
        };
      });
      
      console.log(`直接滚动容器: ${scrollResult.success}, 窗口滚动位置: ${scrollResult.lastScrollTop}, documentElement滚动位置: ${scrollResult.documentElementScrollTop}, body滚动位置: ${scrollResult.bodyScrollTop}`);
    } catch (error) {
      console.error('滚动容器失败:', error);
    }
  }

  /**
   * 模拟鼠标滚轮滚动
   * @returns {Promise<void>}
   */
  async simulateMouseWheel() {
    try {
      // 计算视口中心位置
      const viewport = browserConfig.defaultViewport;
      const centerX = viewport.width / 2;
      const centerY = viewport.height / 2;
      
      // 模拟鼠标移动到视口中心
      await this.page.mouse.move(centerX, centerY);
      
      // 模拟鼠标滚轮向下滚动
      await this.page.mouse.wheel({ deltaY: 100 });
      console.log('使用鼠标滚轮模拟滚动');
    } catch (error) {
      console.error('模拟鼠标滚轮失败:', error);
    }
  }

  /**
   * 模拟键盘向下箭头滚动
   * @returns {Promise<void>}
   */
  async simulateKeyboardScroll() {
    try {
      // 模拟按下向下箭头键
      await this.page.keyboard.press('ArrowDown');
      console.log('使用键盘向下箭头滚动');
    } catch (error) {
      console.error('模拟键盘滚动失败:', error);
    }
  }

  /**
   * 展开可展开元素
   * @returns {Promise<number>} 展开的元素数量
   */
  async expandElements() {
    try {
      const expandedCount = await this.page.evaluate(() => {
        let count = 0;
        
        // 查找并点击展开按钮
        const expandButtons = document.querySelectorAll(
          '.expand-btn, .collapse-btn, .toggle-btn, [data-action="expand"], [aria-expanded="false"]'
        );
        
        expandButtons.forEach((button) => {
          try {
            // 检查按钮是否可见
            if (button.offsetParent !== null) {
              button.click();
              count++;
            }
          } catch (error) {
            // 忽略点击失败的情况
          }
        });
        
        return count;
      });
      
      console.log(`展开了 ${expandedCount} 个元素`);
      return expandedCount;
    } catch (error) {
      console.error('展开元素失败:', error);
      return 0;
    }
  }

  /**
   * 检查回到顶部按钮可见性
   * @returns {Promise<void>}
   */
  async checkBackToTopButton() {
    try {
      const isVisible = await this.page.evaluate(() => {
        const backToTopButton = document.querySelector('.back-to-top-btn') || 
                               document.querySelector('.back-to-top') ||
                               document.querySelector('.top-btn');
        return backToTopButton && backToTopButton.offsetParent !== null;
      });
      
      if (isVisible && !this.backToTopButtonAppeared) {
        this.backToTopButtonAppeared = true;
        console.log('回到顶部按钮从隐藏变为显示，继续滚动以确保内容完全加载');
      }
    } catch (error) {
      console.error('检查回到顶部按钮失败:', error);
    }
  }

  /**
   * 检查滚动条状态
   * @returns {Promise<Object>} 滚动条状态
   */
  async checkScrollStatus() {
    try {
      return await this.page.evaluate(() => {
        const container = document.querySelector('.page-main-item.editor') || 
                          document.querySelector('.doc-content') ||
                          document.body;
        
        if (!container) {
          return {
            height: 0,
            scrollTop: 0,
            viewportHeight: window.innerHeight,
            isAtBottom: true,
            hasScrollbar: false
          };
        }
        
        const height = container.scrollHeight || container.offsetHeight;
        const scrollTop = container.scrollTop || window.pageYOffset;
        const viewportHeight = window.innerHeight;
        const isAtBottom = scrollTop >= height - viewportHeight - 100;
        const hasScrollbar = height > viewportHeight;
        
        console.log(`滚动条状态: 高度=${height}, 滚动位置=${scrollTop}, 视口高度=${viewportHeight}, 已到底部=${isAtBottom}, 有滚动条=${hasScrollbar}`);
        
        return {
          height,
          scrollTop,
          viewportHeight,
          isAtBottom,
          hasScrollbar
        };
      });
    } catch (error) {
      console.error('检查滚动条状态失败:', error);
      return {
        height: 0,
        scrollTop: 0,
        viewportHeight: 0,
        isAtBottom: true,
        hasScrollbar: false
      };
    }
  }

  /**
   * 滚动到页面底部
   * @returns {Promise<void>}
   */
  async scrollToBottom() {
    try {
      const bottomStatus = await this.page.evaluate(() => {
        const container = document.querySelector('.page-main-item.editor') || 
                          document.querySelector('.doc-content') ||
                          document.body;
        
        if (container) {
          container.scrollTop = container.scrollHeight;
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
        
        // 再次检查滚动条状态
        const height = container.scrollHeight || container.offsetHeight;
        const scrollTop = container.scrollTop || window.pageYOffset;
        const viewportHeight = window.innerHeight;
        const isAtBottom = scrollTop >= height - viewportHeight - 100;
        
        return {
          height,
          scrollTop,
          viewportHeight,
          isAtBottom,
          hasScrollbar: height > viewportHeight
        };
      });
      
      console.log(`底部滚动条状态: 高度=${bottomStatus.height}, 滚动位置=${bottomStatus.scrollTop}, 视口高度=${bottomStatus.viewportHeight}, 已到底部=${bottomStatus.isAtBottom}, 有滚动条=${bottomStatus.hasScrollbar}`);
    } catch (error) {
      console.error('滚动到页面底部失败:', error);
    }
  }

  /**
   * 关闭浏览器
   * @returns {Promise<void>}
   */
  async close() {
    if (this.browser) {
      console.log('关闭浏览器...');
      await this.browser.close();
      console.log('浏览器已关闭');
    }
  }

  /**
   * 获取页面对象
   * @returns {Object} 页面对象
   */
  getPage() {
    return this.page;
  }

  /**
   * 获取浏览器对象
   * @returns {Object} 浏览器对象
   */
  getBrowser() {
    return this.browser;
  }
}
