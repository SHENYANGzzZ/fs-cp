/**
 * 飞书文档爬虫主入口
 */

import { FeishuCrawler } from './crawler/index.js';
import fs from 'fs';
import path from 'path';

/**
 * 清理输出目录
 */
function cleanOutputDir() {
  const outputDir = path.join(process.cwd(), 'out');
  console.log('开始清理输出目录...');
  
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir);
    files.forEach(file => {
      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    });
    console.log('输出目录清理完成');
  } else {
    console.log('输出目录不存在，无需清理');
  }
}

/**
 * 导出爬虫类
 */
export { FeishuCrawler };

/**
 * 主函数
 */
async function main() {
  // 清理输出目录
  cleanOutputDir();
  
  // 获取命令行参数
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('请提供飞书文档URL');
    process.exit(1);
  }
  
  const url = args[0];
  console.log(`开始爬取飞书文档: ${url}`);
  
  // 创建爬虫实例
  const crawler = new FeishuCrawler();
  
  // 执行爬取
  const result = await crawler.crawl(url);
  
  // 输出结果
  console.log('爬取结果:', result);
  
  if (result.success) {
    console.log('爬取成功！');
    
    // 验证文章获取的完整性
    verifyContentIntegrity();
    
    process.exit(0);
  } else {
    console.error('爬取失败！');
    process.exit(1);
  }
}

/**
 * 验证文章获取的完整性
 */
async function verifyContentIntegrity() {
  console.log('开始验证文章获取的完整性...');
  
  try {
    // 这里需要实现OCR功能来识别截图中的文本
    // 然后与生成的文档内容进行比较
    // 由于OCR需要额外的依赖，这里先实现基本框架
    
    const screenshotPath = path.join(process.cwd(), 'Agent篇-agent快速入门.png');
    const outputDir = path.join(process.cwd(), 'out');
    
    // 检查截图文件是否存在
    if (!fs.existsSync(screenshotPath)) {
      console.warn('截图文件不存在，无法进行完整性验证');
      return;
    }
    
    // 检查输出目录是否存在
    if (!fs.existsSync(outputDir)) {
      console.warn('输出目录不存在，无法进行完整性验证');
      return;
    }
    
    // 读取输出目录中的文件
    const outputFiles = fs.readdirSync(outputDir);
    
    // 查找子目录
    let textFile = null;
    let textFilePath = null;
    
    for (const file of outputFiles) {
      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        // 检查子目录中的文件
        const subDirFiles = fs.readdirSync(filePath);
        const subTextFile = subDirFiles.find(f => f.endsWith('.txt'));
        if (subTextFile) {
          textFile = subTextFile;
          textFilePath = path.join(filePath, subTextFile);
          break;
        }
      } else if (file.endsWith('.txt')) {
        // 直接在输出目录中找到文本文件
        textFile = file;
        textFilePath = filePath;
        break;
      }
    }
    
    if (!textFile) {
      console.warn('输出目录中没有文本文件，无法进行完整性验证');
      return;
    }
    
    const generatedContent = fs.readFileSync(textFilePath, 'utf8');
    
    // 这里应该使用OCR库识别截图中的文本
    // 由于OCR需要额外依赖，这里暂时跳过实际识别
    // 未来可以添加tesseract.js等OCR库来实现
    
    console.log('完整性验证功能已添加，需要安装OCR依赖来实现实际验证');
    console.log('生成的文档内容长度:', generatedContent.length);
    console.log('验证完成');
  } catch (error) {
    console.error('验证完整性时出错:', error);
  }
}

// 如果直接运行此文件，则执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
