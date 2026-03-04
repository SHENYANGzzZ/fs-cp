# 飞书文档爬虫程序设计文档

## 1. 项目概述

本项目是一个飞书文档爬虫工具，用于从飞书文档URL中提取完整的文章内容，并将其转换为Markdown格式。该工具使用Puppeteer模拟浏览器行为，能够处理动态加载的内容和折叠的部分，确保获取完整的文档内容。

### 1.1 功能目标
- 从飞书文档URL获取完整的文章内容
- 支持处理动态加载的内容
- 支持展开折叠的内容
- 将内容转换为Markdown格式
- 保存为本地文件并直接打印内容

### 1.2 技术栈
- TypeScript：提供类型安全和更好的开发体验
- Puppeteer：模拟浏览器行为，处理动态内容
- Node.js：运行环境

## 2. 架构设计

### 2.1 系统架构
```
┌─────────────────┐
│ 命令行入口      │
└────────┬────────┘
         │
┌────────▼────────┐
│ 爬虫核心模块    │
└────────┬────────┘
         │
┌────────┴─────────────┬────────┐
│ 浏览器管理           │ 缓存管理 │
└────────┬─────────────┴────────┘
         │
┌────────▼────────┐
│ 内容提取         │
└────────┬────────┘
         │
┌────────▼────────┐
│ Markdown处理    │
└────────┬────────┘
         │
┌────────▼────────┐
│ 并行处理         │
└────────┬────────┘
         │
┌────────▼────────┐
│ 配置管理         │
└─────────────────┘
```

### 2.2 模块划分

| 模块 | 职责 | 文件位置 |
|------|------|----------|
| 入口模块 | 处理命令行参数，启动爬虫 | src/index.ts |
| 爬虫核心 | 实现爬虫逻辑，控制浏览器 | src/crawler/index.ts |
| 类型定义 | 定义TypeScript类型 | src/types/index.ts |
| 配置管理 | 集中管理所有配置参数 | src/config/index.ts |
| 浏览器管理 | 负责浏览器的启动、配置和操作 | src/utils/browser-manager.ts |
| 缓存管理 | 实现缓存机制，避免重复爬取 | src/utils/cache-manager.ts |
| 内容提取 | 从页面中提取内容 | src/utils/content-extractor.ts |
| 错误处理 | 提供统一的错误处理机制 | src/utils/error-handler.ts |
| HTTP工具 | 提供HTTP相关工具函数 | src/utils/http.ts |
| Markdown处理 | 将内容转换为Markdown格式 | src/utils/markdown-processor.ts |
| 并行处理 | 支持并行爬取多个文档 | src/utils/parallel-processor.ts |

## 3. 核心功能实现

### 3.1 浏览器模拟

使用Puppeteer创建无头浏览器实例，模拟真实用户浏览行为：

- 配置浏览器参数，包括禁用沙箱、设置用户代理等
- 访问目标URL，等待页面加载完成
- 处理网络请求和JavaScript执行

### 3.2 内容加载与展开

为确保获取完整内容，实现了以下机制：

- 自动滚动：模拟用户滚动行为，触发动态内容加载
- 折叠内容展开：识别并点击折叠的内容区域，确保所有内容可见
- 多次尝试：设置最大滚动次数，确保内容完全加载

### 3.3 内容提取

从页面中提取关键信息：

- 标题：从`document.title`获取
- 正文内容：从`.page-main-item.editor`元素获取
- 标题层级：提取所有标题元素，用于结构分析

### 3.4 格式转换

将提取的内容转换为Markdown格式：

- 处理文本格式，转换换行符
- 处理列表标记，转换为Markdown列表格式
- 生成标准Markdown文档结构

### 3.5 输出处理

- 保存为本地Markdown文件
- 直接在控制台打印内容，方便实时查看

## 4. 代码结构

```
feishu-shadow/
├── src/
│   ├── config/
│   │   └── index.ts       # 配置管理
│   ├── crawler/
│   │   └── index.ts       # 爬虫核心实现
│   ├── types/
│   │   └── index.ts       # 类型定义
│   ├── utils/
│   │   ├── browser-manager.ts    # 浏览器管理
│   │   ├── cache-manager.ts      # 缓存管理
│   │   ├── content-extractor.ts  # 内容提取
│   │   ├── error-handler.ts      # 错误处理
│   │   ├── http.ts               # HTTP工具
│   │   ├── markdown-processor.ts # Markdown处理
│   │   └── parallel-processor.ts # 并行处理
│   └── index.ts           # 入口文件
├── cache/                 # 缓存目录
├── out/                   # 输出目录
├── package.json           # 项目配置
├── package-lock.json      # 依赖锁定
├── tsconfig.json          # TypeScript配置
├── DESIGN.md              # 设计文档
└── test-parallel.ts       # 并行测试
```

