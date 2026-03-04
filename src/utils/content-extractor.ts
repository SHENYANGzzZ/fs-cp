/**
 * 内容提取模块
 * 负责从页面中提取飞书文档的内容
 */

import { crawlConfig } from "../config";

/**
 * 页面信息接口
 */
export interface PageInfo {
  title: string;
  textContent: string;
  headings: string[];
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
   * 从页面中提取内容
   * @param page 页面对象
   */
  async extract(page: any): Promise<PageInfo> {
    console.log("提取页面内容...");

    return await page.evaluate((config: any) => {
      const title = document.title || "未知标题";
      let allContent = "";
      let headings: string[] = [];

      // 尝试获取飞书文档的内容
      console.log("开始提取飞书文档内容...");

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
      for (const selector of config.contentContainers) {
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
      allContent = finalContent
        .replace(/\s{3,}/g, "\n\n") // 多个空格替换为换行
        .replace(/\n{3,}/g, "\n\n") // 多个换行替换为两个换行
        .replace(/已识别/g, "") // 移除已识别标签
        .replace(/标题/g, "") // 移除标题标签
        .replace(/可展开/g, "") // 移除可展开标签
        .trim(); // 去除首尾空白

      // 进一步清理标题中的标记
      allContent = allContent.replace(/已识别标题/g, "");

      // 清理标题中的标记
      allContent = allContent.replace(/已识别标题/g, "");

      // 找到核心内容的开始位置
      const mainContentStart = allContent.indexOf("MCP篇-MCP快速入门");
      if (mainContentStart !== -1) {
        // 只保留从核心内容开始的部分
        allContent = allContent.substring(mainContentStart);
      }

      // 过滤掉特定的无关内容，但保留核心文章结构
      allContent = allContent.replace(
        /智泊AI大模型知识库[\s\S]*?MCP篇-MCP快速入门/,
        "MCP篇-MCP快速入门"
      );
      allContent = allContent.replace(
        /问问知识库[\s\S]*?MCP篇-MCP快速入门/,
        "MCP篇-MCP快速入门"
      );
      allContent = allContent.replace(
        /知识库目录[\s\S]*?MCP篇-MCP快速入门/,
        "MCP篇-MCP快速入门"
      );
      allContent = allContent.replace(
        /最新修改时间为05月29日[\s\S]*?MCP篇-MCP快速入门/,
        "MCP篇-MCP快速入门"
      );
      allContent = allContent.replace(
        /登录[\/\s]*注册[\s\S]*?MCP篇-MCP快速入门/,
        "MCP篇-MCP快速入门"
      );

      // 过滤掉页脚内容
      allContent = allContent.replace(/评论\(1\)[\s\S]*/, "");
      allContent = allContent.replace(/用户2883[\s\S]*/, "");
      allContent = allContent.replace(/大模型里面的mcp[\s\S]*/, "");
      allContent = allContent.replace(/帮助中心[\s\S]*/, "");
      allContent = allContent.replace(/效率指南[\s\S]*/, "");
      allContent = allContent.replace(/滚动完成[\s\S]*/, "");
      allContent = allContent.replace(/举报[\s\S]*/, "");
      allContent = allContent.replace(/2025年5月29日修改[\s\S]*/, "");

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
        allContent = originalContent
          .replace(
            /智泊AI大模型知识库[\s\S]*?MCP篇-MCP快速入门/,
            "MCP篇-MCP快速入门"
          )
          .replace(/评论\(1\)[\s\S]*/, "")
          .replace(/用户2883[\s\S]*/, "")
          .replace(/帮助中心[\s\S]*/, "")
          .replace(/效率指南[\s\S]*/, "")
          .trim();
      }

      // 清理标题中的标记
      allContent = allContent.replace(/已识别标题/g, "");

      // 过滤掉重复的标题部分
      allContent = allContent.replace(
        /MCP篇-MCP快速入门[\s\S]*?MCP篇-MCP快速入门/,
        "MCP篇-MCP快速入门"
      );

      // 清理多余的空行
      allContent = allContent.replace(/\n{3,}/g, "\n\n");

      // 移除中间的重复标题
      allContent = allContent.replace(
        /MCP篇-MCP快速入门\s*\n\s*MCP篇-MCP快速入门/,
        "MCP篇-MCP快速入门"
      );

      // 移除末尾的重复标题和空行
      const lines = allContent.split('\n');
      const cleanedLines = [];
      let foundMainContent = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === "MCP篇-MCP快速入门") {
          foundMainContent = true;
        }
        if (foundMainContent) {
          cleanedLines.push(lines[i]);
        }
      }
      
      allContent = cleanedLines.join('\n');
      
      // 移除末尾的重复标题
      const contentLines = allContent.split('\n');
      if (contentLines.length > 0) {
        // 从后往前检查，找到第一个非空行
        let lastNonEmptyLineIndex = contentLines.length - 1;
        while (lastNonEmptyLineIndex >= 0 && contentLines[lastNonEmptyLineIndex].trim() === '') {
          lastNonEmptyLineIndex--;
        }
        
        // 检查最后一个非空行是否是重复的标题
        if (lastNonEmptyLineIndex >= 0 && contentLines[lastNonEmptyLineIndex].trim() === "MCP篇-MCP快速入门") {
          // 移除最后一个非空行及其后的空行
          contentLines.splice(lastNonEmptyLineIndex);
          allContent = contentLines.join('\n').trim();
        }
      }
      
      // 再次清理多余的空行
      allContent = allContent.replace(/\n{3,}/g, "\n\n");
      
      // 确保内容不为空
      allContent = allContent.trim();
      
      // 最终清理：移除末尾的重复标题（如果存在）
      const finalLines = allContent.split('\n');
      if (finalLines.length > 1) {
        const lastLine = finalLines[finalLines.length - 1].trim();
        if (lastLine === "MCP篇-MCP快速入门") {
          finalLines.pop();
          allContent = finalLines.join('\n').trim();
        }
      }
      
      // 确保内容不为空
      if (!allContent || allContent.trim().length < 100) {
        // 如果内容太少，使用原始内容
        allContent = finalContent
          .replace(/\s{3,}/g, "\n\n")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/已识别标题/g, "")
          .trim();
      }

