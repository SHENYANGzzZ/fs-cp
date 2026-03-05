/**
 * 内容提取模块
 * 负责从页面中提取飞书文档的内容
 */
 
import { crawlConfig, fileConfig } from "../config";
import fs from "fs";
import path from "path";
import https from "https";

/**
 * 图片信息接口
 */
export interface ImageInfo {
  src: string;
  alt: string;
  localPath: string;
}

/**
 * 页面信息接口
 */
export interface PageInfo {
  title: string;
  textContent: string;
  headings: string[];
  images: ImageInfo[];
  links: { href: string; text: string }[];
  codeBlocks: { content: string; language: string }[];
  contentLength: number;
  elementCount: number;
}

/**
 * 内容提取类
 */
export class ContentExtractor {
  private extractedContent: string = "";
  private extractedHeadings: Set<string> = new Set();

  /**
   * 重置提取状态
   */
  reset(): void {
    this.extractedContent = "";
    this.extractedHeadings.clear();
  }

  /**
   * 下载图片
   * @param imageUrl 图片URL
   * @param localPath 本地保存路径
   * @param retries 重试次数
   */
  private async downloadImage(imageUrl: string, localPath: string, retries: number = 3): Promise<boolean> {
    return new Promise((resolve) => {
      // 确保目录存在
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const attemptDownload = (attempt: number) => {
        // 下载图片
        const file = fs.createWriteStream(localPath);
        https.get(imageUrl, (response) => {
          if (response.statusCode === 200) {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve(true);
            });
          } else {
            file.close();
            if (attempt < retries) {
              console.log(`下载图片失败，重试 ${attempt + 1}/${retries}: ${imageUrl}`);
              setTimeout(() => attemptDownload(attempt + 1), 1000);
            } else {
              resolve(false);
            }
          }
        }).on('error', () => {
          file.close();
          if (attempt < retries) {
            console.log(`下载图片出错，重试 ${attempt + 1}/${retries}: ${imageUrl}`);
            setTimeout(() => attemptDownload(attempt + 1), 1000);
          } else {
            resolve(false);
          }
        });
      };

      attemptDownload(0);
    });
  }

  /**
   * 处理图片
   * @param images 图片信息数组
   */
  async processImages(images: any[]): Promise<ImageInfo[]> {
    const processedImages: ImageInfo[] = [];
    const imagesDir = path.join(__dirname, '../../out/images');

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      let imageUrl = img.src;
      
      // 处理可能的图片URL格式
      if (imageUrl) {
        // 确保URL是完整的
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          // 尝试添加协议
          imageUrl = `https://${imageUrl}`;
        }
        
        // 处理可能的相对路径
        if (imageUrl.includes('feishu.cn') || imageUrl.includes('larksuite.com')) {
          const imageName = `image_${Date.now()}_${i}.${imageUrl.split('.').pop()?.split('?')[0] || 'jpg'}`;
          const localPath = path.join(imagesDir, imageName);
          const relativePath = `images/${imageName}`;

          console.log(`下载图片: ${imageUrl}`);
          const success = await this.downloadImage(imageUrl, localPath);
          
          if (success) {
            processedImages.push({
              src: imageUrl,
              alt: img.alt || '',
              localPath: relativePath
            });
            console.log(`图片下载成功: ${relativePath}`);
          } else {
            console.log(`图片下载失败: ${imageUrl}`);
          }
        } else {
          console.log(`跳过非飞书域名的图片: ${imageUrl}`);
        }
      }
    }

    console.log(`图片处理完成，成功下载 ${processedImages.length} 张图片`);
    return processedImages;
  }

  /**
   * 从页面中提取内容
   * @param page 页面对象
   */
  async extract(page: any): Promise<PageInfo> {
    console.log("提取页面内容...");

    // 等待页面完全加载
    await page.waitForFunction(() => document.readyState === "complete", {
      timeout: 30000
    });
    
    // 等待网络请求完成
    await page.waitForNetworkIdle({ timeout: 30000 });
    
    // 再等待一段时间，确保所有动态内容都已加载
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 首先尝试获取飞书文档的完整内容
    let pageInfo = await page.evaluate((config: any) => {
      const title = document.title || "未知标题";
      let allContent = "";
      let headings: string[] = [];
      let images: any[] = [];
      let links: any[] = [];
      let codeBlocks: any[] = [];

      // 1. 尝试从飞书文档的主要内容容器获取内容
      const contentSelectors = [
        '.page-main-item.editor',
        '.page-main-item.editor .doc-content',
        '.doc-content',
        '.editor-container',
        '.lark-editor-content',
        '.wiki-content',
        '.wiki-page-content',
        '.lark-wiki-content',
        '.feishu-wiki-content',
        '.docs-doc-content',
        '.docs-editor',
        '.article-content',
        '.content-area',
        '.page-content',
        '.main-content',
        '.document-content',
        '.content-container',
        '.editor-content',
        '.rich-text-editor',
        '.prose-content',
        'main',
        'article',
        'body'
      ];

      // 尝试所有选择器，选择内容最长的
      for (const selector of contentSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          const content = (element as HTMLElement).innerText || (element as HTMLElement).textContent || "";
          if (content.length > allContent.length) {
            allContent = content;
            console.log(`从 ${selector} 提取到内容，长度: ${content.length}`);
          }
        });
      }

      // 2. 尝试从飞书文档的JSON数据中提取内容
      try {
        const scripts = document.querySelectorAll('script');
        scripts.forEach((script) => {
          const content = script.textContent || '';
          if (content.includes('catalogRecordInfo') || content.includes('docInfo') || content.includes('pageBlock') || content.includes('docx') || content.includes('blockType')) {
            console.log('找到飞书文档JSON数据');
            // 尝试提取内容
            try {
              let start = 0;
              let end = 0;
              let braceCount = 0;
              
              for (let i = 0; i < content.length; i++) {
                if (content[i] === '{') {
                  if (braceCount === 0) {
                    start = i;
                  }
                  braceCount++;
                } else if (content[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    end = i + 1;
                    const jsonStr = content.substring(start, end);
                    try {
                      const json = JSON.parse(jsonStr);
                      if (json) {
                        const extractTextFromJson = (obj: any): string => {
                          let text = '';
                          if (typeof obj === 'string') {
                            if (!obj.match(/^[0-9a-zA-Z]{30,}$/)) {
                              text += obj + ' ';
                            }
                          } else if (Array.isArray(obj)) {
                            obj.forEach((item) => {
                              text += extractTextFromJson(item);
                            });
                          } else if (typeof obj === 'object' && obj !== null) {
                            for (const key in obj) {
                              if (key === 'text' || key === 'content' || key === 'title' || key === 'value' || key === 'body') {
                                text += extractTextFromJson(obj[key]);
                              } else if (key === 'data' || key === 'children' || key === 'items') {
                                text += extractTextFromJson(obj[key]);
                              }
                            }
                          }
                          return text;
                        };
                        
                        const jsonContent = extractTextFromJson(json);
                        if (jsonContent.length > allContent.length) {
                          allContent = jsonContent;
                          console.log('从JSON数据提取到内容，长度:', jsonContent.length);
                        }
                      }
                    } catch (e) {
                      // 忽略JSON解析错误
                    }
                  }
                }
              }
            } catch (e) {
              // 忽略错误
            }
          }
        });
      } catch (e) {
        // 忽略错误
      }

      // 3. 从页面标题中提取主标题
      let mainTitle = title;
      mainTitle = mainTitle.replace(/ - 飞书云文档$/, '');
      
      // 4. 提取标题
      const headingElements = document.querySelectorAll(config.headingSelectors);
      headings = Array.from(headingElements)
        .map((h) => h.textContent?.trim())
        .filter(Boolean)
        .filter((heading, index, self) => {
          return heading.length > 2 && self.indexOf(heading) === index;
        });

      // 5. 找到核心内容的开始位置
      const mainTitleIndex = allContent.indexOf(mainTitle);
      if (mainTitleIndex !== -1) {
        allContent = allContent.substring(mainTitleIndex);
      } else if (headings.length > 0) {
        const firstHeading = headings[0];
        const firstHeadingIndex = allContent.indexOf(firstHeading);
        if (firstHeadingIndex !== -1) {
          allContent = allContent.substring(firstHeadingIndex);
        }
      }

      // 6. 只过滤明显无关的内容
      const unwantedPatterns = [
        /评论\(\d+\)[\s\S]*/,
        /帮助中心[\s\S]*/,
        /效率指南[\s\S]*/
      ];

      // 应用过滤
      unwantedPatterns.forEach(pattern => {
        allContent = allContent.replace(pattern, "");
      });

      // 7. 清理内容
      allContent = allContent
        .replace(/\s{3,}/g, "\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // 8. 提取图片信息
      const imgElements = document.querySelectorAll("img");
      images = Array.from(imgElements)
        .map((img: any) => {
          const src = img.src || img.getAttribute('data-src') || '';
          const alt = img.alt || '';
          return { src, alt };
        })
        .filter(img => img.src && !img.src.includes('lark-reaction') && !img.src.startsWith('blob:'));

      // 9. 提取超链接信息
      const linkElements = document.querySelectorAll("a");
      links = Array.from(linkElements)
        .map((link: any) => {
          const href = link.href || '';
          const text = link.textContent?.trim() || '';
          return { href, text };
        })
        .filter(link => link.href && link.text && link.text.length > 0);

      // 10. 提取代码块信息
      const codeElements = document.querySelectorAll("pre code, code");
      codeBlocks = Array.from(codeElements)
        .map((code: any) => {
          const content = code.textContent || '';
          const language = code.className || code.getAttribute('data-language') || '';
          return { content, language };
        })
        .filter(code => code.content && code.content.length > 0);

      console.log(`提取的内容长度: ${allContent.length}`);
      console.log(`提取的标题数量: ${headings.length}`);
      console.log(`提取的图片数量: ${images.length}`);
      console.log(`提取的超链接数量: ${links.length}`);
      console.log(`提取的代码块数量: ${codeBlocks.length}`);

      return {
        title,
        textContent: allContent,
        headings,
        images,
        links,
        codeBlocks,
        contentLength: allContent.length,
        elementCount: document.querySelectorAll("*").length,
      };
    }, crawlConfig);

    // 打印提取的内容长度
    console.log(`最终提取的内容长度: ${pageInfo.contentLength}`);
    console.log(`最终提取的标题数量: ${pageInfo.headings.length}`);

    // 如果内容为空或太短，尝试使用增量提取的内容
    if ((pageInfo.contentLength === 0 || pageInfo.contentLength < 500) && this.extractedContent) {
      console.log(`使用增量提取的内容，长度: ${this.extractedContent.length}`);
      pageInfo.textContent = this.extractedContent;
      pageInfo.contentLength = this.extractedContent.length;
    }

    // 再次检查内容长度，如果仍然太短，尝试直接获取页面的所有文本内容
    if (pageInfo.contentLength < 500) {
      console.log('内容长度仍然太短，尝试直接获取页面所有文本内容');
      const fullContent = await page.evaluate(() => {
        return document.body.innerText || document.body.textContent || "";
      });
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
   * @param catalogRecordInfo 目录记录信息
   */
  private extractHeadingsFromJson(catalogRecordInfo: any): string[] {
    const headings: string[] = [];

    if (catalogRecordInfo && catalogRecordInfo.headingRecords) {
      const headingRecords = catalogRecordInfo.headingRecords;

      for (const recordId in headingRecords) {
        const record = headingRecords[recordId];
        if (
          record.data &&
          record.data.text &&
          record.data.text.initialAttributedTexts
        ) {
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
   * @param config 爬取配置
   */
  private extractContentTraditionally(config: any): string {
    let allContent = "";

    // 尝试获取所有可能的内容容器
    for (const selector of config.contentContainers) {
      const container = document.querySelector(selector);
      if (container) {
        const containerContent =
          (container as HTMLElement).innerText || container.textContent || "";
        if (containerContent.length > allContent.length) {
          allContent = containerContent;
        }
      }
    }

    // 尝试直接获取页面所有文本内容
    const bodyContent =
      document.body.innerText || document.body.textContent || "";
    if (bodyContent.length > allContent.length) {
      allContent = bodyContent;
    }

    return allContent;
  }

  /**
   * 增量提取内容（用于边滚动边解析）
   * @param page 页面对象
   */
  async extractIncremental(
    page: any
  ): Promise<{ newContent: string; newHeadings: string[]; hasMore: boolean }> {
    console.log("增量提取内容...");

    return await page.evaluate(
      (config: any, existingContent: string, existingHeadings: string[]) => {
        // 尝试获取内容容器
        let containerContent = "";
        let longestContent = "";

        // 检查元素是否应该被排除
        const shouldExcludeElement = (element: Element): boolean => {
          // 只排除明确的登录/注册相关元素
          const loginClasses = [
            'login', 'login-modal', 'login-dialog', 'ud__modal', 'lx-modal', 'login-btn', 'register-btn', 'auth-form'
          ];
          
          // 检查元素本身的类
          for (const cls of loginClasses) {
            if (element.classList.contains(cls)) {
              return true;
            }
          }
          
          // 检查元素是否包含登录/注册相关文本
          const text = element.textContent || '';
          if (text.includes('登录') || text.includes('注册') || text.includes('Login') || text.includes('Register')) {
            return true;
          }
          
          return false;
        };

        // 先找到最长的内容容器
        const contentSelectors = [
          // 飞书文档的主要内容容器
          '.page-main-item.editor',
          '.page-main-item.editor .doc-content',
          '.page-main-item.editor .editor-container',
          '.page-main-item.editor .lark-editor-content',
          
          // 飞书Wiki文档的内容容器
          '.wiki-content',
          '.lark-wiki-content',
          '.feishu-wiki-content',
          '.wiki-page-content',
          
          // 通用文档内容容器
          '.doc-content',
          '.editor-container',
          '.lark-editor-content',
          '.docs-doc-content',
          '.docs-editor',
          '.article-content',
          '.content-area',
          
          // 块级内容
          '.docx-page-block',
          '.page-block',
          '.zone-container',
          '.block-content',
          
          // 页面级内容
          '.page-content',
          '.main-content',
          '.document-content',
          '.content-container',
          
          // 编辑器内容
          '.editor-content',
          '.rich-text-editor',
          '.prose-content',
          
          // 标准HTML元素
          'main',
          'article',
          'body'
        ];
        
        for (const selector of contentSelectors) {
          const containers = document.querySelectorAll(selector);
          containers.forEach((container: any) => {
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
          const mainContent =
            document.querySelector(".page-main-item.editor .doc-content") ||
            document.querySelector(".doc-content") ||
            document.querySelector(".editor-content") ||
            document.querySelector(".page-content");

          if (mainContent) {
            containerContent =
              (mainContent as HTMLElement).innerText ||
              mainContent.textContent ||
              "";
          }
        }

        // 如果没有找到内容容器或内容太短，使用整个页面内容
        const bodyContent =
          document.body.innerText || document.body.textContent || "";
        const finalContent =
          containerContent.length > bodyContent.length
            ? containerContent
            : bodyContent;

        // 清理内容，保留合理的空白和换行，并移除状态标签
        let allContent = finalContent
          .replace(/\s{3,}/g, "\n\n")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/已识别/g, "") // 移除已识别标签
          .replace(/标题/g, "") // 移除标题标签
          .replace(/可展开/g, "") // 移除可展开标签
          .replace(/已识别标题/g, "") // 移除已识别标题标签
          .trim();

        // 提取标题
        const headingElements = document.querySelectorAll(
          config.headingSelectors
        );
        const allHeadings = Array.from(headingElements)
          .map((h) => h.textContent?.trim())
          .filter(Boolean)
          .filter((heading) => heading.length > 2);

        // 清理标题中的标记
        allContent = allContent.replace(/已识别标题/g, "");

        // 找到文档的主标题作为核心内容的开始位置
        let mainTitle = document.title || "未知标题";
        // 尝试从标题中提取核心部分（去除后缀）
        mainTitle = mainTitle.replace(/ - 飞书云文档$/, '');
        
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
          /智泊AI大模型知识库[\s\S]*?(?=\S{10,})/,
          /问问知识库[\s\S]*?(?=\S{10,})/,
          /知识库目录[\s\S]*?(?=\S{10,})/,
          /最新修改时间为[0-9月日]+[\s\S]*?(?=\S{10,})/,
          /登录[\/\s]*注册[\s\S]*?(?=\S{10,})/,
          /评论\(\d+\)[\s\S]*/,
          /用户\d+[\s\S]*/,
          /帮助中心[\s\S]*/,
          /效率指南[\s\S]*/,
          /滚动完成[\s\S]*/,
          /举报[\s\S]*/,
          /[0-9年]+[0-9月]+[0-9日]+修改[\s\S]*/
        ];
        
        // 只过滤明显的无关内容，避免过滤掉实际文章内容
        irrelevantPatterns.forEach(pattern => {
          // 只在内容长度足够时进行过滤，避免误删
          if (allContent.length > 1000) {
            allContent = allContent.replace(pattern, '');
          }
        });

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
          irrelevantPatterns.forEach(pattern => {
            filteredContent = filteredContent.replace(pattern, '');
          });
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

        // 确保内容不为空
        allContent = allContent.trim();

        // 计算新增内容
        const newContent =
          allContent.length > existingContent.length ? allContent : "";

        // 计算新增标题
        const existingHeadingSet = new Set(existingHeadings);
        const newHeadings = allHeadings.filter(
          (heading) => !existingHeadingSet.has(heading)
        );

        // 检查是否还有更多内容
        const hasMore =
          window.scrollY <
          document.body.scrollHeight - window.innerHeight - 100;

        console.log(
          `增量提取完成，新增内容长度: ${newContent.length}, 新增标题数量: ${newHeadings.length}, 是否有更多内容: ${hasMore}`
        );

        return {
          newContent,
          newHeadings,
          hasMore,
        };
      },
      crawlConfig,
      this.extractedContent,
      Array.from(this.extractedHeadings)
    );
  }

  /**
   * 更新提取状态
   * @param newContent 新增内容
   * @param newHeadings 新增标题
   */
  updateExtractedState(newContent: string, newHeadings: string[]): void {
    if (newContent) {
      this.extractedContent = newContent;
    }
    newHeadings.forEach((heading) => this.extractedHeadings.add(heading));
  }

  /**
   * 获取当前提取的内容
   */
  getExtractedContent(): string {
    return this.extractedContent;
  }

  /**
   * 获取当前提取的标题
   */
  getExtractedHeadings(): string[] {
    return Array.from(this.extractedHeadings);
  }
}
