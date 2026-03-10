# CLAUDE.md

本文档为 Claude Code (claude.ai/code) 在本项目中工作时提供指导。

## 语言偏好

**请使用中文与我对话。** 请使用中文进行所有响应、解释和讨论。

## 项目概述

Feishu Shadow（飞书影子）是一个基于 TypeScript 的网页爬虫，用于从飞书文档中提取内容并转换为 Word（.docx）格式。它使用 Puppeteer 进行浏览器自动化，以处理动态内容加载和 API 拦截。

## 构建和运行命令

```bash
# 安装依赖
npm install

# 运行爬虫（使用 src/index.ts 中硬编码的测试 URL）
npm start
```

注意：URL 目前硬编码在 `src/index.ts` 中。修改 `url` 变量可以爬取不同的文档。

## 架构

代码库采用模块化、类式的架构，并使用集中配置：

**入口点 (`src/index.ts`)**：硬编码测试 URL 并调用主爬虫函数。

**核心爬虫 (`src/crawler/index.ts`)**：协调爬虫工作流程：
1. 验证 URL
2. 检查缓存中之前爬取的内容
3. 启动 Puppeteer 浏览器
4. 拦截网络请求以捕获飞书 API 响应
5. 导航到文档并触发内容加载（滚动、展开）
6. 使用 ContentExtractor 提取内容
7. 使用 WordProcessor 生成 Word 文档
8. 保存缓存以供将来使用

**配置 (`src/config/index.ts`)**：集中配置以下内容：
- 浏览器设置（无头模式、视口、用户代理）
- 爬取参数（超时、选择器、滚动配置）
- 并行处理限制
- 缓存设置（目录、过期时间）
- 文件输出路径

**工具模块 (`src/utils/`)**：专用模块：
- `browser-manager.ts`：Puppeteer 浏览器生命周期管理
- `content-extractor.ts`：从飞书页面提取结构化内容
- `word-processor.ts`：生成 Word 文档
- `cache-manager.ts`：处理内容缓存以避免重复爬取
- `parallel-processor.ts`：管理并行任务执行
- `error-handler.ts`：集中式错误处理
- `markdown-processor.ts`：Markdown 生成工具
- `http.ts`：URL 验证

**类型定义 (`src/types/index.ts`)**：CrawlerConfig 的 TypeScript 接口。

## 关键实现细节

- 使用非无头模式（`headless: false`）运行 Puppeteer 以便调试
- 拦截飞书 API 响应以直接从网络流量中提取文档数据
- 实现智能滚动以触发懒加载内容
- 使用配置的选择器自动展开可折叠部分
- 缓存提取的内容 24 小时以避免重复爬取
- 将 Word 文档输出到 `out/{document-title}/` 目录
- 支持可配置并发限制的并行处理

## 输出

生成的文件保存在 `out/{document-title}/`：
- `{document-title}.docx` - 包含提取内容的 Word 文档
- 缓存文件存储在 `cache/` 目录中
