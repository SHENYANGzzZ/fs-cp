/**
 * 文件处理模块
 * 负责文件的生成和保存
 */

import fs from 'fs';
import path from 'path';
import { fileConfig } from '../config/index.js';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel } from 'docx';

/**
 * 文件处理类
 */
export class FileProcessor {
  /**
   * 确保输出目录存在
   * @param {string} outputDir 输出目录
   */
  static ensureOutputDir(outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`创建输出目录: ${outputDir}`);
    }
  }

  /**
   * 生成安全的文件名
   * @param {string} title 标题
   * @returns {string} 安全的文件名
   */
  static generateSafeFileName(title) {
    // 移除或替换不安全的字符
    const safeTitle = title
      .replace(/[<>"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 限制文件名长度
    const maxLength = 255;
    if (safeTitle.length > maxLength) {
      return safeTitle.substring(0, maxLength) + '_';
    }
    
    return safeTitle;
  }

  /**
   * 保存文本文件
   * @param {string} content 内容
   * @param {string} fileName 文件名
   * @param {string} outputDir 输出目录
   * @returns {string} 文件路径
   */
  static saveTextFile(content, fileName, outputDir) {
    this.ensureOutputDir(outputDir);
    const filePath = path.join(outputDir, `${fileName}.txt`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`文本文件已保存: ${filePath}`);
    return filePath;
  }

  /**
   * 保存Markdown文件
   * @param {string} content 内容
   * @param {string} fileName 文件名
   * @param {string} outputDir 输出目录
   * @returns {string} 文件路径
   */
  static saveMarkdownFile(content, fileName, outputDir) {
    this.ensureOutputDir(outputDir);
    const filePath = path.join(outputDir, `${fileName}.md`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Markdown文件已保存: ${filePath}`);
    return filePath;
  }

  /**
   * 保存Word文档
   * @param {string} content 内容
   * @param {string} fileName 文件名
   * @param {string} outputDir 输出目录
   * @returns {Promise<string>} 文件路径
   */
  static async saveWordFile(content, fileName, outputDir) {
    this.ensureOutputDir(outputDir);
    const filePath = path.join(outputDir, `${fileName}.docx`);

    try {
      // 创建Word文档
      const doc = new Document({
        sections: [{
          properties: {},
          children: this.parseContentToWordElements(content)
        }]
      });

      // 打包并保存文档
      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filePath, buffer);
      console.log(`Word文档已保存: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('保存Word文档失败:', error);
      return null;
    }
  }

  /**
   * 将内容解析为Word元素
   * @param {string} content 内容
   * @returns {Array} Word元素数组
   */
  static parseContentToWordElements(content) {
    const elements = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      if (!line) {
        // 添加空行
        elements.push(new Paragraph({}));
        continue;
      }

      // 处理标题
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^# +/, '');
        
        // 根据标题级别设置不同的样式
        let headingStyle = {};
        switch (level) {
          case 1:
            headingStyle = {
              text,
              heading: HeadingLevel.HEADING_1,
              children: [
                new TextRun({
                  text,
                  bold: true,
                  size: 32,
                  font: 'Microsoft YaHei'
                })
              ],
              spacing: {
                after: 300
              }
            };
            break;
          case 2:
            headingStyle = {
              text,
              heading: HeadingLevel.HEADING_2,
              children: [
                new TextRun({
                  text,
                  bold: true,
                  size: 28,
                  font: 'Microsoft YaHei'
                })
              ],
              spacing: {
                after: 200
              }
            };
            break;
          case 3:
            headingStyle = {
              text,
              heading: HeadingLevel.HEADING_3,
              children: [
                new TextRun({
                  text,
                  bold: true,
                  size: 24,
                  font: 'Microsoft YaHei'
                })
              ],
              spacing: {
                after: 150
              }
            };
            break;
          default:
            headingStyle = {
              text,
              heading: HeadingLevel[`HEADING_${level}`] || HeadingLevel.HEADING_4,
              children: [
                new TextRun({
                  text,
                  bold: true,
                  size: 20,
                  font: 'Microsoft YaHei'
                })
              ],
              spacing: {
                after: 100
              }
            };
        }
        
        elements.push(new Paragraph(headingStyle));
        continue;
      }

      // 处理列表项
      if (line.startsWith('• ')) {
        elements.push(new Paragraph({
          text: line.replace('• ', ''),
          bullet: {
            level: 0
          },
          children: [
            new TextRun({
              text: line.replace('• ', ''),
              font: 'Microsoft YaHei',
              size: 20
            })
          ],
          spacing: {
            before: 50,
            after: 50
          },
          indent: {
            left: 400,
            hanging: 200
          }
        }));
        continue;
      }

      // 处理表格
      if (line.startsWith('|')) {
        const tableRows = [];
        let j = i;
        
        // 收集表格行
        while (j < lines.length && lines[j].trim().startsWith('|')) {
          const cells = lines[j].trim().replace(/^\|\s*|\s*\|$/g, '').split(/\s*\|\s*/);
          tableRows.push(new TableRow({
            children: cells.map(cell => new TableCell({
              children: [new Paragraph({
                text: cell,
                children: [
                  new TextRun({
                    text: cell,
                    font: 'Microsoft YaHei',
                    size: 18
                  })
                ],
                alignment: 'center'
              })]
            }))
          }));
          j++;
        }

        // 创建表格
        elements.push(new Table({
          rows: tableRows,
          properties: {
            border: {
              top: {
                color: 'auto',
                space: 1,
                size: 2
              },
              bottom: {
                color: 'auto',
                space: 1,
                size: 2
              },
              left: {
                color: 'auto',
                space: 1,
                size: 2
              },
              right: {
                color: 'auto',
                space: 1,
                size: 2
              },
              insideHorizontal: {
                color: 'auto',
                space: 1,
                size: 2
              },
              insideVertical: {
                color: 'auto',
                space: 1,
                size: 2
              }
            }
          }
        }));
        
        // 跳过已处理的表格行
        i = j - 1;
        continue;
      }

      // 处理引用
      if (line.startsWith('> ')) {
        elements.push(new Paragraph({
          text: line.replace('> ', ''),
          children: [
            new TextRun({
              text: line.replace('> ', ''),
              font: 'Microsoft YaHei',
              size: 20,
              italic: true
            })
          ],
          indent: {
            left: 400
          },
          spacing: {
            before: 50,
            after: 50
          }
        }));
        continue;
      }

      // 处理代码块
      if (line === '```') {
        let codeContent = '';
        let j = i + 1;
        
        while (j < lines.length && lines[j].trim() !== '```') {
          codeContent += lines[j] + '\n';
          j++;
        }

        elements.push(new Paragraph({
          children: [
            new TextRun({
              text: codeContent,
              font: 'Courier New',
              size: 18,
              color: '#333333'
            })
          ],
          indent: {
            left: 400
          },
          spacing: {
            before: 100,
            after: 100
          },
          shading: {
            fill: '#f5f5f5'
          }
        }));
        
        // 跳过已处理的代码块
        i = j;
        continue;
      }

      // 处理普通文本
      elements.push(new Paragraph({
        text: line,
        children: [
          new TextRun({
            text: line,
            font: 'Microsoft YaHei',
            size: 20
          })
        ],
        spacing: {
          before: 50,
          after: 50
        },
        alignment: 'left'
      }));
    }

    return elements;
  }

  /**
   * 保存JSON文件
   * @param {Object} data 数据
   * @param {string} fileName 文件名
   * @param {string} outputDir 输出目录
   * @returns {string} 文件路径
   */
  static saveJsonFile(data, fileName, outputDir) {
    this.ensureOutputDir(outputDir);
    const filePath = path.join(outputDir, `${fileName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`JSON文件已保存: ${filePath}`);
    return filePath;
  }

  /**
   * 读取文件
   * @param {string} filePath 文件路径
   * @returns {string} 文件内容
   */
  static readFile(filePath) {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return '';
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath 文件路径
   * @returns {boolean} 是否存在
   */
  static fileExists(filePath) {
    return fs.existsSync(filePath);
  }

  /**
   * 获取文件大小
   * @param {string} filePath 文件路径
   * @returns {number} 文件大小（字节）
   */
  static getFileSize(filePath) {
    if (fs.existsSync(filePath)) {
      return fs.statSync(filePath).size;
    }
    return 0;
  }

  /**
   * 清理输出目录
   * @param {string} outputDir 输出目录
   */
  static cleanOutputDir(outputDir) {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
      console.log(`清理输出目录: ${outputDir}`);
    }
  }
}
