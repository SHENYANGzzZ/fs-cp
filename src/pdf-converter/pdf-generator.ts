/**
 * PDF生成器
 * 负责将图片转换为PDF文件
 * 使用pdf-lib库实现
 */

import { PDFDocument } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { PDFOptions, DEFAULT_PDF_OPTIONS } from "./types";

export class PDFGenerator {
  private options: PDFOptions;

  constructor(options?: Partial<PDFOptions>) {
    this.options = { ...DEFAULT_PDF_OPTIONS, ...options };
  }

  /**
   * 从单张图片生成PDF
   * @param imageBuffer 图片Buffer
   * @param outputPath 输出路径
   * @returns PDF文件路径
   */
  async generateFromImage(imageBuffer: Buffer, outputPath: string): Promise<string> {
    console.log("正在生成PDF文件...");

    const pdfDoc = await PDFDocument.create();

    const processedImage = await this.processImage(imageBuffer);
    const image = await this.embedImage(pdfDoc, processedImage.buffer);

    if (!image) {
      throw new Error("无法嵌入图片到PDF");
    }

    const page = pdfDoc.addPage([processedImage.width, processedImage.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: processedImage.width,
      height: processedImage.height,
    });

    await this.savePDF(pdfDoc, outputPath);

    console.log(`PDF生成成功: ${outputPath}`);
    return outputPath;
  }

  /**
   * 从多张图片生成PDF（每张图片一页）
   * @param imageBuffers 图片Buffer数组
   * @param outputPath 输出路径
   * @returns PDF文件路径
   */
  async generateFromImages(imageBuffers: Buffer[], outputPath: string): Promise<string> {
    console.log(`正在从 ${imageBuffers.length} 张图片生成PDF...`);

    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < imageBuffers.length; i++) {
      const processedImage = await this.processImage(imageBuffers[i]);
      const image = await this.embedImage(pdfDoc, processedImage.buffer);

      if (!image) {
        console.warn(`第 ${i + 1} 张图片嵌入失败，跳过`);
        continue;
      }

      const page = pdfDoc.addPage([processedImage.width, processedImage.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: processedImage.width,
        height: processedImage.height,
      });

      console.log(`已添加第 ${i + 1} 页`);
    }

    await this.savePDF(pdfDoc, outputPath);

    console.log(`PDF生成成功: ${outputPath}`);
    return outputPath;
  }

  /**
   * 处理图片（压缩、调整尺寸）
   * @param imageBuffer 原始图片Buffer
   * @returns 处理后的图片信息
   */
  private async processImage(imageBuffer: Buffer): Promise<{
    buffer: Buffer;
    width: number;
    height: number;
  }> {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    let quality = 80;
    switch (this.options.quality) {
      case "low":
        quality = 50;
        break;
      case "medium":
        quality = 70;
        break;
      case "high":
        quality = 90;
        break;
    }

    const processedBuffer = await sharp(imageBuffer)
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    return {
      buffer: processedBuffer,
      width: metadata.width || 800,
      height: metadata.height || 600,
    };
  }

  /**
   * 将图片嵌入PDF文档
   * @param pdfDoc PDF文档对象
   * @param imageBuffer 图片Buffer
   * @returns 嵌入的图片对象
   */
  private async embedImage(
    pdfDoc: PDFDocument,
    imageBuffer: Buffer
  ): Promise<any> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      if (metadata.format === "png") {
        return await pdfDoc.embedPng(imageBuffer);
      } else {
        const jpgBuffer = await sharp(imageBuffer).jpeg().toBuffer();
        return await pdfDoc.embedJpg(jpgBuffer);
      }
    } catch (error) {
      console.error("嵌入图片失败:", error);
      return null;
    }
  }

  /**
   * 保存PDF文件
   * @param pdfDoc PDF文档对象
   * @param outputPath 输出路径
   */
  private async savePDF(pdfDoc: PDFDocument, outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
  }

  /**
   * 获取PDF页面尺寸
   * @param pageSize 页面尺寸名称
   * @returns 宽度和高度
   */
  getPageSize(pageSize: string): { width: number; height: number } {
    switch (pageSize) {
      case "A4":
        return { width: 595.28, height: 841.89 };
      case "A3":
        return { width: 841.89, height: 1190.55 };
      case "Letter":
        return { width: 612, height: 792 };
      default:
        return { width: 595.28, height: 841.89 };
    }
  }
}
