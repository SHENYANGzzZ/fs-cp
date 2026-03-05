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
    
    // 重置滚动状态
    this.scrollCount = 0;
    this.isContentComplete = false;
    this.previousScrollHeight = 0;
    this.heightStableCount = 0;
    this.noNewContentCount = 0;
    this.lastContentLength = 0;
    this.backToTopButtonAppeared = false;
    
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
      
      // 初始化回到顶部按钮状态
      console.log('初始化回到顶部按钮状态...');
      const initialBackToTopButton = await this.page.evaluate(() => {
        const backToTopButton = document.querySelector('.back-to-top-btn') || 
                               document.querySelector('.back-to-top') ||
                               document.querySelector('.top-btn');
        return backToTopButton && backToTopButton.offsetParent !== null;
      });
      this.backToTopButtonAppeared = initialBackToTopButton;
      console.log(`回到顶部按钮初始状态: ${initialBackToTopButton}`);
      
      // 初始内容长度
      const initialContent = await this.page.evaluate(() => {
        const editor = document.querySelector('.page-main-item.editor');
        return editor ? editor.innerText.length : document.body.innerText.length;
      });
      this.lastContentLength = initialContent;
      console.log(`当前内容长度: ${initialContent}`);
      
      // 开始滚动循环
      while (this.scrollCount < this.maxScrolls && !this.isContentComplete) {
        // 直接滚动容器
        await this.scrollContainer();
        
        // 使用鼠标滚轮模拟滚动
        await this.simulateMouseWheel();
        
        // 使用键盘向下箭头滚动
        await this.simulateKeyboardScroll();
        
        // 等待内容加载
        await new Promise(resolve => setTimeout(resolve, crawlConfig.scroll.interval));
        
        // 展开可展开元素
        await this.expandElements();
        
        // 检测回到顶部按钮可见性变化
        await this.checkBackToTopButton();
        
        // 检查滚动条状态
        const scrollStatus = await this.checkScrollStatus();
        
        // 检查内容长度变化
        const currentContentLength = await this.page.evaluate(() => {
          const editor = document.querySelector('.page-main-item.editor');
          return editor ? editor.innerText.length : document.body.innerText.length;
        });
        
        // 检查页面高度是否稳定
        if (scrollStatus.height === this.previousScrollHeight) {
          this.heightStableCount++;
          console.log(`页面高度稳定，计数: ${this.heightStableCount}, 连续无变化: ${this.scrollCount}`);
        } else {
          this.heightStableCount = 0;
        }
        
        // 检查内容是否有新变化
        if (currentContentLength === this.lastContentLength) {
          this.noNewContentCount++;
          console.log(`内容长度未变化，计数: ${this.noNewContentCount}, 连续无变化: ${this.noNewContentCount}`);
        } else {
          this.noNewContentCount = 0;
          this.lastContentLength = currentContentLength;
        }
        
        // 更新上一次的滚动高度
        this.previousScrollHeight = scrollStatus.height;
        
        // 检查是否达到停止条件
        if (this.heightStableCount >= crawlConfig.scroll.heightStableThreshold ||
            this.noNewContentCount >= crawlConfig.scroll.contentStableThreshold ||
            scrollStatus.isAtBottom) {
          this.isContentComplete = true;
          console.log('页面高度连续3次稳定，内容已完全加载，停止滚动');
        }
        
        // 滚动到页面底部，确保所有内容都被加载
        await this.scrollToBottom();
        
        // 增加滚动计数
        this.scrollCount++;
        console.log(`滚动次数: ${this.scrollCount}`);
      }
      
      // 滚动完成后，再次滚动到页面底部，确保所有内容都被加载
      console.log('滚动到页面底部...');
      await this.scrollToBottom();
      
      console.log('智能滚动完成，是否出现回到顶部按钮: ' + this.backToTopButtonAppeared);
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
        let lastScrollTop = window.pageYOffset;
        
        // 方法1: 使用window.scrollTo
        window.scrollTo(0, lastScrollTop + 800);
        console.log(`使用window.scrollTo滚动到: ${window.pageYOffset}`);
        
        // 方法2: 直接设置documentElement.scrollTop
        document.documentElement.scrollTop = lastScrollTop + 800;
        console.log(`使用documentElement.scrollTop滚动到: ${document.documentElement.scrollTop}`);
        
        // 方法3: 直接设置body.scrollTop
        document.body.scrollTop = lastScrollTop + 800;
        console.log(`使用body.scrollTop滚动到: ${document.body.scrollTop}`);
        
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
            container.scrollTop = containerScrollTop + 800;
            console.log(`滚动飞书容器 ${selector} 从 ${containerScrollTop} 到 ${container.scrollTop}`);
            success = true;
            break;
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