## 5. 执行流程

1. **初始化**：解析命令行参数，获取目标URL和缓存选项
2. **验证URL**：检查URL格式是否有效
3. **检查缓存**：检查是否有有效的缓存内容
4. **启动浏览器**：创建Puppeteer浏览器实例，关闭多余标签页
5. **访问页面**：导航到目标URL，等待页面加载
6. **等待页面完全加载**：使用`document.readyState`检查页面加载状态
7. **自适应滚动**：根据内容加载情况动态调整滚动行为
8. **展开折叠内容**：识别并点击折叠的内容区域
9. **提取内容**：从页面中提取标题、正文和其他信息
10. **关闭浏览器**：清理浏览器资源
11. **保存缓存**：将提取的内容保存到缓存
12. **转换格式**：将内容转换为Markdown格式
13. **保存输出**：保存为本地文件并打印内容

## 6. 关键技术点

### 6.1 自适应滚动

根据内容加载情况动态调整滚动行为，避免固定滚动次数的局限性：

```typescript
async adaptiveScroll(): Promise<void> {
  // 等待页面完全加载
  await this.waitForPageLoad();
  
  // 滚动到页面顶部
  await this.page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  let previousHeight = 0;
  let consecutiveSameHeight = 0;
  let scrollCount = 0;
  
  // 循环滚动，直到内容不再变化或达到最大滚动次数
  while (scrollCount < maxScrolls) {
    // 获取当前页面高度
    const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
    
    // 检查页面高度是否变化
    if (currentHeight === previousHeight) {
      consecutiveSameHeight++;
      // 如果连续多次高度相同，说明内容已加载完成
      if (consecutiveSameHeight >= maxConsecutiveSameHeight) {
        break;
      }
    } else {
      consecutiveSameHeight = 0;
    }
    
    // 滚动到页面的下一个位置
    const scrollPosition = (currentHeight / 10) * (scrollCount % 10);
    await this.page.evaluate((position) => {
      window.scrollTo({ top: position, behavior: 'smooth' });
    }, scrollPosition);
    
    // 等待内容加载
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 展开折叠内容
    await this.expandContent();
    
    // 更新 previousHeight
    previousHeight = currentHeight;
    scrollCount++;
  }
  
  // 滚动到页面底部，确保所有内容加载
  await this.scrollToBottom();
}
```

### 6.2 缓存机制

实现缓存机制，避免重复爬取相同的文档：

```typescript
async hasValidCache(url: string): Promise<boolean> {
  try {
    const cachePath = path.join(cacheDir, `${hashUrl(url)}.json`);
    if (!fs.existsSync(cachePath)) {
      return false;
    }
    
    const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const now = Date.now();
    return now - cacheData.timestamp < cacheExpiry;
  } catch (error) {
    return false;
  }
}

async setCache(url: string, content: string): Promise<void> {
  try {
    const cachePath = path.join(cacheDir, `${hashUrl(url)}.json`);
    const cacheData = {
      timestamp: Date.now(),
      url,
      content
    };
    fs.writeFileSync(cachePath, JSON.stringify(cacheData));
  } catch (error) {
    console.error('保存缓存失败:', error);
  }
}
```

### 6.3 并行处理

支持并行爬取多个文档，提高爬取效率：

```typescript
async processMultipleUrls(urls: string[]): Promise<void> {
  const maxParallel = parallelConfig.maxParallel;
  const batches = [];
  
  // 将URL分成多个批次
  for (let i = 0; i < urls.length; i += maxParallel) {
    batches.push(urls.slice(i, i + maxParallel));
  }
  
  // 按批次处理
  for (const batch of batches) {
    const promises = batch.map(url => crawlFeishuDoc(url));
    await Promise.all(promises);
  }
}
```

### 6.4 浏览器管理

优化浏览器启动和标签页管理，避免多余的空白标签页：

```typescript
async launch(): Promise<void> {
  // 启动浏览器
  this.browser = await puppeteer.launch({
    ...browserConfig,
    defaultViewport: null,
  });
  
  // 获取浏览器的所有页面
  const pages = await this.browser.pages();
  
  // 关闭所有现有页面，只保留一个
  for (let i = 1; i < pages.length; i++) {
    await pages[i].close();
  }
  
  // 使用第一个页面（如果有的话），否则创建新页面
  if (pages.length > 0) {
    this.page = pages[0];
  } else {
    this.page = await this.browser.newPage();
  }
  
  // 设置浏览器参数
  await this.setupBrowser();
}
```

