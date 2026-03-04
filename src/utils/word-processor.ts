/**
 * Word文档处理模块
 * 负责生成Word文档
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from 'docx';
import fs from 'fs';
import path from 'path';
import { PageInfo } from './content-extractor';

/**
 * Word处理器类
 */
export class WordProcessor {
  /**
   * 生成Word文档
   * @param pageInfo 页面信息
   */
  generateWord(pageInfo: PageInfo): Document {
    console.log('生成Word文档...');
    
    try {
      const children = [
        // 标题
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({
                  text: pageInfo.title,
                  bold: true,
                  size: 24,
                  font: '宋体',
                }),
              ],
            }),
            
            // 内容
            ...pageInfo.textContent.split('\n\n').map((paragraph) => {
              if (!paragraph.trim()) {
                return new Paragraph({});
              }
              return new Paragraph({
                children: [
                  new TextRun({
                    text: paragraph.trim(),
                    size: 16,
                    font: '宋体',
                  }),
                ],
              });
            }),
      ];
      
      // 添加图片
      if (pageInfo.images && pageInfo.images.length > 0) {
        console.log(`添加 ${pageInfo.images.length} 张图片到Word文档...`);
        
        pageInfo.images.forEach((image, index) => {
          try {
            // 构建完整的图片路径
            const fullImagePath = path.join(__dirname, '../../out', image.localPath);
            
            if (fs.existsSync(fullImagePath)) {
              // 读取图片文件
              const imageBuffer = fs.readFileSync(fullImagePath);
              
              // 创建图片段落
              children.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: imageBuffer,
                      type: 'png',
                      transformation: {
                        width: 500,
                        height: 300,
                      },
                    }),
                  ],
                })
              );
              
              console.log(`成功添加图片 ${index + 1}: ${image.localPath}`);
            } else {
              console.log(`图片文件不存在: ${fullImagePath}`);
            }
          } catch (error) {
            console.error(`添加图片 ${index + 1} 时出错: ${error}`);
          }
        });
      }
      
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: children,
          },
        ],
      });
      
      return doc;
    } catch (error) {
      console.error(`生成Word文档时出错: ${error}`);
      // 返回一个最小化的文档，确保程序能够继续运行
      return new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: pageInfo.title || '无标题' }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: '文档生成过程中出错' }),
                ],
              }),
            ],
          },
        ],
      });
    }
  }

  /**
   * 保存Word文档
   * @param pageInfo 页面信息
   * @param doc 文档对象
   */
  async saveWord(pageInfo: PageInfo, doc: Document): Promise<string> {
    // 生成安全的标题
    const safeTitle = this.generateSafeTitle(pageInfo.title);
    
    // 生成输出路径
    const outputDir = this.getOutputDir(safeTitle);
    const wordPath = path.join(outputDir, `${safeTitle}.docx`);
    
    // 创建输出目录
    this.createOutputDir(outputDir);
    
    // 生成并写入文件
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(wordPath, buffer);
    console.log(`Word文档已生成: ${wordPath}`);
    
    return wordPath;
  }

  /**
   * 生成安全的标题
   * @param title 原始标题
   */
  private generateSafeTitle(title: string): string {
    return title.replace(/[^a-zA-Z0-9一-龥]/g, '_');
  }

  /**
   * 获取输出目录
   * @param safeTitle 安全标题
   */
  private getOutputDir(safeTitle: string): string {
    return path.join(__dirname, `../../out/${safeTitle}`);
  }

  /**
   * 创建输出目录
   * @param outputDir 输出目录路径
   */
  private createOutputDir(outputDir: string): void {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }
}