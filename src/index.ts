/**
 * 项目入口文件
 * 负责解析命令行参数并执行爬取任务
 */

import { crawlFeishuDoc } from "./crawler";
import { CliParser } from "./utils/cli";
import { BrowserManager } from "./utils/browser-manager";
import { convertWebPageToPDF } from "./pdf-converter";
import * as path from "path";
import * as fs from "fs";

/**
 * 生成PDF输出路径
 */
function generatePDFOutputPath(url: string, customPath?: string): string {
  if (customPath) {
    return customPath;
  }

  const urlObj = new URL(url);
  const hostname = urlObj.hostname.replace(/\./g, "_");
  const pathname = urlObj.pathname.replace(/\//g, "_").substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
  
  const outputDir = path.join(process.cwd(), "out", "pdf");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  return path.join(outputDir, `${hostname}${pathname}_${timestamp}.pdf`);
}

/**
 * 主函数
 */
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  const options = CliParser.parse(args);

  // 显示帮助信息
  if (options.help) {
    CliParser.printHelp();
    return;
  }

  // 显示版本信息
  if (options.version) {
    CliParser.printVersion();
    return;
  }

  // 验证参数
  const validation = CliParser.validate(options);
  if (!validation.valid) {
    console.error(`错误: ${validation.error}`);
    console.log("使用 --help 查看帮助信息");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("飞书文档爬虫 - Feishu Shadow");
  console.log("=".repeat(60));

  try {
    if (options.pdf && options.url) {
      console.log("\n模式: 网页转PDF");
      const outputPath = generatePDFOutputPath(options.url, options.pdfOutput);
      
      const browserManager = new BrowserManager();
      
      try {
        console.log("启动浏览器...");
        await browserManager.launch(true);
        
        console.log(`访问页面: ${options.url}`);
        await browserManager.navigate(options.url);
        await browserManager.waitForPageReady();
        
        const page = browserManager.getPage();
        if (!page) {
          throw new Error("页面初始化失败");
        }
        
        const result = await convertWebPageToPDF(page, outputPath);
        
        console.log("\n=".repeat(60));
        console.log("PDF转换完成");
        console.log("=".repeat(60));
        console.log(`输出文件: ${result.outputPath}`);
        console.log(`截图数量: ${result.screenshotCount}`);
        console.log(`耗时: ${(result.duration / 1000).toFixed(2)}秒`);
        
      } finally {
        await browserManager.close();
      }
      return;
    }

    let urlsToProcess: string[] = [];

    // 处理单个URL
    if (options.url) {
      urlsToProcess = [options.url];
    }
    // 处理多个URL
    else if (options.urls) {
      urlsToProcess = options.urls;
    }

    if (urlsToProcess.length === 0) {
      console.log("没有找到需要处理的文档");
      return;
    }

    console.log(`\n开始处理 ${urlsToProcess.length} 个文档...`);
    console.log(`使用缓存: ${options.cache !== false}`);
    console.log(`重试次数: ${options.retry || 3}`);

    // 处理文档
    const results = [];
    for (const url of urlsToProcess) {
      console.log(`\n处理文档: ${url}`);
      try {
        const outputPath = await crawlFeishuDoc(url, undefined, options.cache !== false);
        results.push({ url, success: true, error: undefined, outputPath });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({ url, success: false, error: errorMsg, outputPath: undefined });
      }
    }

    // 统计结果
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log("\n=".repeat(60));
    console.log("处理完成");
    console.log("=".repeat(60));
    console.log(`总计: ${results.length} 个文档`);
    console.log(`成功: ${successful} 个`);
    console.log(`失败: ${failed} 个`);

    if (failed > 0) {
      console.log("\n失败的文档:");
      results
        .filter((r) => !r.success)
        .forEach((r, index) => {
          console.log(`  ${index + 1}. ${r.url}`);
          console.log(`     错误: ${r.error}`);
        });
    }

    if (successful > 0) {
      console.log("\n成功的文档:");
      results
        .filter((r) => r.success)
        .forEach((r, index) => {
          console.log(`  ${index + 1}. ${r.url}`);
          console.log(`     输出路径: ${r.outputPath}`);
        });
    }
  } catch (error) {
    console.error("执行失败:", error);
    process.exit(1);
  }
}

// 运行主函数
main().catch((error) => {
  console.error("程序异常退出:", error);
  process.exit(1);
});