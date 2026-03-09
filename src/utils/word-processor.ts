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
        
        // 处理标题和内容
        ...this.processContentWithHeadings(pageInfo.textContent, pageInfo.headings),
        
        // 添加超链接
        ...(pageInfo.links && pageInfo.links.length > 0 ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: '超链接',
                bold: true,
                size: 20,
                font: '宋体',
              }),
            ],
          }),
          ...pageInfo.links.map((link, index) => {
            return new Paragraph({
              children: [
                new TextRun({
                  text: `${index + 1}. `,
                  size: 16,
                  font: '宋体',
                }),
                new TextRun({
                  text: link.text,
                  size: 16,
                  font: '宋体',
                  color: '0000FF',
                  underline: { type: 'single' },
                }),
              ],
            });
          })
        ] : []),
        
        // 添加代码块
        ...(pageInfo.codeBlocks && pageInfo.codeBlocks.length > 0 ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: '代码块',
                bold: true,
                size: 20,
                font: '宋体',
              }),
            ],
          }),
          ...pageInfo.codeBlocks.map((codeBlock, index) => {
            return [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `代码块 ${index + 1} ${codeBlock.language ? `(${codeBlock.language})` : ''}`,
                    bold: true,
                    size: 14,
                    font: '宋体',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: codeBlock.content,
                    size: 14,
                    font: 'Courier New',
                    break: 1,
                  }),
                ],
                indent: {
                  left: 720,
                  hanging: 360,
                },
              })
            ];
          }).flat()
        ] : []),
      ];
      
      // 添加图片
      if (pageInfo.images && pageInfo.images.length > 0) {
        console.log(`添加 ${pageInfo.images.length} 张图片到Word文档...`);
        
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [
              new TextRun({
                text: '图片',
                bold: true,
                size: 20,
                font: '宋体',
              }),
            ],
          })
        );
        
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
                    new TextRun({
                      text: `图片 ${index + 1} ${image.alt ? `(${image.alt})` : ''}`,
                      size: 14,
                      font: '宋体',
                    }),
                  ],
                }),
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
  
  /**
   * 处理内容和标题，生成正确的文档结构
   * @param content 文本内容
   * @param headings 标题列表
   */
  private processContentWithHeadings(content: string, headings: string[]): any[] {
    const result: any[] = [];
    let currentContent = content;
    
    // 按标题分割内容
    headings.forEach((heading, index) => {
      const headingIndex = currentContent.indexOf(heading);
      if (headingIndex !== -1) {
        // 提取标题前的内容
        const preHeadingContent = currentContent.substring(0, headingIndex).trim();
        if (preHeadingContent) {
          // 将内容分割为段落
          const paragraphs = preHeadingContent.split('\n\n');
          paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
              result.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: paragraph.trim(),
                      size: 16,
                      font: '宋体',
                    }),
                  ],
                })
              );
            }
          });
        }
        
        // 确定标题层级（简单处理：根据索引分配层级）
        let headingLevel: typeof HeadingLevel[keyof typeof HeadingLevel];
        if (index === 0) {
          headingLevel = HeadingLevel.HEADING_2;
        } else if (index < 3) {
          headingLevel = HeadingLevel.HEADING_3;
        } else {
          headingLevel = HeadingLevel.HEADING_4;
        }
        
        // 添加标题
        result.push(
          new Paragraph({
            heading: headingLevel,
            children: [
              new TextRun({
                text: heading,
                bold: true,
                size: headingLevel === HeadingLevel.HEADING_2 ? 20 : 18,
                font: '宋体',
              }),
            ],
          })
        );
        
        // 更新当前内容
        currentContent = currentContent.substring(headingIndex + heading.length);
      }
    });
    
    // 添加剩余内容
    if (currentContent.trim()) {
      const paragraphs = currentContent.split('\n\n');
      paragraphs.forEach(paragraph => {
        if (paragraph.trim()) {
          result.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: paragraph.trim(),
                  size: 16,
                  font: '宋体',
                }),
              ]
            })
          );
        }
      });
    }
    
    return result;
  }
  
  /**
   * 检查文档质量
   * @param pageInfo 页面信息
   */
  checkDocumentQuality(pageInfo: PageInfo): void {
    console.log('检查文档质量...');
    
    // 检查内容长度
    if (pageInfo.contentLength < 1000) {
      console.warn('警告: 文档内容长度较短，可能不完整');
    } else {
      console.log(`内容长度: ${pageInfo.contentLength} 字符`);
    }
    
    // 检查标题数量
    if (pageInfo.headings.length === 0) {
      console.warn('警告: 文档没有提取到标题');
    } else {
      console.log(`标题数量: ${pageInfo.headings.length} 个`);
    }
    
    // 检查图片数量
    console.log(`图片数量: ${pageInfo.images.length} 张`);
    
    // 检查超链接数量
    console.log(`超链接数量: ${pageInfo.links.length} 个`);
    
    // 检查代码块数量
    console.log(`代码块数量: ${pageInfo.codeBlocks.length} 个`);
    
    // 检查内容完整性
    if (pageInfo.textContent.includes('登录') || pageInfo.textContent.includes('注册')) {
      console.warn('警告: 文档可能包含登录/注册相关内容，可能需要登录才能获取完整内容');
    }
    
    console.log('文档质量检查完成');
  }
  
  /**
   * 生成HTML预览文件
   * @param pageInfo 页面信息
   */
  generateHtmlPreview(pageInfo: PageInfo): string {
    console.log('生成HTML预览文件...');
    
    const safeTitle = this.generateSafeTitle(pageInfo.title);
    const outputDir = this.getOutputDir(safeTitle);
    const htmlPath = path.join(outputDir, `${safeTitle}_preview.html`);
    
    // 构建HTML内容
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageInfo.title} - 预览</title>
  <style>
    body {
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      line-height: 1.6;
      margin: 20px;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background-color: white;
      padding: 40px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      font-size: 28px;
      margin-bottom: 30px;
      text-align: center;
    }
    h2 {
      color: #444;
      font-size: 24px;
      margin-top: 40px;
      margin-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 10px;
    }
    h3 {
      color: #555;
      font-size: 20px;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    p {
      color: #333;
      margin-bottom: 15px;
    }
    .image-container {
      margin: 20px 0;
      text-align: center;
    }
    img {
      max-width: 100%;
      height: auto;
      border: 1px solid #e0e0e0;
      padding: 5px;
    }
    .link-section {
      margin-top: 40px;
    }
    .link-item {
      margin-bottom: 10px;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .code-section {
      margin-top: 40px;
    }
    .code-block {
      background-color: #f4f4f4;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
      font-family: 'Courier New', monospace;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .metadata {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${pageInfo.title}</h1>
    
    ${pageInfo.textContent.split('\n\n').map(paragraph => {
      if (!paragraph.trim()) return '';
      return `<p>${paragraph.trim()}</p>`;
    }).join('')}
    
    ${pageInfo.images && pageInfo.images.length > 0 ? `
    <h2>图片</h2>
    ${pageInfo.images.map((image, index) => {
      return `
      <div class="image-container">
        <p>图片 ${index + 1} ${image.alt ? `(${image.alt})` : ''}</p>
        <img src="${image.localPath}" alt="${image.alt || `图片 ${index + 1}`}">
      </div>
      `;
    }).join('')}
    ` : ''}
    
    ${pageInfo.links && pageInfo.links.length > 0 ? `
    <div class="link-section">
      <h2>超链接</h2>
      ${pageInfo.links.map((link, index) => {
        return `
        <div class="link-item">
          ${index + 1}. <a href="${link.href}" target="_blank">${link.text}</a>
        </div>
        `;
      }).join('')}
    </div>
    ` : ''}
    
    ${pageInfo.codeBlocks && pageInfo.codeBlocks.length > 0 ? `
    <div class="code-section">
      <h2>代码块</h2>
      ${pageInfo.codeBlocks.map((codeBlock, index) => {
        return `
        <div>
          <p>代码块 ${index + 1} ${codeBlock.language ? `(${codeBlock.language})` : ''}</p>
          <div class="code-block">${codeBlock.content}</div>
        </div>
        `;
      }).join('')}
    </div>
    ` : ''}
    
    <div class="metadata">
      <p>文档生成时间: ${new Date().toLocaleString()}</p>
      <p>内容长度: ${pageInfo.contentLength} 字符</p>
      <p>标题数量: ${pageInfo.headings.length} 个</p>
      <p>图片数量: ${pageInfo.images.length} 张</p>
      <p>超链接数量: ${pageInfo.links.length} 个</p>
      <p>代码块数量: ${pageInfo.codeBlocks.length} 个</p>
    </div>
  </div>
</body>
</html>
    `;
    
    // 写入HTML文件
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    console.log(`HTML预览文件已生成: ${htmlPath}`);
    
    return htmlPath;
  }
}