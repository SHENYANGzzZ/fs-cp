/**
 * 浏览器管理模块
 * 负责浏览器的启动、配置和操作
 * 使用稳定配置避免崩溃
 */

import puppeteer, { Browser, Page, KnownDevices } from "puppeteer";
import { browserConfig, crawlConfig } from "../config";

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isPdfMode: boolean = false;

  async launch(pdfMode: boolean = false): Promise<void> {
    this.isPdfMode = pdfMode;
    console.log("启动浏览器...");
    
    const possiblePaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/usr/bin/chrome",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser"
    ];
    
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
    ];
    
    const crawlerOnlyArgs = [
      '--disable-accelerated-2d-canvas',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-images',
      '--disable-background-networking',
      '--disable-breakpad',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-translate',
      '--metrics-recording-only',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
    ];
    
    const launchOptions: any = {
      ...browserConfig,
      headless: false,
      defaultViewport: {
        width: 1280,
        height: 800,
        deviceScaleFactor: this.isPdfMode ? 1 : undefined,
      },
      args: this.isPdfMode ? baseArgs : [...baseArgs, ...crawlerOnlyArgs],
      ignoreDefaultArgs: ['--enable-automation'],
      ignoreHTTPSErrors: true,
    };
    
    for (const path of possiblePaths) {
      const fs = require('fs');
      if (fs.existsSync(path)) {
        console.log(`找到Chrome浏览器: ${path}`);
        launchOptions.executablePath = path;
        break;
      }
    }
    
    this.browser = await puppeteer.launch(launchOptions);

    const pages = await this.browser.pages();

    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }

    if (pages.length > 0) {
      this.page = pages[0];
    } else {
      this.page = await this.browser.newPage();
    }

    await this.page.setDefaultNavigationTimeout(60000);
    await this.page.setDefaultTimeout(30000);

    await this.page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await this.page.setJavaScriptEnabled(true);

    if (!this.isPdfMode) {
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
    }
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    console.log(`正在访问页面: ${url}`);
    
    if (this.isPdfMode) {
      await this.page.goto(url, {
        waitUntil: ["load", "domcontentloaded"],
        timeout: 90000,
      });
    } else {
      await this.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    }
  }

  async waitForPageReady(): Promise<void> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    console.log("等待页面加载...");
    
    await this.page.waitForFunction(() => document.readyState === "complete", {
      timeout: 30000,
    });
    
    const waitTime = this.isPdfMode ? 5000 : 2000;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    
    if (this.isPdfMode) {
      console.log("PDF模式: 等待动态内容加载...");
      
      try {
        await this.page.waitForSelector('[class*="wiki"], [class*="doc"], [class*="content"], .doc-content, .wiki-content', {
          timeout: 10000,
        });
        console.log("检测到文档内容容器");
      } catch (e) {
        console.log("未检测到特定内容容器，继续执行");
      }
      
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    
    console.log("页面加载完成");
  }

  async evaluate<T>(
    fn: (arg1: any, ...args: any[]) => T,
    ...args: any[]
  ): Promise<T> {
    if (!this.page) {
      throw new Error("页面未初始化");
    }

    return (await this.page.evaluate(fn, ...args)) as T;
  }

  async close(): Promise<void> {
    if (this.browser) {
      console.log("关闭浏览器...");
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  getPage(): Page | null {
    return this.page;
  }
}