      // 确保内容以核心标题开始
      if (!allContent.trim().startsWith("MCP篇-MCP快速入门")) {
        const mainContentStart = allContent.indexOf("MCP篇-MCP快速入门");
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

      // 提取标题
      const headingElements = document.querySelectorAll(
        config.headingSelectors
      );
      headings = Array.from(headingElements)
        .map((h) => h.textContent?.trim())
        .filter(Boolean)
        .filter((heading, index, self) => {
          // 过滤掉太短的标题和重复的标题
          return heading.length > 2 && self.indexOf(heading) === index;
        });

      // 检查是否有更多内容需要加载
      const contentLength = allContent.length;
      const elementCount = document.querySelectorAll("*").length;

      console.log(
        `提取完成，内容长度: ${contentLength}, 标题数量: ${headings.length}`
      );

      return {
        title,
        textContent: allContent,
        headings,
        contentLength,
        elementCount,
      };
    }, crawlConfig);
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
        for (const selector of config.contentContainers) {
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

        // 清理标题中的标记
        allContent = allContent.replace(/已识别标题/g, "");

        // 找到核心内容的开始位置
        const mainContentStart = allContent.indexOf("MCP篇-MCP快速入门");
        if (mainContentStart !== -1) {
          // 只保留从核心内容开始的部分
          allContent = allContent.substring(mainContentStart);
        }

        // 过滤掉特定的无关内容，但保留核心文章结构
        allContent = allContent.replace(
          /智泊AI大模型知识库[\s\S]*?MCP篇-MCP快速入门/,
          "MCP篇-MCP快速入门"
        );
        allContent = allContent.replace(
          /问问知识库[\s\S]*?MCP篇-MCP快速入门/,
          "MCP篇-MCP快速入门"
        );
        allContent = allContent.replace(
          /知识库目录[\s\S]*?MCP篇-MCP快速入门/,
          "MCP篇-MCP快速入门"
        );
        allContent = allContent.replace(
          /最新修改时间为05月29日[\s\S]*?MCP篇-MCP快速入门/,
          "MCP篇-MCP快速入门"
        );
        allContent = allContent.replace(
          /登录[\/\s]*注册[\s\S]*?MCP篇-MCP快速入门/,
          "MCP篇-MCP快速入门"
        );

        // 过滤掉页脚内容
        allContent = allContent.replace(/评论\(1\)[\s\S]*/, "");
        allContent = allContent.replace(/用户2883[\s\S]*/, "");
        allContent = allContent.replace(/大模型里面的mcp[\s\S]*/, "");
        allContent = allContent.replace(/帮助中心[\s\S]*/, "");
        allContent = allContent.replace(/效率指南[\s\S]*/, "");
        allContent = allContent.replace(/滚动完成[\s\S]*/, "");
        allContent = allContent.replace(/举报[\s\S]*/, "");
        allContent = allContent.replace(/2025年5月29日修改[\s\S]*/, "");

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
          allContent = originalContent
            .replace(
              /智泊AI大模型知识库[\s\S]*?MCP篇-MCP快速入门/,
              "MCP篇-MCP快速入门"
            )
            .replace(/评论\(1\)[\s\S]*/, "")
            .replace(/用户2883[\s\S]*/, "")
            .replace(/帮助中心[\s\S]*/, "")
            .replace(/效率指南[\s\S]*/, "")
            .trim();
        }

        // 清理标题中的标记
        allContent = allContent.replace(/已识别标题/g, "");

        // 过滤掉重复的标题部分
        allContent = allContent.replace(
          /MCP篇-MCP快速入门[\s\S]*?MCP篇-MCP快速入门/,
          "MCP篇-MCP快速入门"
        );

        // 清理多余的空行
        allContent = allContent.replace(/\n{3,}/g, "\n\n");

        // 移除中间的重复标题
        allContent = allContent.replace(
          /MCP篇-MCP快速入门\s*\n\s*MCP篇-MCP快速入门/,
          "MCP篇-MCP快速入门"
        );

        // 移除末尾的重复标题和空行
        const lines = allContent.split('\n');
        const cleanedLines = [];
        let foundMainContent = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line === "MCP篇-MCP快速入门") {
            foundMainContent = true;
          }
          if (foundMainContent) {
            cleanedLines.push(lines[i]);
          }
        }
        
        allContent = cleanedLines.join('\n');
        
        // 移除末尾的重复标题
        const contentLines = allContent.split('\n');
        if (contentLines.length > 0) {
          // 从后往前检查，找到第一个非空行
          let lastNonEmptyLineIndex = contentLines.length - 1;
          while (lastNonEmptyLineIndex >= 0 && contentLines[lastNonEmptyLineIndex].trim() === '') {
            lastNonEmptyLineIndex--;
          }
          
          // 检查最后一个非空行是否是重复的标题
          if (lastNonEmptyLineIndex >= 0 && contentLines[lastNonEmptyLineIndex].trim() === "MCP篇-MCP快速入门") {
            // 移除最后一个非空行及其后的空行
            contentLines.splice(lastNonEmptyLineIndex);
            allContent = contentLines.join('\n').trim();
          }
        }
        
        // 再次清理多余的空行
        allContent = allContent.replace(/\n{3,}/g, "\n\n");
        
        // 确保内容不为空
        allContent = allContent.trim();

        // 确保内容以核心标题开始
        if (!allContent.trim().startsWith("MCP篇-MCP快速入门")) {
          const mainContentStart = allContent.indexOf("MCP篇-MCP快速入门");
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

        // 提取标题
        const headingElements = document.querySelectorAll(
          config.headingSelectors
        );
        const allHeadings = Array.from(headingElements)
          .map((h) => h.textContent?.trim())
          .filter(Boolean)
          .filter((heading) => heading.length > 2);

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
