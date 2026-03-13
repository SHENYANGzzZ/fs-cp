# 网页转PDF自动化工具 - 开发文档

> 创建时间：2026年3月12日
> 作者：Trae AI Assistant

## 一、项目概述

### 1.1 功能目标

开发一个能够将网页内容转换为PDF文件的自动化工具，通过截图拼接的方式生成完整、清晰、无拼接痕迹的PDF文件。

### 1.2 核心流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        核心工作流程                               │
├─────────────────────────────────────────────────────────────────┤
│  1. 启动浏览器 → 访问目标网页                                     │
│  2. 等待页面完全加载                                              │
│  3. 滚动到底部 → 触发所有懒加载内容                                │
│  4. 检测页面高度稳定（懒加载完成）                                  │
│  5. 回到页面顶部                                                  │
│  6. 隐藏固定定位元素（Header/Footer）                              │
│  7. 循环执行：截图 → 向下滚动 → 等待渲染                           │
│  8. 智能拼接所有截图                                              │
│  9. 转换为PDF文件                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 二、技术可行性分析

### 2.1 技术栈选择

| 功能模块 | 技术方案 | 说明 |
|----------|----------|------|
| 浏览器自动化 | Puppeteer | 项目已集成，成熟稳定 |
| 图片处理 | sharp | 高性能Node.js图片处理库 |
| PDF生成 | pdf-lib | 纯JavaScript，无需外部依赖 |
| 类型检查 | TypeScript | 项目已配置 |

### 2.2 关键技术点分析

#### 2.2.1 精确获取视口高度

**方案**：使用Puppeteer的`page.evaluate()`获取精确的视口尺寸。

```typescript
// 获取视口信息
const viewportInfo = await page.evaluate(() => ({
  innerHeight: window.innerHeight,           // 视口高度
  scrollY: window.scrollY,                   // 当前滚动位置
  scrollHeight: document.documentElement.scrollHeight,  // 文档总高度
  devicePixelRatio: window.devicePixelRatio  // 设备像素比
}));
```

**注意事项**：
- 确保`devicePixelRatio`为1，避免高清屏导致的截图尺寸问题
- 使用`document.documentElement.scrollHeight`获取完整文档高度

#### 2.2.2 图片拼接功能

**方案**：使用`sharp`库进行高性能图片拼接。

```typescript
import sharp from 'sharp';

async function stitchImages(imageBuffers: Buffer[]): Promise<Buffer> {
  // 获取第一张图片的宽度作为基准
  const firstImage = sharp(imageBuffers[0]);
  const { width } = await firstImage.metadata();
  
  // 计算总高度
  const heights = await Promise.all(
    imageBuffers.map(buf => sharp(buf).metadata().then(m => m.height))
  );
  const totalHeight = heights.reduce((a, b) => a + b, 0);
  
  // 创建合成参数
  const compositeInputs = imageBuffers.map((buf, index) => {
    const topOffset = heights.slice(0, index).reduce((a, b) => a + b, 0);
    return { input: buf, top: topOffset, left: 0 };
  });
  
  // 创建空白画布并合成所有图片
  return await sharp({
    create: {
      width: width,
      height: totalHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  }).composite(compositeInputs).png().toBuffer();
}
```

#### 2.2.3 滚动与截图同步

**方案**：使用Promise链确保操作顺序。

```typescript
async function scrollAndScreenshot(page: Page, scrollHeight: number): Promise<Buffer[]> {
  const screenshots: Buffer[] = [];
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  
  let currentY = 0;
  
  while (currentY < totalHeight) {
    // 1. 滚动到指定位置
    await page.evaluate((y) => {
      window.scrollTo(0, y);
    }, currentY);
    
    // 2. 等待滚动完成和渲染
    await page.waitForTimeout(100);
    
    // 3. 截图
    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'binary'
    });
    screenshots.push(screenshot);
    
    // 4. 计算下一次滚动位置
    currentY += viewportHeight;
  }
  
  return screenshots;
}
```

#### 2.2.4 处理动态加载内容

**方案**：智能检测页面高度稳定性。

```typescript
async function waitForLazyLoad(page: Page, maxWaitTime: number = 30000): Promise<void> {
  const startTime = Date.now();
  let lastHeight = 0;
  let stableCount = 0;
  
  while (Date.now() - startTime < maxWaitTime) {
    const currentHeight = await page.evaluate(() => 
      document.documentElement.scrollHeight
    );
    
    if (currentHeight === lastHeight) {
      stableCount++;
      // 连续3次高度相同，认为加载完成
      if (stableCount >= 3) {
        console.log('页面高度稳定，懒加载完成');
        return;
      }
    } else {
      stableCount = 0;
      lastHeight = currentHeight;
    }
    
    // 滚动到底部触发加载
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    
    await page.waitForTimeout(500);
  }
  
  console.log('达到最大等待时间，继续执行');
}
```

