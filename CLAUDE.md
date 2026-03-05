# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## 项目概述

这是一个飞书（Lark）文档网络爬虫工具，可以从飞书/飞书维基文档中提取完整内容并转换为 Word 格式。该工具使用 Puppeteer 模拟浏览器行为，处理动态内容加载、可展开部分和自适应滚动。

## 关键命令

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 开发模式运行（直接执行）
npm run dev
# 或
npx ts-node src/index.ts

# 运行特定 URL
npx ts-node src/index.ts <飞书文档URL>

# 不使用缓存运行（强制重新爬取）
npx ts-node src/index.ts <飞书文档URL> --no-cache
```

## 架构

### 核心组件

1. **爬虫模块** (`src/crawler/index.ts`)
   - 协调所有组件的主要控制器
   - 实现网络监控以捕获 API 响应
   - 处理自适应滚动和回到顶部按钮检测
   - 管理从 URL 到 Word 文档的整个工作流程

2. **内容提取器** (`src/utils/content-extractor.ts`)
   - 使用多种策略提取内容：
     - DOM 选择器（尝试 20+ 不同的选择器）
     - 脚本标签中的 JSON 数据
     - 网络监控期间捕获的 API 响应
   - 处理内容清理和过滤
   - 处理图片并下载到本地

3. **浏览器管理器** (`src/utils/browser-manager.ts`)
   - 管理 Puppeteer 浏览器实例
   - 实现优化的滚动策略
   - 检测回到顶部按钮以确定内容加载完成
   - 处理页面导航和元素等待

4. **Word 处理器** (`src/utils/word-processor.ts`)
   - 将提取的内容转换为 Word 格式
   - 保持文本结构和格式
   - 将文档保存到有组织的目录结构中

5. **缓存管理器** (`src/utils/cache-manager.ts`)
   - 实现 24 小时缓存机制
   - 避免重新爬取相同文档
   - 将提取的内容存储为 JSON

### 主要功能

- **自适应滚动**：根据内容加载情况动态调整滚动
- **回到顶部检测**：使用按钮可见性变化来确定内容何时完全加载
- **网络监控**：捕获 API 响应以编程方式提取内容
- **多策略提取**：尝试多种方法确保完整捕获内容
- **并行处理**：支持同时爬取多个文档
- **图片处理**：从文档中下载并本地化图片

## 配置

所有配置都集中在 `src/config/index.ts` 中：
- 浏览器设置（用户代理、视口、超时）
- 爬取参数（超时、选择器、滚动限制）
- 文件路径和缓存设置
- 并行处理限制

## 代码工作指南

### 添加新的内容选择器
在 `ContentExtractor` 类中更新 `contentSelectors` 数组以处理不同的页面结构。

### 修改滚动行为
调整 `BrowserManager.adaptiveScroll()` 中的参数：
- `maxScrolls`：最大滚动尝试次数
- `scrollWaitTime`：每次滚动后的等待时间
- `expandWaitTime`：内容展开的等待时间

### 扩展输出格式
在 `WordProcessor` 中添加新的处理器，或为不同格式（PDF、Markdown 等）创建新的实用工具模块。

### 调试
工具将 API 响应保存到 `api-responses/` 目录，将提取的内容保存到 `out/` 目录。这些可用于调试提取问题。

## 重要实现细节

1. **URL 处理**：当前实现在 `src/index.ts` 中有硬编码的测试 URL。生产使用应替换为动态 URL 处理。

2. **缓存目录**：创建 `cache/` 目录存储提取的内容。

3. **输出结构**：创建有组织的输出，包括：
   - 文档标题作为子目录
   - `extracted_content.txt`：原始提取的文本
   - `images/`：下载的图片
   - `.docx`：生成的 Word 文档

4. **错误处理**：全面的错误处理确保即使在提取失败时也能清理浏览器资源。

## 开发说明

- 项目使用 TypeScript 提供类型安全
- 所有依赖通过 npm 管理
- 构建输出到 `dist/` 目录
- 当前没有测试套件（考虑为未来开发添加）