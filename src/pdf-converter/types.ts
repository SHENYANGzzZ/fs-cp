/**
 * PDF转换模块 - 类型定义
 * 定义所有相关的接口和类型
 */

import { Page } from "puppeteer";

/**
 * 视口信息
 */
export interface ViewportInfo {
  /** 视口高度（像素） */
  innerHeight: number;
  /** 视口宽度（像素） */
  innerWidth: number;
  /** 当前滚动位置Y坐标 */
  scrollY: number;
  /** 文档总高度 */
  scrollHeight: number;
  /** 文档总宽度 */
  scrollWidth: number;
  /** 设备像素比 */
  devicePixelRatio: number;
}

/**
 * 截图选项
 */
export interface ScreenshotOptions {
  /** 视口宽度，默认1280 */
  viewportWidth: number;
  /** 视口高度，默认800 */
  viewportHeight: number;
  /** 设备像素比，默认1（避免高清屏截图问题） */
  deviceScaleFactor: number;
  /** 滚动后等待时间（毫秒），默认100 */
  scrollDelay: number;
  /** 截图类型 */
  type: "png" | "jpeg";
}

/**
 * 滚动选项
 */
export interface ScrollOptions {
  /** 滚动后等待时间（毫秒），默认100 */
  scrollDelay: number;
  /** 懒加载最大等待时间（毫秒），默认30000 */
  lazyLoadTimeout: number;
  /** 高度稳定性检测次数，默认3 */
  stableCheckCount: number;
}

/**
 * 拼接选项
 */
export interface StitchOptions {
  /** 拼接重叠像素，默认10 */
  overlap: number;
  /** 是否启用智能裁剪 */
  smartCrop: boolean;
}

/**
 * PDF选项
 */
export interface PDFOptions {
  /** 图片质量 */
  quality: "low" | "medium" | "high";
  /** 页面尺寸 */
  pageSize: "A4" | "A3" | "Letter" | "Auto";
}

/**
 * 转换器选项
 */
export interface ConverterOptions {
  /** 截图选项 */
  screenshot?: Partial<ScreenshotOptions>;
  /** 滚动选项 */
  scroll?: Partial<ScrollOptions>;
  /** 拼接选项 */
  stitch?: Partial<StitchOptions>;
  /** PDF选项 */
  pdf?: Partial<PDFOptions>;
}

/**
 * 默认截图选项
 */
export const DEFAULT_SCREENSHOT_OPTIONS: ScreenshotOptions = {
  viewportWidth: 1280,
  viewportHeight: 800,
  deviceScaleFactor: 1,
  scrollDelay: 100,
  type: "png",
};

/**
 * 默认滚动选项
 */
export const DEFAULT_SCROLL_OPTIONS: ScrollOptions = {
  scrollDelay: 100,
  lazyLoadTimeout: 30000,
  stableCheckCount: 3,
};

/**
 * 默认拼接选项
 */
export const DEFAULT_STITCH_OPTIONS: StitchOptions = {
  overlap: 10,
  smartCrop: true,
};

/**
 * 默认PDF选项
 */
export const DEFAULT_PDF_OPTIONS: PDFOptions = {
  quality: "high",
  pageSize: "Auto",
};

/**
 * 截图结果
 */
export interface ScreenshotResult {
  /** 截图Buffer */
  buffer: Buffer;
  /** 截图时的滚动位置 */
  scrollY: number;
  /** 截图序号 */
  index: number;
}

/**
 * 转换结果
 */
export interface ConversionResult {
  /** 输出文件路径 */
  outputPath: string;
  /** 总截图数量 */
  screenshotCount: number;
  /** 总处理时间（毫秒） */
  duration: number;
}
