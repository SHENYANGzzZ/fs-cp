/**
 * 类型定义模块
 * 定义项目中使用的 TypeScript 接口和类型
 */

/**
 * 爬虫配置接口
 */
export interface CrawlerConfig {
  // 浏览器配置
  browser?: {
    headless?: boolean;
    args?: string[];
    protocolTimeout?: number;
    defaultViewport?: {
      width: number;
      height: number;
    };
  };
  
  // 爬取配置
  crawl?: {
    pageLoadTimeout?: number;
    elementWaitTimeout?: number;
    scrollWaitTime?: number;
    expandWaitTime?: number;
    finalWaitTime?: number;
    headingSelectors?: string;
    expandableSelectors?: string;
    contentContainers?: string[];
  };
  
  // 缓存配置
  cache?: {
    cacheDir?: string;
    cacheExpiry?: number;
  };
  
  // 并行处理配置
  parallel?: {
    maxParallel?: number;
  };
  
  // 日志配置
  log?: {
    verbose?: boolean;
  };
}

/**
 * 内容块样式接口
 */
export interface ContentBlockStyle {
  fontSize?: number;
  bold?: boolean;
  color?: string;
  backgroundColor?: string;
}

/**
 * 内容块接口
 */
export interface ContentBlock {
  type: string;
  content: string;
  level?: number;
  tagName?: string;
  className?: string;
  style?: ContentBlockStyle;
  href?: string;
  src?: string;
  alt?: string;
}

/**
 * 页面信息接口
 */
export interface PageInfo {
  title: string;
  textContent: string;
  blocks?: ContentBlock[];
  headings: string[];
  images: ImageInfo[];
  links: {
    href: string;
    text: string;
  }[];
  codeBlocks: {
    content: string;
    language: string;
  }[];
  contentLength: number;
  elementCount: number;
}

/**
 * 图片信息接口
 */
export interface ImageInfo {
  src: string;
  alt: string;
  localPath: string;
}

/**
 * 文档信息接口
 */
export interface DocumentInfo {
  url: string;
  title: string;
  content: string;
  images: ImageInfo[];
  createdTime?: Date;
  updatedTime?: Date;
}

/**
 * 爬虫结果接口
 */
export interface CrawlerResult {
  success: boolean;
  url: string;
  title?: string;
  error?: string;
  outputPath?: string;
}