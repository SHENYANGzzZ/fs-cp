/**
 * 内容提取模块
 * 负责从页面中提取飞书文档的内容和样式
 * 当前版本：只提取可见区域内容，保留原始样式
 */

import { crawlConfig, fileConfig } from "../config";
import fs from "fs";
import path from "path";
import https from "https";
import { PageInfo, ImageInfo, ContentBlock } from "../types";

export class ContentExtractor {
  /**
   * 下载图片
   */
  private async downloadImage(
    imageUrl: string,
    localPath: string,
    retries: number = 2
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const attemptDownload = (attempt: number) => {
        const file = fs.createWriteStream(localPath);
        https
          .get(imageUrl, (response) => {
            if (response.statusCode === 200) {
              response.pipe(file);
              file.on("finish", () => {
                file.close();
                resolve(true);
              });
            } else {
              file.close();
              if (attempt < retries) {
                setTimeout(() => attemptDownload(attempt + 1), 500);
              } else {
                resolve(false);
              }
            }
          })
          .on("error", () => {
            file.close();
            if (attempt < retries) {
              setTimeout(() => attemptDownload(attempt + 1), 500);
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
   */
  async processImages(images: any[]): Promise<ImageInfo[]> {
    const processedImages: ImageInfo[] = [];
    const imagesDir = path.join(__dirname, "../../out/images");

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      let imageUrl = img.src;

      if (imageUrl) {
        if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
          imageUrl = `https://${imageUrl}`;
        }

        if (imageUrl.includes("feishu.cn") || imageUrl.includes("larksuite.com")) {
          let ext = "jpg";
          const urlParts = imageUrl.split("?")[0].split(".");
          if (urlParts.length > 1) {
            ext = urlParts.pop() || "jpg";
            const validExts = ["jpg", "jpeg", "png", "gif", "webp"];
            if (!validExts.includes(ext.toLowerCase())) {
              ext = "jpg";
            }
          }
          const imageName = `image_${Date.now()}_${i}.${ext}`;
          const localPath = path.join(imagesDir, imageName);
          const relativePath = `images/${imageName}`;

          const success = await this.downloadImage(imageUrl, localPath);

          if (success) {
            processedImages.push({
              src: imageUrl,
              alt: img.alt || "",
              localPath: relativePath,
            });
          }
        }
      }
    }

    console.log(`图片处理完成，成功下载 ${processedImages.length} 张图片`);
    return processedImages;
  }

  /**
   * 从可见区域提取内容（不滚动），保留原始样式
   */
  async extract(page: any, outputDir?: string): Promise<PageInfo> {
    console.log("提取可见区域内容（保留样式）...");

    await page.waitForFunction(() => document.readyState === "complete", {
      timeout: 30000,
    });

    await page.waitForNetworkIdle({ timeout: 30000 });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("开始提取DOM内容和样式...");

    const pageInfo = await page.evaluate(() => {
      const title = document.title || "未知标题";

      const contentSelectors = [
        ".wiki-content",
        ".lark-wiki-content",
        ".feishu-wiki-content",
        ".wiki-page-content",
        ".page-main-item.editor",
        ".doc-content",
        ".editor-container",
        ".lark-editor-content",
        "[data-doc-type]",
        ".doc-render",
      ];

      let mainContent: Element | null = null;
      let maxLength = 0;

      for (const selector of contentSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const text = (el as HTMLElement).innerText || "";
          if (text.length > maxLength) {
            maxLength = text.length;
            mainContent = el;
          }
        });
      }

      if (!mainContent) {
        mainContent = document.body;
      }

      console.log(`找到主内容容器，文本长度: ${maxLength}`);

      const blocks: ContentBlock[] = [];

      const shouldSkipElement = (el: Element): boolean => {
        const className = (el.className || "").toLowerCase();
        const id = (el.id || "").toLowerCase();

        const skipClassOrIdPatterns = [
          "nav", "header", "footer", "sidebar", "comment",
          "toolbar", "menubar", "statusbar", "breadcrumb",
          "share", "export", "print", "download",
          "reaction", "emoji", "like", "star",
          "crawler-log", "log-overlay", "log-container",
          "login-btn", "register-btn", "auth-btn",
          "help-center", "efficiency-guide",
        ];

        for (const pattern of skipClassOrIdPatterns) {
          if (className.includes(pattern) || id.includes(pattern)) {
            return true;
          }
        }

        return false;
      };

      const getComputedStyle = (el: Element) => {
        const style = window.getComputedStyle(el);
        return {
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontFamily: style.fontFamily,
          lineHeight: style.lineHeight,
          textAlign: style.textAlign,
          marginTop: style.marginTop,
          marginBottom: style.marginBottom,
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
        };
      };

      const parseFontSize = (fontSize: string): number => {
        const match = fontSize.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 16;
      };

      const parseColor = (color: string): string => {
        if (color.startsWith("rgb")) {
          const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, "0");
            const g = parseInt(match[2]).toString(16).padStart(2, "0");
            const b = parseInt(match[3]).toString(16).padStart(2, "0");
            return `${r}${g}${b}`;
          }
        }
        if (color.startsWith("#")) {
          return color.slice(1);
        }
        return "000000";
      };

      const isLinkContainer = (el: Element): boolean => {
        const links = el.querySelectorAll("a");
        if (links.length >= 3) {
          const linkTexts = Array.from(links).map((l) => l.textContent?.trim() || "");
          const allLinks = linkTexts.every((t) => t.length > 0 && t.length < 100);
          return allLinks;
        }
        return false;
      };

      const walkElements = (parent: Element, depth: number = 0) => {
        if (depth > 10) return;
        
        const children = parent.children;
        for (let i = 0; i < children.length; i++) {
          const el = children[i] as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          const className = el.className || "";
          const text = el.innerText?.trim() || "";

          if (!text || text.length < 1) continue;

          if (shouldSkipElement(el)) {
            continue;
          }

          const style = getComputedStyle(el);
          const fontSize = parseFontSize(style.fontSize);
          const fontWeight = parseInt(style.fontWeight) >= 600;
          const color = parseColor(style.color);

          if (/^h[1-6]$/.test(tagName)) {
            const level = parseInt(tagName.charAt(1));
            blocks.push({
              type: "heading",
              content: text,
              level,
              tagName,
              className,
              style: {
                fontSize: Math.round(fontSize * 2),
                bold: true,
                color,
              },
            });
            continue;
          }

          if (
            tagName === "pre" ||
            tagName === "code" ||
            className.includes("code") ||
            className.includes("highlight") ||
            className.includes("prism")
          ) {
            blocks.push({
              type: "code",
              content: text,
              tagName,
              className,
              style: {
                fontSize: Math.round(fontSize * 2),
                color,
              },
            });
            continue;
          }

          if (tagName === "ul" || tagName === "ol" || className.includes("list")) {
            const listItems = el.querySelectorAll("li");
            if (listItems.length > 0) {
              listItems.forEach((li: any, idx: number) => {
                const liText = li.innerText?.trim() || "";
                if (liText && !shouldSkipElement(li)) {
                  blocks.push({
                    type: "listitem",
                    content: liText,
                    tagName: "li",
                    className: li.className || "",
                    style: {
                      fontSize: Math.round(fontSize * 2),
                      bold: false,
                      color,
                    },
                  });
                }
              });
            } else {
              blocks.push({
                type: "list",
                content: text,
                tagName,
                className,
                style: {
                  fontSize: Math.round(fontSize * 2),
                  bold: fontWeight,
                  color,
                },
              });
            }
            continue;
          }

          if (tagName === "li") {
            blocks.push({
              type: "listitem",
              content: text,
              tagName,
              className,
              style: {
                fontSize: Math.round(fontSize * 2),
                bold: fontWeight,
                color,
              },
            });
            continue;
          }

          if (isLinkContainer(el)) {
            const links = el.querySelectorAll("a");
            links.forEach((link: any) => {
              const href = link.href || "";
              const linkText = link.textContent?.trim() || "";
              if (href && linkText && !href.includes("javascript:") && !shouldSkipElement(link)) {
                blocks.push({
                  type: "link",
                  content: linkText,
                  tagName: "a",
                  className: "",
                  href,
                  style: {
                    fontSize: Math.round(fontSize * 2),
                    color: "0563C1",
                  },
                });
              }
            });
            continue;
          }

          if (tagName === "img") {
            const src = (el as HTMLImageElement).src || el.getAttribute("data-src") || "";
            if (src && !src.includes("lark-reaction") && !src.startsWith("blob:")) {
              blocks.push({
                type: "image",
                content: "",
                tagName,
                className,
                src,
                alt: el.getAttribute("alt") || "",
              });
            }
            continue;
          }

          const imgEl = el.querySelector("img");
          if (imgEl) {
            const src = (imgEl as HTMLImageElement).src || imgEl.getAttribute("data-src") || "";
            if (src && !src.includes("lark-reaction") && !src.startsWith("blob:")) {
              blocks.push({
                type: "image",
                content: "",
                tagName: "img",
                className: "",
                src,
                alt: imgEl.getAttribute("alt") || "",
              });
            }
          }

          if (/^[一二三四五六七八九十]+[，,、]\s*.+/.test(text)) {
            blocks.push({
              type: "heading",
              content: text,
              level: 3,
              tagName: "h3",
              className,
              style: {
                fontSize: 28,
                bold: true,
                color,
              },
            });
            continue;
          }

          if (/^\d+[.、．]\s*.+/.test(text)) {
            blocks.push({
              type: "heading",
              content: text,
              level: 4,
              tagName: "h4",
              className,
              style: {
                fontSize: 26,
                bold: true,
                color,
              },
            });
            continue;
          }

          if (fontSize >= 20 || fontWeight) {
            const detectedLevel = fontSize >= 28 ? 2 : fontSize >= 24 ? 3 : 4;
            blocks.push({
              type: "heading",
              content: text,
              level: detectedLevel,
              tagName,
              className,
              style: {
                fontSize: Math.round(fontSize * 2),
                bold: true,
                color,
              },
            });
            continue;
          }

          if (text.length > 0) {
            blocks.push({
              type: "paragraph",
              content: text,
              tagName,
              className,
              style: {
                fontSize: Math.round(fontSize * 2),
                bold: fontWeight,
                color,
              },
            });
          }
        }
      };

      walkElements(mainContent);

      const images: any[] = [];
      const imgElements = mainContent.querySelectorAll("img");
      imgElements.forEach((img: any) => {
        const src = img.src || img.getAttribute("data-src") || "";
        const alt = img.alt || "";
        if (src && !src.includes("lark-reaction") && !src.startsWith("blob:") && !shouldSkipElement(img)) {
          images.push({ src, alt });
        }
      });

      const links: any[] = [];
      const linkElements = mainContent.querySelectorAll("a");
      linkElements.forEach((link: any) => {
        const href = link.href || "";
        const text = link.textContent?.trim() || "";
        if (href && text && text.length > 0 && !href.includes("javascript:") && !shouldSkipElement(link)) {
          links.push({ href, text });
        }
      });

      let textContent = "";
      blocks.forEach((block) => {
        switch (block.type) {
          case "heading":
            textContent += `\n\n${"#".repeat(block.level || 1)} ${block.content}\n\n`;
            break;
          case "code":
            textContent += `\n\`\`\`\n${block.content}\n\`\`\`\n`;
            break;
          case "list":
          case "listitem":
            textContent += `• ${block.content}\n`;
            break;
          case "link":
            textContent += `${block.content}\n`;
            break;
          default:
            textContent += `${block.content}\n`;
        }
      });

      textContent = textContent.replace(/\n{3,}/g, "\n\n").trim();

      return {
        title,
        textContent,
        blocks,
        images,
        links,
        codeBlocks: blocks.filter((b) => b.type === "code").map((b) => ({
          content: b.content,
          language: "",
        })),
        headings: blocks.filter((b) => b.type === "heading").map((b) => b.content),
        contentLength: textContent.length,
        elementCount: blocks.length,
      };
    });

    console.log(`提取完成: ${pageInfo.blocks?.length || 0} 个内容块`);
    console.log(`文本长度: ${pageInfo.contentLength}`);
    console.log(`图片数量: ${pageInfo.images?.length || 0}`);
    console.log(`链接数量: ${pageInfo.links?.length || 0}`);

    return pageInfo;
  }
}
