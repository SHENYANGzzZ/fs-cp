/**
 * 配置管理模块
 * 集中管理所有配置参数，提高代码可维护性
 */

import path from "path";

/**
 * 浏览器配置
 */
export const browserConfig = {
  // 是否使用无头模式
  headless: false,
  // 浏览器启动参数
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  ],
  // 协议超时时间（毫秒）
  protocolTimeout: 600000,
  // 默认视口大小
  defaultViewport: { width: 1920, height: 1080 },
};

/**
 * 爬取配置
 */
export const crawlConfig = {
  // 页面加载超时时间（毫秒）
  pageLoadTimeout: 120000,
  // 等待元素加载超时时间（毫秒）
  elementWaitTimeout: 120000,
  // 滚动等待时间（毫秒）
  scrollWaitTime: 5000,
  // 展开内容等待时间（毫秒）
  expandWaitTime: 6000,
  // 最终等待时间（毫秒）
  finalWaitTime: 15000,
  // 标题选择器
  headingSelectors:
    "h1, h2, h3, h4, h5, h6, .heading-h1, .heading-h2, .heading-h3, .heading-h4, .heading-h5, .heading-h6, .title, .content-title, .page-block-content, .flash-block-content",
  // 可展开元素选择器
  expandableSelectors:
    ".fold-handler, .fold-show, .expand-icon, .unfold, .icon-expand, .ud__button",
  // 内容容器选择器
  contentContainers: [
    ".page-main-item.editor",
    ".editor-container",
    ".docx-page-block",
    ".page-block",
    ".zone-container",
  ],
  // 滚动配置
  scrollConfig: {
    // 最大滚动次数
    maxScrolls: 100,
    // 连续滚动次数（当高度不再变化时）
    consecutiveScrolls: 5,
    // 初始滚动步长
    initialStep: 0.1,
  },
  // 并行处理配置
  parallelConfig: {
    // 最大并行任务数
    maxParallel: 3,
  },
  // 缓存配置
  cacheConfig: {
    // 缓存目录
    cacheDir: path.join(__dirname, "../../cache"),
    // 缓存过期时间（毫秒）
    cacheExpiry: 24 * 60 * 60 * 1000, // 24小时
  },
};

/**
 * 文件配置
 */
export const fileConfig = {
  // 输出目录
  outputDir: (title: string) => path.join(__dirname, `../../out/${title}`),
  // 安全标题正则
  safeTitleRegex: /[^a-zA-Z0-9一-龥]/g,
  // 安全标题替换字符
  safeTitleReplace: "_",
};

/**
 * 日志配置
 */
export const logConfig = {
  // 是否启用详细日志
  verbose: true,
};
