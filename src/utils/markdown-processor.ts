/**
 * Markdown处理模块
 * 负责Markdown内容的生成和文件保存
 */

import fs from 'fs';
import path from 'path';
import { fileConfig } from '../config';
import { PageInfo } from './content-extractor';

/**
 * Markdown处理器类
 */
export class MarkdownProcessor {
  /**
   * 生成Markdown内容
   * @param pageInfo 页面信息
   */
  generateMarkdown(pageInfo: PageInfo): string {
    console.log('生成Markdown格式内容...');
    
    let mdContent = `# ${pageInfo.title}\n\n`;
    
    // 处理文本内容，转换为Markdown格式
    mdContent += pageInfo.textContent
      .replace(/\n+/g, '\n\n')
      .replace(/•/g, '-')
      .replace(/◦/g, '  -');
    
    // 暂时注释掉图片处理
    // if (pageInfo.images && pageInfo.images.length > 0) {
    //   mdContent += '\n\n## 图片\n\n';
    //   pageInfo.images.forEach((image, index) => {
    //     mdContent += `![${image.alt || `图片 ${index + 1}`}](${image.localPath})\n\n`;
    //   });
    // }
    
    return mdContent;
  }

  /**
   * 保存Markdown文件
   * @param pageInfo 页面信息
   * @param mdContent Markdown内容
   */
  saveMarkdown(pageInfo: PageInfo, mdContent: string): string {
    // 生成安全的标题
    const safeTitle = this.generateSafeTitle(pageInfo.title);
    
    // 生成输出路径
    const outputDir = this.getOutputDir(safeTitle);
    const mdPath = path.join(outputDir, `${safeTitle}.md`);
    
    // 创建输出目录
    this.createOutputDir(outputDir);
    
    // 写入文件
    fs.writeFileSync(mdPath, mdContent);
    console.log(`Markdown文件已生成: ${mdPath}`);
    
    return mdPath;
  }

  /**
   * 生成安全的标题
   * @param title 原始标题
   */
  private generateSafeTitle(title: string): string {
    return title.replace(fileConfig.safeTitleRegex, fileConfig.safeTitleReplace);
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
   * 打印内容信息
   * @param pageInfo 页面信息
   * @param mdContent Markdown内容
   */
  printContentInfo(pageInfo: PageInfo, mdContent: string): void {
    console.log(`\n=== 文档内容 ===`);
    console.log(`标题: ${pageInfo.title}`);
    console.log(`找到的标题: ${JSON.stringify(pageInfo.headings, null, 2)}`);
    console.log(`内容长度: ${pageInfo.contentLength} 字符`);
    console.log(`元素数量: ${pageInfo.elementCount} 个`);
    console.log(`标题数量: ${pageInfo.headings.length} 个`);
    console.log(`图片数量: ${pageInfo.images ? pageInfo.images.length : 0} 张`);
    console.log(`\n内容:`);
    console.log(mdContent);
    console.log(`\n=== 内容获取完成 ===`);
  }
}
