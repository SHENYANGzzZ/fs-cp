/**
 * 内容提取模块
 * 负责从页面中提取飞书文档的内容
 */

import { crawlConfig, fileConfig } from '../config/index.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { SimpleFetcher } from './simple-fetcher.js';

/**
 * 内容提取类
 */
export class ContentExtractor {
  constructor() {
    this.extractedContent = '';
    this.extractedHeadings = new Set();
  }

  /**
   * 重置提取状态
   */
  reset() {
    this.extractedContent = '';
    this.extractedHeadings.clear();
  }

  /**
   * 从API响应中提取内容
   * @param {Array} apiResponses API响应数组
   * @returns {Promise<Object>} 提取的页面信息
   */
  async extractFromApiResponses(apiResponses) {
    console.log('从API响应中提取内容...');

    let title = '未知标题';
    let textContent = '';
    let paragraphs = [];
    let headings = [];
    let images = [];

    // 遍历所有API响应
    for (const response of apiResponses) {
      try {
        const data = response.data;

        // 提取标题
        if (data.data && data.data.title) {
          title = data.data.title;
        } else if (data.title) {
          title = data.title;
        }

        // 提取文档内容
        if (data.data && data.data.document) {
          const doc = data.data.document;

          // 提取blocks（飞书文档的内容块）
          if (doc.blocks) {
            textContent += this.extractBlocksContent(doc.blocks);
          }

          // 提取body（另一种可能的结构）
          if (doc.body && doc.body.blocks) {
            textContent += this.extractBlocksContent(doc.body.blocks);
          }
        }

        // 提取blocks（直接在data中）
        if (data.blocks) {
          textContent += this.extractBlocksContent(data.blocks);
        }

        // 提取content（另一种可能的结构）
        if (data.content) {
          if (typeof data.content === 'string') {
            textContent += data.content + '\n\n';
          } else if (Array.isArray(data.content)) {
            textContent += this.extractBlocksContent(data.content);
          }
        }

      } catch (error) {
        console.error('解析API响应失败:', error);
      }
    }

    // 如果没有提取到内容，返回null
    if (!textContent || textContent.length < 100) {
      console.log('API响应中未找到足够的内容');
      return null;
    }

    console.log(`从API提取的内容长度: ${textContent.length}`);

    return {
      title,
      textContent,
      paragraphs,
      headings,
      images,
      contentLength: textContent.length,
      elementCount: 0
    };
  }

  /**
   * 从blocks中提取内容
   * @param {Array|Object} blocks 内容块
   * @returns {string} 提取的文本
   */
  extractBlocksContent(blocks) {
    let content = '';

    // 如果blocks是对象，转换为数组
    if (typeof blocks === 'object' && !Array.isArray(blocks)) {
      blocks = Object.values(blocks);
    }

    if (!Array.isArray(blocks)) {
      return content;
    }

    for (const block of blocks) {
      try {
        // 提取文本内容
        if (block.text) {
          if (typeof block.text === 'string') {
            content += block.text + '\n\n';
          } else if (block.text.content) {
            content += block.text.content + '\n\n';
          }
        }

        // 提取段落内容
        if (block.paragraph && block.paragraph.elements) {
          for (const element of block.paragraph.elements) {
            if (element.text_run && element.text_run.content) {
              content += element.text_run.content;
            }
          }
          content += '\n\n';
        }

        // 提取标题
        if (block.heading && block.heading.elements) {
          const level = block.heading.level || 1;
          const prefix = '#'.repeat(level);
          for (const element of block.heading.elements) {
            if (element.text_run && element.text_run.content) {
              content += prefix + ' ' + element.text_run.content;
            }
          }
          content += '\n\n';
        }

        // 提取代码块
        if (block.code && block.code.elements) {
          content += '```\n';
          for (const element of block.code.elements) {
            if (element.text_run && element.text_run.content) {
              content += element.text_run.content;
            }
          }
          content += '\n```\n\n';
        }

        // 提取列表
        if (block.bullet && block.bullet.elements) {
          content += '• ';
          for (const element of block.bullet.elements) {
            if (element.text_run && element.text_run.content) {
              content += element.text_run.content;
            }
          }
          content += '\n';
        }

        // 递归处理子块
        if (block.children) {
          content += this.extractBlocksContent(block.children);
        }

      } catch (error) {
        console.error('提取block内容失败:', error);
      }
    }

    return content;
  }

