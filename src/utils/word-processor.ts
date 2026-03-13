/**
 * Word 处理模块
 * 负责将提取的内容生成格式化的 Word 文档
 * 根据原文样式还原文档格式
 */

import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  ImageRun,
  AlignmentType,
  BorderStyle,
  LevelFormat,
  ExternalHyperlink,
  ShadingType,
  WidthType,
} from "docx";
import fs from "fs";
import path from "path";
import { fileConfig } from "../config";
import { PageInfo, ContentBlock } from "../types";

export class WordProcessor {
  private generateSafeFilename(title: string): string {
    return title
      .replace(fileConfig.safeTitleRegex, fileConfig.safeTitleReplace)
      .replace(/_{2,}/g, "_")
      .trim();
  }

  async generateWordDocument(pageInfo: PageInfo, outputDir?: string): Promise<string> {
    console.log("生成Word文档（还原样式）...");

    const safeTitle = this.generateSafeFilename(pageInfo.title);
    const actualOutputDir = outputDir || fileConfig.outputDir(safeTitle);
    
    if (!fs.existsSync(actualOutputDir)) {
      fs.mkdirSync(actualOutputDir, { recursive: true });
    }

    const imageMap = new Map<string, string>();
    if (pageInfo.images) {
      for (const img of pageInfo.images) {
        if (img.localPath) {
          imageMap.set(img.src, img.localPath);
        }
      }
    }

    const children: any[] = [];

    if (pageInfo.blocks && pageInfo.blocks.length > 0) {
      for (const block of pageInfo.blocks) {
        const paragraph = await this.createParagraphFromBlock(block, imageMap);
        if (paragraph) {
          children.push(paragraph);
        }
      }
    } else {
      children.push(new Paragraph({
        spacing: { after: 120, line: 360 },
        children: [new TextRun({ 
          text: pageInfo.textContent,
          size: 24,
          font: "Microsoft YaHei",
        })],
      }));
    }

    console.log("创建文档...");
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: "Microsoft YaHei", size: 24 },
          },
        },
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(actualOutputDir, `${safeTitle}.docx`);
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`Word文档已生成: ${outputPath}`);
    
    const contentPath = path.join(actualOutputDir, `extracted_content.txt`);
    fs.writeFileSync(contentPath, pageInfo.textContent);
    
    console.log(`提取的内容已保存到: ${contentPath}`);
    
    return outputPath;
  }

  private async createParagraphFromBlock(block: ContentBlock, imageMap?: Map<string, string>): Promise<any> {
    const text = this.cleanText(block.content);
    const style = block.style || {};
    const fontSize = style.fontSize || 24;
    const bold = style.bold || false;
    const color = style.color || "000000";

    switch (block.type) {
      case "heading":
        return this.createHeading(text, block.level || 1, fontSize, bold, color);
      case "code":
        return this.createCodeBlock(text, fontSize, color);
      case "list":
      case "listitem":
        return this.createListItem(text, fontSize, bold, color);
      case "link":
        return this.createLink(text, block.href || "", fontSize);
      case "image":
        const localPath = imageMap?.get(block.src || "");
        return this.createImage(block.src || "", block.alt || "", localPath);
      case "paragraph":
      default:
        return this.createParagraph(text, fontSize, bold, color);
    }
  }

  private createHeading(text: string, level: number, fontSize: number, bold: boolean, color: string): any {
    const sizes: Record<number, number> = {
      1: 44,
      2: 36,
      3: 32,
      4: 28,
    };
    
    const finalSize = fontSize > 24 ? fontSize : (sizes[level] || 28);
    
    return new Paragraph({
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ 
        text, 
        bold: true, 
        size: finalSize,
        font: "Microsoft YaHei",
        color,
      })],
    });
  }

  private createCodeBlock(text: string, fontSize: number, color: string): any {
    return new Paragraph({
      spacing: { before: 150, after: 150, line: 276 },
      shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
      border: {
        left: { style: BorderStyle.SINGLE, size: 24, color: "CCCCCC" },
      },
      indent: { left: 400 },
      children: [new TextRun({ 
        text, 
        font: "Consolas", 
        size: 20,
        color,
      })],
    });
  }

  private createListItem(text: string, fontSize: number, bold: boolean, color: string): any {
    const orderedMatch = text.match(/^(\d+)[.、．]\s*(.+)/);
    if (orderedMatch) {
      return new Paragraph({
        spacing: { after: 80, line: 360 },
        indent: { left: 720, hanging: 360 },
        children: [
          new TextRun({ text: `${orderedMatch[1]}. `, bold: true, size: fontSize }),
          new TextRun({ text: orderedMatch[2], bold, size: fontSize, color }),
        ],
      });
    }
    
    return new Paragraph({
      spacing: { after: 80, line: 360 },
      indent: { left: 720, hanging: 360 },
      children: [
        new TextRun({ text: "• ", bold: true, size: fontSize }),
        new TextRun({ text, bold, size: fontSize, color }),
      ],
    });
  }

  private createLink(text: string, href: string, fontSize: number): any {
    return new Paragraph({
      spacing: { after: 80 },
      children: [
        new ExternalHyperlink({
          children: [new TextRun({ 
            text, 
            color: "0563C1", 
            underline: { type: "single" },
            size: fontSize,
            font: "Microsoft YaHei",
          })],
          link: href,
        }),
      ],
    });
  }

  private async createImage(src: string, alt: string, localPath?: string): Promise<any> {
    if (localPath) {
      try {
        const imagePath = path.join(process.cwd(), "out", localPath);
        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);
          const imageRun = new ImageRun({
            data: imageBuffer,
            transformation: {
              width: 500,
              height: 300,
            },
            type: "jpg",
          });
          return new Paragraph({
            spacing: { before: 200, after: 200 },
            alignment: AlignmentType.CENTER,
            children: [imageRun],
          });
        }
      } catch (error) {
        console.log(`图片嵌入失败: ${error}`);
      }
    }
    return new Paragraph({
      spacing: { before: 200, after: 200 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ 
        text: `[图片: ${alt || src}]`, 
        color: "666666",
        italics: true,
      })],
    });
  }

  private createParagraph(text: string, fontSize: number, bold: boolean, color: string): any {
    return new Paragraph({
      spacing: { after: 120, line: 360 },
      children: [new TextRun({ 
        text,
        size: fontSize,
        bold,
        color,
        font: "Microsoft YaHei",
      })],
    });
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}
