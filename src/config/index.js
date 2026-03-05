/**
 * 配置文件
 */

// 爬取配置
export const crawlConfig = {
  // 标题选择器
  headingSelectors: 'h1, h2, h3, h4, h5, h6',
  // 内容容器选择器
  contentContainers: [
    '.page-main-item.editor',
    '.page-main-item.editor .doc-content',
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
    '.markdown-body',
    '.prose',
    '.content'
  ],
  // 滚动相关配置
  scroll: {
    interval: 2000, // 滚动间隔
    maxScrolls: 100, // 最大滚动次数
    waitTime: 5000, // 初始等待时间
    minContentLength: 1000, // 最小内容长度
    heightStableThreshold: 3, // 页面高度稳定阈值
    contentStableThreshold: 3 // 内容稳定阈值
  },
  // 通知配置
  notifications: {
    enabled: true, // 是否启用通知
    title: '飞书文档爬虫', // 通知标题
    icon: 'https://www.feishu.cn/favicon.ico' // 通知图标
  }
};

// 文件配置
export const fileConfig = {
  // 输出目录
  outputDir: './out',
  // 图片目录
  imagesDir: './out/images',
  // 文件类型
  fileTypes: {
    markdown: true, // 是否生成Markdown文件
    word: true, // 是否生成Word文件
    text: true // 是否生成纯文本文件
  },
  // 文件名格式
  fileNameFormat: '{title}',
  // 最大文件大小 (MB)
  maxFileSize: 50
};

// 浏览器配置
export const browserConfig = {
  // 浏览器启动参数
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920,1080'
  ],
  // 是否无头模式
  headless: true,
  // 页面加载超时时间 (ms)
  timeout: 60000,
  // 导航超时时间 (ms)
  navigationTimeout: 60000,
  // 默认视口
  defaultViewport: {
    width: 1920,
    height: 1080
  }
};