### 2.3 潜在问题与解决方案

| 问题 | 影响 | 解决方案 |
|------|------|----------|
| 固定元素重复 | Header/Footer在每张截图出现 | 截图前隐藏固定定位元素 |
| 拼接缝隙 | 1-2px误差导致内容断裂 | 添加重叠区域，智能裁剪 |
| 懒加载未完成 | 内容缺失 | 滚动到底部+高度稳定性检测 |
| 高清屏问题 | 截图尺寸不一致 | 设置deviceScaleFactor为1 |
| 内存溢出 | 长页面截图过多 | 分批处理，增量保存 |

## 三、详细设计方案

### 3.1 模块架构

```
src/
├── pdf-converter/                    # PDF转换模块
│   ├── index.ts                      # 模块入口
│   ├── screenshot-capture.ts         # 截图捕获器
│   ├── image-stitcher.ts             # 图片拼接器
│   ├── pdf-generator.ts              # PDF生成器
│   ├── scroll-controller.ts          # 滚动控制器
│   └── types.ts                      # 类型定义
└── utils/
    └── browser-manager.ts            # 浏览器管理（已有，需扩展）
```

### 3.2 核心类设计

#### 3.2.1 ScreenshotCapture（截图捕获器）

```typescript
/**
 * 截图捕获器
 * 负责页面的滚动截图操作
 */
export class ScreenshotCapture {
  private page: Page;
  private options: ScreenshotOptions;
  
  constructor(page: Page, options?: Partial<ScreenshotOptions>) {
    this.page = page;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  
  /**
   * 捕获完整页面的截图序列
   * @returns 截图Buffer数组
   */
  async captureFullPage(): Promise<Buffer[]>;
  
  /**
   * 隐藏固定定位元素
   */
  private async hideFixedElements(): Promise<void>;
  
  /**
   * 恢复固定定位元素
   */
  private async restoreFixedElements(): Promise<void>;
  
  /**
   * 执行单次截图
   */
  private async takeScreenshot(): Promise<Buffer>;
}
```

#### 3.2.2 ImageStitcher（图片拼接器）

```typescript
/**
 * 图片拼接器
 * 负责将多张截图拼接成完整图片
 */
export class ImageStitcher {
  /**
   * 拼接图片序列
   * @param images 图片Buffer数组
   * @param overlap 重叠像素数（用于智能裁剪）
   * @returns 拼接后的图片Buffer
   */
  async stitch(images: Buffer[], overlap: number = 0): Promise<Buffer>;
  
  /**
   * 智能裁剪重叠区域
   * 通过图像相似度检测最佳裁剪位置
   */
  private async smartCrop(image1: Buffer, image2: Buffer, overlap: number): Promise<number>;
}
```

#### 3.2.3 PDFGenerator（PDF生成器）

```typescript
/**
 * PDF生成器
 * 负责将图片转换为PDF文件
 */
export class PDFGenerator {
  /**
   * 从图片生成PDF
   * @param imageBuffer 图片Buffer
   * @param outputPath 输出路径
   */
  async generateFromImage(imageBuffer: Buffer, outputPath: string): Promise<string>;
  
  /**
   * 从多张图片生成PDF（每张图片一页）
   */
  async generateFromImages(imageBuffers: Buffer[], outputPath: string): Promise<string>;
}
```

#### 3.2.4 ScrollController（滚动控制器）

```typescript
/**
 * 滚动控制器
 * 负责页面滚动和懒加载处理
 */
export class ScrollController {
  private page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }
  
  /**
   * 滚动到底部并等待懒加载完成
   */
  async scrollToBottomAndWait(): Promise<void>;
  
  /**
   * 滚动到顶部
   */
  async scrollToTop(): Promise<void>;
  
  /**
   * 按固定高度滚动
   * @param height 滚动高度
   */
  async scrollBy(height: number): Promise<void>;
  
  /**
   * 获取视口信息
   */
  async getViewportInfo(): Promise<ViewportInfo>;
  
  /**
   * 检测页面高度稳定性
   */
  private async waitForHeightStable(maxWaitMs: number): Promise<void>;
}
```

### 3.3 主流程实现

