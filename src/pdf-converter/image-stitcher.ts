/**
 * 图片拼接器
 * 负责将多张截图拼接成完整图片
 * 支持智能裁剪重叠区域
 */

import sharp from "sharp";
import { StitchOptions, DEFAULT_STITCH_OPTIONS } from "./types";

export class ImageStitcher {
  private options: StitchOptions;

  constructor(options?: Partial<StitchOptions>) {
    this.options = { ...DEFAULT_STITCH_OPTIONS, ...options };
  }

  /**
   * 拼接图片序列
   * @param images 图片Buffer数组
   * @param overlap 可选的重叠像素数
   * @returns 拼接后的图片Buffer
   */
  async stitch(images: Buffer[], overlap?: number): Promise<Buffer> {
    const actualOverlap = overlap ?? this.options.overlap;
    
    if (images.length === 0) {
      throw new Error("没有可拼接的图片");
    }

    if (images.length === 1) {
      console.log("只有一张图片，无需拼接");
      return images[0];
    }

    console.log(`开始拼接 ${images.length} 张图片...`);

    const firstImage = sharp(images[0]);
    const { width } = await firstImage.metadata();

    if (!width) {
      throw new Error("无法获取图片宽度");
    }

    const imageInfos = await Promise.all(
      images.map(async (buf, index) => {
        const meta = await sharp(buf).metadata();
        return {
          buffer: buf,
          width: meta.width || width,
          height: meta.height || 0,
          index,
        };
      })
    );

    let totalHeight = 0;
    const compositeInputs: { input: Buffer; top: number; left: number }[] = [];

    for (let i = 0; i < imageInfos.length; i++) {
      const info = imageInfos[i];
      let topOffset = totalHeight;
      let cropHeight = info.height;

      if (i > 0 && this.options.smartCrop && actualOverlap > 0) {
        const prevInfo = imageInfos[i - 1];
        const currentOverlap = Math.min(actualOverlap, prevInfo.height, info.height);

        if (currentOverlap > 0) {
          const cropOffset = await this.smartCrop(
            imageInfos[i - 1].buffer,
            info.buffer,
            currentOverlap
          );
          cropHeight = info.height - cropOffset;
          topOffset = totalHeight - currentOverlap + cropOffset;
        }
      }

      compositeInputs.push({
        input: info.buffer,
        top: topOffset,
        left: 0,
      });

      totalHeight = topOffset + cropHeight;
    }

    console.log(`创建画布: ${width}x${totalHeight}px`);

    const result = await sharp({
      create: {
        width: width,
        height: totalHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(compositeInputs)
      .png()
      .toBuffer();

    console.log("图片拼接完成");
    return result;
  }

  /**
   * 智能裁剪重叠区域
   * 通过图像相似度检测最佳裁剪位置
   * @param image1 上一张图片
   * @param image2 当前图片
   * @param overlap 重叠像素数
   * @returns 最佳裁剪偏移量
   */
  private async smartCrop(
    image1: Buffer,
    image2: Buffer,
    overlap: number
  ): Promise<number> {
    try {
      const meta1 = await sharp(image1).metadata();
      const meta2 = await sharp(image2).metadata();

      const height1 = meta1.height || 0;
      const height2 = meta2.height || 0;
      const width = meta1.width || 0;

      if (height1 === 0 || height2 === 0 || width === 0) {
        return 0;
      }

      const sampleHeight = Math.min(overlap, 50);
      const bottomRegion = sharp(image1)
        .extract({
          left: 0,
          top: height1 - sampleHeight,
          width: width,
          height: sampleHeight,
        })
        .raw()
        .toBuffer();

      const topRegion = sharp(image2)
        .extract({
          left: 0,
          top: 0,
          width: width,
          height: sampleHeight,
        })
        .raw()
        .toBuffer();

      const [bottomData, topData] = await Promise.all([bottomRegion, topRegion]);

      const similarity = this.calculateSimilarity(bottomData, topData);

      if (similarity > 0.9) {
        return Math.floor(overlap / 2);
      }

      return 0;
    } catch (error) {
      console.warn("智能裁剪失败，使用默认值:", error);
      return 0;
    }
  }

  /**
   * 计算两个图像区域的相似度
   * @param data1 图像1的原始数据
   * @param data2 图像2的原始数据
   * @returns 相似度（0-1）
   */
  private calculateSimilarity(data1: Buffer, data2: Buffer): number {
    if (data1.length !== data2.length) {
      return 0;
    }

    let diff = 0;
    const length = data1.length;

    for (let i = 0; i < length; i++) {
      diff += Math.abs(data1[i] - data2[i]);
    }

    const maxDiff = length * 255;
    const similarity = 1 - diff / maxDiff;

    return similarity;
  }

  /**
   * 保存拼接后的图片到文件
   * @param image 图片Buffer
   * @param outputPath 输出路径
   */
  async saveToFile(image: Buffer, outputPath: string): Promise<string> {
    await sharp(image).toFile(outputPath);
    console.log(`图片已保存: ${outputPath}`);
    return outputPath;
  }
}