  /**
   * 下载图片
   * @param {string} imageUrl 图片URL
   * @param {string} localPath 本地保存路径
   * @returns {Promise<boolean>} 是否下载成功
   */
  async downloadImage(imageUrl, localPath) {
    return new Promise((resolve) => {
      try {
        // 确保目录存在
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // 下载图片，添加常见的请求头
        const options = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://jcny2we8lxya.feishu.cn/wiki/Wb99wXcBYiVMyzkg9WrcftSlntd'
          }
        };

        const file = fs.createWriteStream(localPath);
        https
          .get(imageUrl, options, (response) => {
            if (response.statusCode === 200) {
              response.pipe(file);
              file.on('finish', () => {
                file.close();
                resolve(true);
              });
            } else {
              console.error(`下载图片失败，状态码: ${response.statusCode}`);
              file.close();
              resolve(false);
            }
          })
          .on('error', (error) => {
            console.error(`下载图片失败: ${error.message}`);
            file.close();
            resolve(false);
          });
      } catch (error) {
        console.error(`下载图片时发生错误: ${error.message}`);
        resolve(false);
      }
    });
  }

  /**
   * 处理图片
   * @param {Array} images 图片信息数组
   * @returns {Promise<Array>} 处理后的图片信息数组
   */
  async processImages(images) {
    const processedImages = [];
    const imagesDir = path.join(fileConfig.imagesDir);

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      // 生成安全的图片文件名，避免URL中的路径分隔符
      const safeImageName = `image_${Date.now()}_${i}.jpg`;
      const localPath = path.join(imagesDir, safeImageName);
      const relativePath = `images/${safeImageName}`;

      console.log(`下载图片: ${img.src}`);
      const success = await this.downloadImage(img.src, localPath);

      if (success) {
        processedImages.push({
          src: img.src,
          alt: img.alt,
          localPath: relativePath,
        });
        console.log(`图片下载成功: ${relativePath}`);
      } else {
        console.log(`图片下载失败: ${img.src}`);
      }
    }

    return processedImages;
  }

  /**
   * 从页面中提取内容
   * @param {Object} page 页面对象
   * @returns {Promise<Object>} 页面信息
   */
  async extract(page) {
    console.log('提取页面内容...');

    // 等待页面完全加载
    await page.waitForFunction(() => document.readyState === 'complete', {
      timeout: 60000,
    });

    // 等待网络请求完成
    await page.waitForNetworkIdle({ timeout: 60000 });

    // 再等待一段时间，确保所有动态内容都已加载
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // 尝试强制加载所有隐藏内容
    console.log('尝试强制显示所有隐藏内容...');
    await page.evaluate(() => {
      // 移除所有display:none和visibility:hidden
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        if (el.style) {
          const computedStyle = window.getComputedStyle(el);
          if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
            el.style.display = 'block';
            el.style.visibility = 'visible';
            el.style.opacity = '1';
          }
        }
      });

      // 触发所有懒加载
      const lazyElements = document.querySelectorAll('[data-lazy], [loading="lazy"]');
      lazyElements.forEach(el => {
        if (el.dataset.src) {
          el.src = el.dataset.src;
        }
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 尝试直接从页面中提取完整内容，不依赖滚动
    console.log('尝试直接提取完整内容...');

    // 首先尝试从提取的文本中获取内容
    let pageInfo = await page.evaluate(() => {
      const title = document.title || '未知标题';

      // 检查是否有直接提取的文本
      if (window.__extractedText && window.__extractedText.length > 1000) {
        console.log(`使用直接提取的文本，长度: ${window.__extractedText.length}`);

        // 简单解析文本，提取标题和段落
        const lines = window.__extractedText.split('\n');
        const headings = [];
        const paragraphs = [];

        lines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.length > 0) {
            // 简单的标题识别：短行（<50字符）且不包含标点符号
            if (trimmed.length < 50 && !/[。，！？；：]/.test(trimmed)) {
              headings.push({
                level: 2,
                text: trimmed
              });
            } else if (trimmed.length > 10) {
              paragraphs.push(trimmed);
            }
          }
        });

        return {
          title,
          content: window.__extractedText,
          headings,
          paragraphs,
          images: [],
          contentLength: window.__extractedText.length
        };
      }

      // 检查是否有截图数据
      if (window.__screenshots && window.__screenshots.length > 0) {
        console.log(`有 ${window.__screenshots.length} 张截图可用于OCR`);
        // 这里可以后续添加OCR处理
      }

      return null;
    });

    // 如果直接提取成功，返回结果
    if (pageInfo && pageInfo.contentLength > 1000) {
      console.log(`直接提取成功，内容长度: ${pageInfo.contentLength}`);
      console.log(`最终提取的内容长度: ${pageInfo.contentLength}`);
      console.log(`最终提取的标题数量: ${pageInfo.headings.length}`);
      console.log(`最终提取内容长度: ${pageInfo.contentLength}`);
      return pageInfo;
    }

    // 如果直接提取失败，使用原来的方法
    console.log('直接提取内容不足，使用传统DOM提取方法...');
    pageInfo = await page.evaluate((config) => {
      const title = document.title || '未知标题';
      let allContent = '';
      let headings = [];
      let images = [];
      let paragraphs = [];

      // 1. 尝试从飞书文档的主要内容容器获取内容
      const contentSelectors = [
        ".page-main-item.editor",
        ".page-main-item.editor .doc-content",
        ".doc-content",
        ".editor-content",
        ".page-content",
        ".lark-wiki-page",
        ".wiki-page-content",
        ".content-container",
        ".document-content",
        ".article-content",
        ".main-content",
        ".body-content",
        ".markdown-body",
        ".prose",
        ".content",
      ];

      // 尝试所有选择器，选择内容最长的
      let mainContentElement = null;
      for (const selector of contentSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const content = element.innerText || element.textContent || "";
          if (content.length > allContent.length) {
            allContent = content;
            mainContentElement = element;
            console.log(`从 ${selector} 提取到内容，长度: ${content.length}`);
          }
        });
      }

      // 如果没有找到内容，尝试获取整个页面的内容
      if (!allContent || allContent.length < 100) {
        const bodyContent = document.body.innerText || document.body.textContent || "";
        if (bodyContent.length > allContent.length) {
          allContent = bodyContent;
          mainContentElement = document.body;
          console.log(`从 body 提取到内容，长度: ${bodyContent.length}`);
        }
      }

      // 2. 专门处理飞书文档的内容提取
      try {
        // 尝试直接从飞书文档的编辑器容器提取内容
        const editorContainer = document.querySelector(".page-main-item.editor") || 
                               document.querySelector(".doc-content") || 
                               document.querySelector(".editor-content") ||
                               document.querySelector(".page-content") ||
                               document.querySelector(".lark-wiki-page") ||
                               document.querySelector(".wiki-page-content") ||
                               document.querySelector(".content-container") ||
                               document.querySelector(".document-content") ||
                               document.querySelector(".article-content") ||
                               document.querySelector(".main-content") ||
                               document.querySelector(".body-content");
        if (editorContainer) {
          // 递归遍历所有子元素，确保提取所有已加载的内容
          function extractContentFromElement(element) {
            let content = "";
            const tagName = element.tagName.toLowerCase();
            
            // 跳过不需要的元素
            const excludeClasses = ['login', 'register', 'auth', 'ud__modal', 'lx-modal', 
                                   'login-modal', 'login-dialog', 'auth-form', 'modal', 'popup'];
            
            // 检查元素是否应该被排除
            let shouldExclude = false;
            for (const cls of excludeClasses) {
              if (element.classList.contains(cls)) {
                shouldExclude = true;
                break;
              }
            }
            
            // 检查元素是否包含登录/注册相关文本
            const text = element.innerText || element.textContent || "";
            if (text.includes("登录") || text.includes("注册") ||
                text.includes("Login") || text.includes("Register")) {
              shouldExclude = true;
            }
            
            if (shouldExclude) {
              return "";
            }
            
            // 跳过特定的元素类型
            const excludeTags = ['script', 'style', 'iframe', 'canvas', 'svg'];
            if (excludeTags.includes(tagName)) {
              return "";
            }
            
            // 检查元素是否有有意义的内容
            const hasMeaningfulContent = text.trim().length > 0;
            
            if (hasMeaningfulContent) {
              // 处理代码块
              if (tagName === "pre" || tagName === "code" || 
                  element.classList.contains('code-block') || element.classList.contains('language-') ||
                  element.classList.contains('code') || element.classList.contains('monospace')) {
                content += "```\n" + text.trim() + "\n```\n\n";
              }
              // 处理标题
              else if (tagName.startsWith("h")) {
                const level = parseInt(tagName.substring(1));
                const headingPrefix = "#".repeat(level);
                content += headingPrefix + " " + text.trim() + "\n\n";
              }
              // 处理列表项
              else if (tagName === "li") {
                content += "• " + text.trim() + "\n\n";
              }
              // 处理表格
              else if (tagName === "table" || element.classList.contains('table')) {
                // 改进表格处理，提取表头和数据
                const tableRows = element.querySelectorAll('tr');
                if (tableRows.length > 0) {
                  const tableContent = [];
                  tableRows.forEach(row => {
                    const cells = row.querySelectorAll('th, td');
                    const rowContent = Array.from(cells).map(cell => cell.innerText || cell.textContent || "").join(" | ");
                    tableContent.push("| " + rowContent + " |");
                  });
                  // 添加表头分隔线
                  if (tableRows.length > 1) {
                    const headerCells = tableRows[0].querySelectorAll('th, td');
                    const separator = "| " + Array(headerCells.length).fill("---").join(" | ") + " |";
                    tableContent.splice(1, 0, separator);
                  }
                  content += tableContent.join("\n") + "\n\n";
                }
              }
              // 处理引用
              else if (tagName === "blockquote" || element.classList.contains('quote') || element.classList.contains('blockquote')) {
                content += "> " + text.trim().replace(/\n/g, "\n> ") + "\n\n";
              }
              // 处理链接
              else if (tagName === "a" && element.getAttribute('href')) {
                const href = element.getAttribute('href');
                content += "[" + text.trim() + "]" + "(" + href + ")\n\n";
              }
              // 处理图片
              else if (tagName === "img") {
                const src = element.getAttribute('src') || element.getAttribute('data-src') || "";
                const alt = element.getAttribute('alt') || "";
                if (src) {
                  content += "![" + alt + "]" + "(" + src + ")\n\n";
                }
              }
              // 处理普通段落和其他元素
              else {
                // 尝试提取所有可能的内容元素
                content += text.trim() + "\n\n";
              }
            }
            
            // 递归处理子元素
            for (let i = 0; i < element.children.length; i++) {
              content += extractContentFromElement(element.children[i]);
            }
            
            return content;
          }

          // 从编辑器容器开始提取内容
          const extractedContent = extractContentFromElement(editorContainer);

          if (extractedContent.length > allContent.length) {
            allContent = extractedContent;
            console.log(`从飞书编辑器容器提取到内容，长度: ${extractedContent.length}`);
          }
        }
      } catch (error) {
        console.log("从飞书编辑器容器提取内容失败:", error);
      }

      // 3. 尝试直接获取所有文本内容，包括通过API加载的内容
      try {
        // 尝试获取所有文本节点
        const allTextNodes = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: function(node) {
              // 过滤掉脚本和样式中的文本
              let parent = node.parentElement;
              while (parent) {
                if (parent.tagName.toLowerCase() === 'script' || 
                    parent.tagName.toLowerCase() === 'style') {
                  return NodeFilter.FILTER_SKIP;
                }
                parent = parent.parentElement;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );
        let fullText = "";
        let node;
        while ((node = allTextNodes.nextNode())) {
          if (node.textContent && node.textContent.trim()) {
            // 过滤掉CSS和JavaScript代码
            const text = node.textContent.trim();
            if (!text.includes("{") && !text.includes("}") &&
                !text.includes("function") && !text.includes("var ") &&
                !text.includes("const ") && !text.includes("let ") &&
                !text.includes("window.") && !text.includes("document.") &&
                !text.includes("try {") && !text.includes("catch (") &&
                !text.includes("} catch(e) {}") && !text.includes("catalogue") &&
                !text.includes("SSR") && !text.includes("cookie") &&
                !text.includes("template-branch-list") && !text.includes("__trailers")) {
              fullText += text + "\n";
            }
          }
        }

        if (fullText.length > allContent.length) {
          allContent = fullText;
          console.log(`从所有文本节点提取到内容，长度: ${fullText.length}`);
        }
      } catch (error) {
        console.log("获取所有文本节点失败:", error);
      }

      // 4. 尝试从飞书文档的API响应中提取内容（如果可用）
      try {
        // 检查是否存在飞书文档的API响应数据
        if (window.__API_RESPONSES__) {
          const apiResponses = window.__API_RESPONSES__;
          for (const key in apiResponses) {
            if (apiResponses.hasOwnProperty(key)) {
              const response = apiResponses[key];
              if (response.data && typeof response.data === 'object') {
                // 尝试提取文档内容
                const contentData = response.data.content || 
                                   response.data.document || 
                                   response.data.page;
                if (contentData) {
                  // 简单处理API响应数据
                  const apiContent = JSON.stringify(contentData);
                  if (apiContent.length > allContent.length) {
                    // 这里可以进一步解析API响应数据
                    console.log(`从API响应提取到内容，长度: ${apiContent.length}`);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log("从API响应提取内容失败:", error);
      }

      // 2. 提取段落和样式信息
      if (mainContentElement) {
        const paragraphElements = mainContentElement.querySelectorAll("p, h1, h2, h3, h4, h5, h6, div, span");
        paragraphElements.forEach((element) => {
          const text = element.innerText || element.textContent || "";
          if (text.trim()) {
            const computedStyle = window.getComputedStyle(element);
            const isHeading = /^h[1-6]$/i.test(element.tagName);
            const headingLevel = isHeading ? parseInt(element.tagName.substring(1)) : 0;

            const style = {
              bold: computedStyle.fontWeight === "bold" || parseInt(computedStyle.fontWeight) >= 600,
              italic: computedStyle.fontStyle === "italic",
              underline: computedStyle.textDecoration.includes("underline"),
              fontSize: parseInt(computedStyle.fontSize),
              font: computedStyle.fontFamily,
              color: computedStyle.color,
              alignment: computedStyle.textAlign,
            };

            paragraphs.push({
              text: text.trim(),
              style,
              isHeading,
              headingLevel,
            });
          }
        });
      }

      // 2. 从页面标题中提取主标题
      const mainTitle = title.replace(/ - 飞书云文档$/, "");

      // 3. 提取标题
      const headingElements = document.querySelectorAll(config.headingSelectors);
      headings = Array.from(headingElements)
        .map((h) => h.textContent?.trim())
        .filter(Boolean)
        .filter((heading, index, self) => {
          return heading.length > 2 && self.indexOf(heading) === index;
        });

      // 4. 找到核心内容的开始位置
      let coreContent = allContent;
      const mainTitleIndex = coreContent.indexOf(mainTitle);
      if (mainTitleIndex !== -1) {
        coreContent = coreContent.substring(mainTitleIndex);
      } else if (headings.length > 0) {
        const firstHeading = headings[0];
        const firstHeadingIndex = coreContent.indexOf(firstHeading);
        if (firstHeadingIndex !== -1) {
          coreContent = coreContent.substring(firstHeadingIndex);
        }
      }

      // 5. 过滤无关内容 - 使用更精确的过滤逻辑
      const unwantedTexts = [
        "智泊AI大模型知识库",
        "问问知识库",
        "知识库目录",
        "最新修改时间为",
        "登录/注册",
        "评论（0）",
        "帮助中心",
        "效率指南",
        "2025年5月29日修改",
        "灰码科技",
        "MCP篇-MCP快速入门",
        "面试篇",
        "各大模基础了解",
        "Prompt篇",
        "LangChain从入门到精通",
        "LangGraph从入门到精通",
        "DeepSeek全解，本地部署",
        "大模型微调篇",
        "Coze从入门到精通",
        "Dify从入门到精通",
        "RAG 篇",
      ];

      // 应用过滤 - 只过滤独立的行，避免误删文章内容
      unwantedTexts.forEach((text) => {
        const regex = new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "gm");
        coreContent = coreContent.replace(regex, "");
      });

      // 8. 清理内容
      coreContent = coreContent
        .replace(/\s{3,}/g, "\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/​/g, "")
        .trim();

      // 9. 移除重复的行
      const lines = coreContent.split("\n");
      const seenLines = new Set();
      const filteredLines = lines.filter((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine && !seenLines.has(trimmedLine)) {
          seenLines.add(trimmedLine);
          return true;
        }
        return false;
      });
      coreContent = filteredLines.join("\n");

      // 10. 再次清理空行
      coreContent = coreContent.replace(/\n{3,}/g, "\n\n").trim();

      // 11. 彻底重构内容提取和清理逻辑
      // 1. 首先将内容按行分割
      const allLines = coreContent.split("\n");
      
      // 2. 过滤掉不需要的行
      const cleanedLines = allLines.filter(line => {
        const trimmedLine = line.trim();
        
        // 过滤大纲部分 - 只过滤真正的大纲标题，保留Agent相关内容
        const outlineKeywords = [];
        
        if (outlineKeywords.some(keyword => trimmedLine === keyword)) {
          return false;
        }
        
        // 过滤评论内容
        const commentPatterns = [
          /^\d+$/,              // 单独的数字
          /^评论\(\d+\)$/,        // 评论(1)
          /^跳转至首条评论$/,     // 跳转至首条评论
          /^用户\d+$/,           // 用户123
          /^\d+月\d+日 \d+:\d+$/, // 日期时间
          /^展开$/,              // 展开
          /^用户\d+,用户\d+,$/,    // 用户列表
          /^\+\d+ 人$/,          // +1 人
        ];
        
        if (commentPatterns.some(pattern => pattern.test(trimmedLine))) {
          return false;
        }
        
        // 保留其他内容
        return true;
      });
      
      // 3. 重新组合内容
      coreContent = cleanedLines.join("\n").trim();
      
      // 4. 优化内容格式
      // 处理章节标题，将中文序号格式化为Markdown标题
      coreContent = coreContent.replace(/^([一二三四五六七八九十]+)\、(.*)$/gm, (match, number, title) => {
        return `# ${number}、${title.trim()}`;
      });
      
      // 5. 处理列表项，确保每个列表项都以 • 开头
      coreContent = coreContent.replace(/^\s*•\s*/gm, "• ");
      
      // 6. 处理加粗文本，确保格式正确
      coreContent = coreContent.replace(/\*\*(.*?)\*\*/g, "**$1**");
      
      // 7. 清理多余的空行和空格
      coreContent = coreContent
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\s{3,}/g, " ")
        .trim();
      
      // 8. 移除重复的章节标题
      const contentLines = coreContent.split("\n");
      const seenHeadings = new Set();
      const uniqueLines = contentLines.filter(line => {
        const trimmedLine = line.trim();
        // 检查是否是章节标题
        if (trimmedLine.match(/^#[一二三四五六七八九十]+\、/)) {
          if (!seenHeadings.has(trimmedLine)) {
            seenHeadings.add(trimmedLine);
            return true;
          }
          return false;
        }
        return true;
      });
      coreContent = uniqueLines.join("\n").trim();
      
      // 9. 最终清理
      coreContent = coreContent
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // 8. 提取图片信息
      const imgElements = document.querySelectorAll("img");
      images = Array.from(imgElements)
        .map((img) => {
          const src = img.src || img.getAttribute("data-src") || "";
          const alt = img.alt || "";
          return { src, alt };
        })
        .filter(
          (img) =>
            img.src &&
            !img.src.includes("lark-reaction") &&
            !img.src.startsWith("blob:")
        );

      console.log(`提取的内容长度: ${coreContent.length}`);
      console.log(`提取的标题数量: ${headings.length}`);
      console.log(`提取的段落数量: ${paragraphs.length}`);
      console.log(`提取的图片数量: ${images.length}`);

      return {
        title,
        textContent: coreContent,
        paragraphs,
        headings,
        images,
        contentLength: coreContent.length,
        elementCount: document.querySelectorAll("*").length,
      };
    }, crawlConfig);

    // 打印提取的内容长度
    console.log(`最终提取的内容长度: ${pageInfo.contentLength}`);
    console.log(`最终提取的标题数量: ${pageInfo.headings.length}`);

    // 如果内容为空或太短，尝试使用增量提取的内容
    if ((pageInfo.contentLength === 0 || pageInfo.contentLength < 1000) && this.extractedContent) {
      console.log(`使用增量提取的内容，长度: ${this.extractedContent.length}`);
      pageInfo.textContent = this.extractedContent;
      pageInfo.contentLength = this.extractedContent.length;
    }

    // 再次检查内容长度，如果仍然太短，尝试直接获取页面的所有文本内容
    if (pageInfo.contentLength < 1000) {
      console.log("内容长度仍然太短，尝试直接获取页面所有文本内容");
      const fullContent = await page.evaluate((config) => {
        const allContent = document.body.innerText || document.body.textContent || "";
        const title = document.title || "未知标题";
        const mainTitle = title.replace(/ - 飞书云文档$/, "");

        // 找到核心内容的开始位置
        let coreContent = allContent;
        const mainTitleIndex = coreContent.indexOf(mainTitle);
        if (mainTitleIndex !== -1) {
          coreContent = coreContent.substring(mainTitleIndex);
        }

        // 过滤无关内容
        const unwantedTexts = [
          "智泊AI大模型知识库",
          "问问知识库",
          "知识库目录",
          "最新修改时间为",
          "登录/注册",
          "评论（0）",
          "帮助中心",
          "效率指南",
          "2025年5月29日修改",
          "灰码科技",
          "MCP篇-MCP快速入门",
          "面试篇",
          "各大模基础了解",
          "Prompt篇",
          "LangChain从入门到精通",
          "LangGraph从入门到精通",
          "DeepSeek全解，本地部署",
          "大模型微调篇",
          "Coze从入门到精通",
          "Dify从入门到精通",
          "RAG 篇",
        ];

        // 应用过滤，使用更严格的匹配模式 - 只过滤独立的行
        unwantedTexts.forEach((text) => {
          const regex = new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "gm");
          coreContent = coreContent.replace(regex, "");
        });

        // 清理内容
        coreContent = coreContent
          .replace(/\s{3,}/g, "\n\n")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/​/g, "")
          .trim();

        // 再次过滤，确保没有残留的无关内容
        unwantedTexts.forEach((text) => {
          coreContent = coreContent.replace(new RegExp(`.*${text}.*`, "g"), "");
        });

        // 过滤评论相关内容
        const commentPatterns = [
          /^\d+$/,              // 单独的数字
          /^评论\(\d+\)$/,        // 评论(1)
          /^跳转至首条评论$/,     // 跳转至首条评论
          /^用户\d+$/,           // 用户123
          /^\d+月\d+日 \d+:\d+$/, // 日期时间
          /^展开$/,              // 展开
          /^用户\d+,用户\d+,$/,    // 用户列表
          /^\+\d+ 人$/,          // +1 人
        ];

        // 按行过滤评论内容
        const lines = coreContent.split("\n");
        const filteredLines = lines.filter((line) => {
          const trimmedLine = line.trim();
          return !commentPatterns.some(pattern => pattern.test(trimmedLine));
        });
        coreContent = filteredLines.join("\n");

        // 移除重复的标题
        const titlePattern = new RegExp(`^${mainTitle}$`, "gm");
        let seenTitle = false;
        const uniqueLines = coreContent.split("\n").filter((line) => {
          const trimmedLine = line.trim();
          if (trimmedLine === mainTitle) {
            if (!seenTitle) {
              seenTitle = true;
              return true;
            }
            return false;
          }
          return true;
        });
        coreContent = uniqueLines.join("\n");

        // 优化内容格式
        // 处理章节标题，将中文序号格式化为Markdown标题
        coreContent = coreContent.replace(/^([一二三四五六七八九十]+)\、(.*)$/gm, (match, number, title) => {
          return `# ${number}、${title.trim()}`;
        });

        // 处理列表项，确保每个列表项都以 • 开头
        coreContent = coreContent.replace(/^\s*•\s*/gm, "• ");

        // 清理多余的空行和空格
        coreContent = coreContent
          .replace(/\n{3,}/g, "\n\n")
          .replace(/\s{3,}/g, " ")
          .trim();

        // 再次清理
        coreContent = coreContent
          .replace(/\s{3,}/g, "\n\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        return coreContent;
      }, crawlConfig);
      if (fullContent.length > pageInfo.contentLength) {
        pageInfo.textContent = fullContent;
        pageInfo.contentLength = fullContent.length;
        console.log(`使用完整页面内容，长度: ${fullContent.length}`);
      }
    }

    return pageInfo;
  }

  /**
   * 从JSON数据中提取标题
   * @param {Object} catalogRecordInfo 目录记录信息
   * @returns {Array} 标题数组
   */
  extractHeadingsFromJson(catalogRecordInfo) {
    const headings = [];

    if (catalogRecordInfo && catalogRecordInfo.headingRecords) {
      const headingRecords = catalogRecordInfo.headingRecords;

      for (const recordId in headingRecords) {
        const record = headingRecords[recordId];
        if (record.data && record.data.text && record.data.text.initialAttributedTexts) {
          const text = record.data.text.initialAttributedTexts.text[0];
          if (text) {
            headings.push(text);
          }
        }
      }
    }

    return headings;
  }

  /**
   * 使用传统方法提取内容
   * 注意：此方法设计为在page.evaluate内部使用
   * @param {Object} config 爬取配置
   * @returns {string} 提取的内容
   */
  extractContentTraditionally(config) {
    let allContent = "";

    // 尝试获取所有可能的内容容器
    for (const selector of config.contentContainers) {
      const container = document.querySelector(selector);
      if (container) {
        const containerContent = container.innerText || container.textContent || "";
        if (containerContent.length > allContent.length) {
          allContent = containerContent;
        }
      }
    }

    // 尝试直接获取页面所有文本内容
    const bodyContent = document.body.innerText || document.body.textContent || "";
    if (bodyContent.length > allContent.length) {
      allContent = bodyContent;
    }

    return allContent;
  }

  /**
   * 增量提取内容（用于边滚动边解析）
   * @param {Object} page 页面对象
   * @returns {Promise<Object>} 新增内容、新增标题和是否有更多内容
   */
  async extractIncremental(page) {
    console.log("增量提取内容...");

    return await page.evaluate((config, existingContent, existingHeadings) => {
      // 尝试获取内容容器
      let containerContent = "";
      let longestContent = "";

      // 检查元素是否应该被排除
      const shouldExcludeElement = (element) => {
        // 只排除明确的登录/注册相关元素
        const loginClasses = [
          "login",
          "login-modal",
          "login-dialog",
          "ud__modal",
          "lx-modal",
          "login-btn",
          "register-btn",
          "auth-form",
        ];

        // 检查元素本身的类
        for (const cls of loginClasses) {
          if (element.classList.contains(cls)) {
            return true;
          }
        }

        // 检查元素是否包含登录/注册相关文本
        const text = element.textContent || "";
        if (text.includes("登录") || text.includes("注册") ||
            text.includes("Login") || text.includes("Register")) {
          return true;
        }

        return false;
      };

      // 先找到最长的内容容器
      const contentSelectors = [
        // 飞书文档的主要内容容器 - 优先使用
        ".page-main-item.editor",
        ".page-main-item.editor .doc-content",
        ".doc-content",
        ".editor-content",
        ".page-content",
        ".lark-wiki-page",
        ".wiki-page-content",
        ".content-container",
        ".document-content",
        ".article-content",
        ".main-content",
        ".body-content",
        ".markdown-body",
        ".prose",
        ".content",
      ];

      for (const selector of contentSelectors) {
        const containers = document.querySelectorAll(selector);
        containers.forEach((container) => {
          // 检查容器是否应该被排除
          if (!shouldExcludeElement(container)) {
            const content = container.innerText || container.textContent || "";
            if (content.length > longestContent.length) {
              longestContent = content;
            }
          }
        });
      }

      containerContent = longestContent;

      // 如果没有找到合适的容器，尝试直接获取文章内容区域
      if (!containerContent || containerContent.length < 100) {
        // 尝试找到飞书文档的主内容区域
        const mainContent = document.querySelector(".page-main-item.editor .doc-content") ||
                           document.querySelector(".doc-content") ||
                           document.querySelector(".editor-content") ||
                           document.querySelector(".page-content");

        if (mainContent) {
          containerContent = mainContent.innerText || mainContent.textContent || "";
        }
      }

      // 尝试获取.editor容器的所有内容，包括不可见的内容
      const editorContainer = document.querySelector(".page-main-item.editor");
      let editorContent = "";
      if (editorContainer) {
        editorContent = editorContainer.innerText || editorContainer.textContent || "";
      }

      // 选择最长的内容作为最终内容 - 优先使用editor容器
      const finalContent = Math.max(containerContent.length, editorContent.length) === editorContent.length ? editorContent : containerContent;

      console.log(`内容长度比较: containerContent=${containerContent.length}, editorContent=${editorContent.length}, 使用=${finalContent.length}`);

      // 清理内容，保留合理的空白和换行，并移除状态标签
      let allContent = finalContent
        .replace(/\s{3,}/g, "\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/已识别/g, "") // 移除已识别标签
        .replace(/标题/g, "") // 移除标题标签
        .replace(/可展开/g, "") // 移除可展开标签
        .replace(/已识别标题/g, "") // 移除已识别标题标签
        .trim();

      // 过滤重复内容
      const lines = allContent.split("\n");
      const seenLines = new Set();
      const uniqueLines = lines.filter((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine && !seenLines.has(trimmedLine)) {
          seenLines.add(trimmedLine);
          return true;
        }
        return false;
      });
      allContent = uniqueLines.join("\n");

      // 再次清理空行
      allContent = allContent.replace(/\n{3,}/g, "\n\n").trim();

      // 提取标题
      const headingElements = document.querySelectorAll(config.headingSelectors);
      const allHeadings = Array.from(headingElements)
        .map((h) => h.textContent?.trim())
        .filter(Boolean)
        .filter((heading) => heading.length > 2);

      // 清理标题中的标记
      allContent = allContent.replace(/已识别标题/g, "");

      // 找到文档的主标题作为核心内容的开始位置
      let mainTitle = document.title || "未知标题";
      // 尝试从标题中提取核心部分（去除后缀）
      mainTitle = mainTitle.replace(/ - 飞书云文档$/, "");

      // 暂时注释掉核心内容提取逻辑，保留完整内容
      /*
      // 找到核心内容的开始位置
      let mainContentStart = allContent.indexOf(mainTitle);

      // 如果没有找到主标题，尝试使用第一个标题元素
      if (mainContentStart === -1 && allHeadings.length > 0) {
        mainTitle = allHeadings[0];
        mainContentStart = allContent.indexOf(mainTitle);
      }

      // 如果找到了核心内容开始位置，只保留从核心内容开始的部分
      if (mainContentStart !== -1) {
        allContent = allContent.substring(mainContentStart);
      }

      // 过滤掉特定的无关内容，但保留核心文章结构
      const irrelevantPatterns = [
        /^智泊AI大模型知识库\s*$/gm,
        /^问问知识库\s*$/gm,
        /^知识库目录\s*$/gm,
        /^最新修改时间为[0-9月日]+\s*$/gm,
        /^登录[\/\s]*注册\s*$/gm,
        /^评论\(\d+\)\s*$/gm,
        /^用户\d+\s*$/gm,
        /^帮助中心\s*$/gm,
        /^效率指南\s*$/gm,
        /^滚动完成\s*$/gm,
        /^举报\s*$/gm,
        /^[0-9年]+[0-9月]+[0-9日]+修改\s*$/gm,
        /^MCP篇-MCP快速入门\s*$/gm,
        /^面试篇\s*$/gm,
        /^各大模基础了解\s*$/gm,
        /^Prompt篇\s*$/gm,
        /^LangChain从入门到精通\s*$/gm,
        /^LangGraph从入门到精通\s*$/gm,
        /^DeepSeek全解，本地部署\s*$/gm,
        /^大模型微调篇\s*$/gm,
        /^Coze从入门到精通\s*$/gm,
        /^Dify从入门到精通\s*$/gm,
        /^AI Agent篇\s*$/gm,
        /^RAG 篇\s*$/gm,
        /^灰码科技\s*$/gm,
      ];

      // 过滤明显的无关内容
      irrelevantPatterns.forEach((pattern) => {
        allContent = allContent.replace(pattern, "");
      });
      */

      // 清理多余的空行
      allContent = allContent.replace(/\n{3,}/g, "\n\n");

      // 确保内容不为空
      if (!allContent || allContent.trim().length < 50) {
        // 如果内容太少，使用原始内容但过滤掉明显无关的部分
        const originalContent = finalContent
          .replace(/\s{3,}/g, "\n\n")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/已识别标题/g, "")
          .trim();

        // 只过滤掉明显无关的部分
        let filteredContent = originalContent;
        /*
        irrelevantPatterns.forEach((pattern) => {
          filteredContent = filteredContent.replace(pattern, "");
        });
        */
        allContent = filteredContent.trim();
      }

      // 清理标题中的标记
      allContent = allContent.replace(/已识别标题/g, "");

      // 清理多余的空行
      allContent = allContent.replace(/\n{3,}/g, "\n\n");

      // 确保内容不为空
      allContent = allContent.trim();

      // 确保内容以核心标题开始
      if (mainTitle && !allContent.trim().startsWith(mainTitle)) {
        const mainContentStart = allContent.indexOf(mainTitle);
        if (mainContentStart !== -1) {
          allContent = allContent.substring(mainContentStart);
        }
      }

      // 再次清理多余的空行
      allContent = allContent.replace(/\n{3,}/g, "\n\n");

      // 移除可能的特殊字符
      allContent = allContent.replace(/​/g, "");

      // 移除重复的标题
      const titleLines = allContent.split("\n");
      let seenTitle = false;
      const filteredTitleLines = titleLines.filter((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine === mainTitle) {
          if (!seenTitle) {
            seenTitle = true;
            return true;
          }
          return false;
        }
        return true;
      });
      allContent = filteredTitleLines.join("\n");

      // 确保内容不为空
      allContent = allContent.trim();

      // 计算新增内容 - 确保不会丢失内容
      let newContent = allContent;

      // 如果新内容比现有内容短，说明内容被截断了，不更新
      if (existingContent && existingContent.length > allContent.length) {
        console.log(`现有内容(${existingContent.length})比新内容(${allContent.length})长，保持现有内容`);
        newContent = existingContent;
      } else if (existingContent && allContent.length > existingContent.length) {
        console.log(`新内容(${allContent.length})比现有内容(${existingContent.length})长，使用新内容`);
        newContent = allContent;
      }

      // 计算新增标题
      const existingHeadingSet = new Set(existingHeadings);
      const newHeadings = allHeadings.filter((heading) => !existingHeadingSet.has(heading));

      // 检查是否还有更多内容
      const hasMore = window.scrollY < document.body.scrollHeight - window.innerHeight - 100;

      console.log(`增量提取完成，当前内容长度: ${allContent.length}, 使用内容长度: ${newContent.length}, 新增标题数量: ${newHeadings.length}, 是否有更多内容: ${hasMore}`);

      return {
        newContent,
        newHeadings,
        hasMore,
      };
    }, crawlConfig, this.extractedContent, Array.from(this.extractedHeadings));
  }

  /**
   * 更新提取状态
   * @param {string} newContent 新增内容
   * @param {Array} newHeadings 新增标题
   */
  updateExtractedState(newContent, newHeadings) {
    if (newContent) {
      this.extractedContent = newContent;
    }
    newHeadings.forEach((heading) => this.extractedHeadings.add(heading));
  }

  /**
   * 获取当前提取的内容
   * @returns {string} 提取的内容
   */
  getExtractedContent() {
    return this.extractedContent;
  }

  /**
   * 获取当前提取的标题
   * @returns {Array} 提取的标题数组
   */
  getExtractedHeadings() {
    return Array.from(this.extractedHeadings);
  }

  /**
   * 使用简单的HTTP请求提取内容
   * @param {string} url 页面URL
   * @returns {Promise<Object>} 页面信息
   */
  async extractFromUrl(url) {
    console.log('使用简单HTTP请求提取内容...');
    
    try {
      // 获取页面HTML
      const html = await SimpleFetcher.fetch(url);
      console.log('成功获取页面HTML');
      
      // 使用专门的方法提取飞书文档内容
      const extractedContent = SimpleFetcher.extractFeishuContent(html);
      console.log('成功提取飞书文档内容');
      
      return {
        title: extractedContent.title || '未知标题',
        textContent: extractedContent.content,
        paragraphs: [],
        headings: [],
        images: extractedContent.images,
        contentLength: extractedContent.content.length,
        elementCount: 0,
      };
    } catch (error) {
      console.error('使用简单HTTP请求提取内容失败:', error);
      return {
        title: '未知标题',
        textContent: '',
        paragraphs: [],
        headings: [],
        images: [],
        contentLength: 0,
        elementCount: 0,
      };
    }
  }

  /**
   * 从HTML中提取文本内容
   * @param {string} html HTML内容
   * @returns {string} 提取的文本内容
   */
  extractTextFromHtml(html) {
    // 移除HTML标签
    let text = html.replace(/<[^>]*>/g, ' ');
    
    // 清理多余的空白字符
    text = text
      .replace(/\s{3,}/g, '\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    return text;
  }

  /**
   * 从HTML中提取标题
   * @param {string} html HTML内容
   * @returns {string} 提取的标题
   */
  extractTitleFromHtml(html) {
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
    return '';
  }

  /**
   * 从HTML中提取图片
   * @param {string} html HTML内容
   * @returns {Array} 提取的图片信息数组
   */
  extractImagesFromHtml(html) {
    const images = [];
    const imgMatches = html.match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi);
    
    if (imgMatches) {
      imgMatches.forEach((imgTag) => {
        const srcMatch = imgTag.match(/src="([^"]*)"/i);
        const altMatch = imgTag.match(/alt="([^"]*)"/i);
        
        if (srcMatch) {
          images.push({
            src: srcMatch[1],
            alt: altMatch ? altMatch[1] : '',
          });
        }
      });
    }
    
    return images;
  }
}