```typescript
/**
 * 网页转PDF主流程
 */
export async function convertWebPageToPDF(
  url: string,
  outputPath: string,
  options?: ConverterOptions
): Promise<string> {
  const browserManager = new BrowserManager();
  
  try {
    // 1. 启动浏览器
    await browserManager.launch();
    const page = browserManager.getPage()!;
    
    // 2. 访问页面
    await browserManager.navigate(url);
    await browserManager.waitForPageReady();
    
    // 3. 初始化控制器
    const scrollController = new ScrollController(page);
    const screenshotCapture = new ScreenshotCapture(page, options?.screenshot);
    const imageStitcher = new ImageStitcher();
    const pdfGenerator = new PDFGenerator();
    
    // 4. 滚动到底部，触发懒加载
    console.log('正在触发懒加载...');
    await scrollController.scrollToBottomAndWait();
    
    // 5. 回到顶部
    await scrollController.scrollToTop();
    await page.waitForTimeout(500);
    
    // 6. 捕获完整页面截图
    console.log('正在捕获页面截图...');
    const screenshots = await screenshotCapture.captureFullPage();
    console.log(`捕获完成，共 ${screenshots.length} 张截图`);
    
    // 7. 拼接图片
    console.log('正在拼接图片...');
    const stitchedImage = await imageStitcher.stitch(
      screenshots, 
      options?.stitchOverlap ?? 10
    );
    
    // 8. 生成PDF
    console.log('正在生成PDF...');
    const pdfPath = await pdfGenerator.generateFromImage(stitchedImage, outputPath);
    
    console.log(`PDF生成成功: ${pdfPath}`);
    return pdfPath;
    
  } finally {
    await browserManager.close();
  }
}
```

## 四、依赖配置

### 4.1 新增依赖

```json
{
  "dependencies": {
    "sharp": "^0.33.0",
    "pdf-lib": "^1.17.1"
  }
}
```

### 4.2 安装命令

```bash
npm install sharp pdf-lib
npm install --save-dev @types/sharp
```

## 五、配置选项

### 5.1 转换选项接口

```typescript
interface ConverterOptions {
  // 截图选项
  screenshot?: {
    viewportWidth?: number;      // 视口宽度，默认1280
    viewportHeight?: number;     // 视口高度，默认800
    deviceScaleFactor?: number;  // 设备像素比，默认1
    fullPage?: boolean;          // 是否全页面截图
  };
  
  // 滚动选项
  scroll?: {
    scrollDelay?: number;        // 滚动后等待时间(ms)，默认100
    lazyLoadTimeout?: number;    // 懒加载最大等待时间(ms)，默认30000
  };
  
  // 拼接选项
  stitchOverlap?: number;        // 拼接重叠像素，默认10
  
  // PDF选项
  pdf?: {
    quality?: 'low' | 'medium' | 'high';  // 图片质量
    pageSize?: 'A4' | 'A3' | 'Letter';    // 页面尺寸
  };
}
```

## 六、使用示例

### 6.1 基本使用

```typescript
import { convertWebPageToPDF } from './pdf-converter';

// 基本用法
await convertWebPageToPDF(
  'https://example.com/article',
  './output/article.pdf'
);
```

### 6.2 自定义配置

```typescript
// 自定义配置
await convertWebPageToPDF(
  'https://example.com/long-article',
  './output/long-article.pdf',
  {
    screenshot: {
      viewportWidth: 1920,
      viewportHeight: 1080,
      deviceScaleFactor: 1
    },
    scroll: {
      scrollDelay: 200,
      lazyLoadTimeout: 60000
    },
    stitchOverlap: 20,
    pdf: {
      quality: 'high'
    }
  }
);
```

## 七、测试计划

### 7.1 单元测试

| 测试项 | 测试内容 |
|--------|----------|
| ScrollController | 滚动位置准确性、高度检测 |
| ScreenshotCapture | 截图完整性、固定元素隐藏 |
| ImageStitcher | 拼接无缝性、智能裁剪 |
| PDFGenerator | PDF生成、页面尺寸 |

### 7.2 集成测试

| 测试场景 | 预期结果 |
|----------|----------|
| 短页面（1-2屏） | 单张截图，正确转PDF |
| 长页面（10+屏） | 多张截图拼接完整 |
| 懒加载页面 | 所有内容正确捕获 |
| 固定Header页面 | Header不重复出现 |

## 八、风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| 内存溢出 | 中 | 高 | 分批处理，增量保存 |
| 页面加载超时 | 低 | 中 | 可配置超时时间 |
| 截图拼接错位 | 低 | 高 | 智能裁剪算法 |
| PDF文件过大 | 中 | 低 | 图片压缩选项 |

## 九、后续优化方向

1. **增量截图保存**：长页面分批保存，避免内存溢出
2. **智能去重**：自动识别并去除重复的固定元素
3. **并行处理**：多线程截图提升性能
4. **OCR支持**：生成可搜索的PDF
5. **命令行工具**：支持CLI调用

## 十、总结

本方案基于现有的Puppeteer基础设施，通过新增`sharp`和`pdf-lib`依赖，实现完整的网页转PDF功能。核心流程清晰，技术方案成熟可行，预计开发周期为2-3天。

---

**文档版本**：v1.0
**最后更新**：2026年3月12日
