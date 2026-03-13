/**
 * PDF转换模块入口
 * 提供网页转PDF的完整功能
 */

import { Page } from "puppeteer";
import * as path from "path";
import * as fs from "fs";
import {
  ConverterOptions,
  ConversionResult,
  DEFAULT_SCREENSHOT_OPTIONS,
  DEFAULT_SCROLL_OPTIONS,
  DEFAULT_STITCH_OPTIONS,
  DEFAULT_PDF_OPTIONS,
} from "./types";
import { ScrollController } from "./scroll-controller";
import { ScreenshotCapture } from "./screenshot-capture";
import { ImageStitcher } from "./image-stitcher";
import { PDFGenerator } from "./pdf-generator";

export {
  ScrollController,
  ScreenshotCapture,
  ImageStitcher,
  PDFGenerator,
};

export * from "./types";

/**
 * 网页转PDF主函数
 * @param page Puppeteer页面对象
 * @param outputPath PDF输出路径
 * @param options 转换选项
 * @returns 转换结果
 */
export async function convertWebPageToPDF(
  page: Page,
  outputPath: string,
  options?: ConverterOptions
): Promise<ConversionResult> {
  const startTime = Date.now();

  const screenshotOptions = {
    ...DEFAULT_SCREENSHOT_OPTIONS,
    ...options?.screenshot,
  };

  const scrollOptions = {
    ...DEFAULT_SCROLL_OPTIONS,
    ...options?.scroll,
  };

  const stitchOptions = {
    ...DEFAULT_STITCH_OPTIONS,
    ...options?.stitch,
  };

  const pdfOptions = {
    ...DEFAULT_PDF_OPTIONS,
    ...options?.pdf,
  };

  console.log("========================================");
  console.log("开始网页转PDF转换");
  console.log("========================================");

  const scrollController = new ScrollController(page, scrollOptions);
  const screenshotCapture = new ScreenshotCapture(page, screenshotOptions);
  const imageStitcher = new ImageStitcher(stitchOptions);
  const pdfGenerator = new PDFGenerator(pdfOptions);

  await screenshotCapture.setViewport();

  console.log("步骤1: 捕获页面截图（包含滚动加载和元素隐藏）...");
  const screenshots = await screenshotCapture.captureFullPage();

  console.log("步骤2: 拼接截图...");
  const stitchedImage = await imageStitcher.stitch(
    screenshots.map((s) => s.buffer),
    stitchOptions.overlap
  );

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log("步骤3: 生成PDF文件...");
  await pdfGenerator.generateFromImage(stitchedImage, outputPath);

  const duration = Date.now() - startTime;

  console.log("========================================");
  console.log("转换完成!");
  console.log(`输出文件: ${outputPath}`);
  console.log(`截图数量: ${screenshots.length}`);
  console.log(`耗时: ${(duration / 1000).toFixed(2)}秒`);
  console.log("========================================");

  return {
    outputPath,
    screenshotCount: screenshots.length,
    duration,
  };
}

/**
 * 保存拼接后的图片（可选）
 * @param page Puppeteer页面对象
 * @param outputPath 图片输出路径
 * @param options 转换选项
 * @returns 图片路径
 */
export async function saveStitchedImage(
  page: Page,
  outputPath: string,
  options?: ConverterOptions
): Promise<string> {
  const screenshotOptions = {
    ...DEFAULT_SCREENSHOT_OPTIONS,
    ...options?.screenshot,
  };

  const scrollOptions = {
    ...DEFAULT_SCROLL_OPTIONS,
    ...options?.scroll,
  };

  const stitchOptions = {
    ...DEFAULT_STITCH_OPTIONS,
    ...options?.stitch,
  };

  const scrollController = new ScrollController(page, scrollOptions);
  const screenshotCapture = new ScreenshotCapture(page, screenshotOptions);
  const imageStitcher = new ImageStitcher(stitchOptions);

  await screenshotCapture.setViewport();

  await scrollController.scrollToBottomAndWait();
  await scrollController.scrollToTop();
  await new Promise((resolve) => setTimeout(resolve, 500));

  const screenshots = await screenshotCapture.captureFullPage();
  const stitchedImage = await imageStitcher.stitch(
    screenshots.map((s) => s.buffer),
    stitchOptions.overlap
  );

  await imageStitcher.saveToFile(stitchedImage, outputPath);

  return outputPath;
}