## 7. 遇到的问题及解决方案

### 7.1 动态内容加载不全
**问题**：飞书文档使用动态加载，初始页面只加载部分内容
**解决方案**：实现自适应滚动机制，根据内容加载情况动态调整滚动行为，当页面高度连续多次不变时停止滚动

### 7.2 折叠内容未展开
**问题**：文档中存在折叠的内容区域，需要手动点击展开
**解决方案**：识别折叠元素并自动点击展开，支持多种折叠元素选择器

### 7.3 内容格式转换
**问题**：提取的纯文本缺少格式信息
**解决方案**：将文本内容转换为Markdown格式，保留基本结构

### 7.4 浏览器兼容性
**问题**：不同环境下的浏览器行为可能不同
**解决方案**：设置统一的浏览器参数和用户代理

### 7.5 浏览器启动时多一个空标签页
**问题**：Puppeteer启动浏览器时默认打开一个空白标签页
**解决方案**：在浏览器启动后关闭所有多余的标签页，只保留一个

### 7.6 重复爬取相同文档
**问题**：每次运行都会重新爬取相同的文档，浪费时间和资源
**解决方案**：实现缓存机制，避免重复爬取相同的文档

### 7.7 爬取速度慢
**问题**：单线程爬取多个文档速度较慢
**解决方案**：实现并行处理，支持同时爬取多个文档

### 7.8 内容提取不完整
**问题**：有时只能提取到文档的部分内容
**解决方案**：尝试多种内容提取策略，包括从特定元素提取、从整个页面提取、从脚本标签中的JSON数据提取

## 8. 未来优化方向

1. **内容结构优化**：进一步优化Markdown转换，保留更多原始格式信息，如表格、代码块等
2. **多媒体处理**：支持提取和保存图片、视频等多媒体内容
3. **错误重试**：增加错误重试机制，提高稳定性
4. **配置化**：增加配置文件，支持更多自定义选项
5. **性能优化**：进一步减少不必要的等待时间，提高爬取速度
6. **UI界面**：添加简单的Web界面，方便用户操作
7. **分布式爬取**：支持分布式爬取，提高大规模文档处理能力
8. **智能识别**：智能识别文档结构，提高内容提取的准确性
9. **API集成**：集成飞书开放API，获取更多文档信息
10. **监控系统**：添加监控系统，实时跟踪爬取进度和状态

## 9. 运行说明

### 9.1 安装依赖
```bash
npm install
```

### 9.2 运行命令
```bash
npx ts-node src/index.ts <飞书文档URL> [--no-cache]
```

### 9.3 参数说明
- `<飞书文档URL>`：飞书文档的完整URL
- `--no-cache`：可选参数，不使用缓存，强制重新爬取

### 9.4 示例
```bash
# 使用缓存（默认）
npx ts-node src/index.ts https://jcny2we8lxya.feishu.cn/wiki/QBZ7wUMVwiR0NRkIGGbcTFd9nMg

# 不使用缓存，强制重新爬取
npx ts-node src/index.ts https://jcny2we8lxya.feishu.cn/wiki/QBZ7wUMVwiR0NRkIGGbcTFd9nMg --no-cache
```

## 10. 总结

本项目实现了一个功能完整、性能优化的飞书文档爬虫，能够从飞书文档URL中提取完整的文章内容，并转换为Markdown格式。通过使用Puppeteer模拟浏览器行为，解决了动态内容加载和折叠内容展开的问题，确保获取完整的文档内容。

### 项目特点

1. **自适应滚动**：根据内容加载情况动态调整滚动行为，避免固定滚动次数的局限性
2. **缓存机制**：实现缓存机制，避免重复爬取相同的文档，提高效率
3. **并行处理**：支持并行爬取多个文档，提高爬取速度
4. **浏览器优化**：优化浏览器启动和标签页管理，避免多余的空白标签页
5. **多策略内容提取**：尝试多种内容提取策略，提高内容提取的完整性
6. **模块化设计**：代码结构清晰，模块化设计便于维护和扩展
7. **类型安全**：采用TypeScript开发，提供类型安全和更好的开发体验

### 技术栈

- TypeScript：提供类型安全和更好的开发体验
- Puppeteer：模拟浏览器行为，处理动态内容
- Node.js：运行环境

项目已经实现了设计目标，能够成功从飞书文档中提取完整的内容并转换为Markdown格式。通过持续优化和扩展，可以进一步提高爬取效率和内容提取的准确性。