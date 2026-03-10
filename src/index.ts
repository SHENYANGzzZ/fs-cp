import { crawlFeishuDoc } from "./crawler";
import { CliParser } from "./utils/cli";
import { SpaceCrawler } from "./utils/space-crawler";
import { RetryHandler } from "./utils/retry-handler";
import { createAgent, TaskStatus } from "./agent";

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
    // 创建智能体
    const agent = createAgent({
      maxRetries: options.retry || 3,
      parallelLimit: options.parallel || 3,
      useCache: options.cache !== false,
      verbose: true,
    });

    // 创建重试处理器
    const retryHandler = new RetryHandler({
      maxRetries: options.retry || 3,
      delay: 2000,
      backoff: true,
    });

    let urlsToProcess: string[] = [];

    // 处理知识库空间
    if (options.space) {
      console.log(`\n正在提取知识库空间的所有文档...`);
      console.log(`空间URL: ${options.space}`);

      const spaceCrawler = new SpaceCrawler();
      const documents = await retryHandler.execute(
        () => spaceCrawler.extractDocuments(options.space!),
        "提取文档列表"
      );

      console.log(`\n找到 ${documents.length} 个文档`);
      urlsToProcess = documents.map((doc) => doc.url);

      // 保存文档列表
      const fs = require("fs");
      const path = require("path");
      const listPath = path.join(process.cwd(), "out", "document-list.json");
      const dir = path.dirname(listPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(listPath, JSON.stringify(documents, null, 2), "utf8");
      console.log(`文档列表已保存到: ${listPath}`);
    }
    // 处理多个URL
    else if (options.urls) {
      urlsToProcess = options.urls;
    }
    // 处理单个URL
    else if (options.url) {
      urlsToProcess = [options.url];
    }

    // 智能分析URL
    if (urlsToProcess.length > 0) {
      console.log(`\n智能分析URL...`);
      for (const url of urlsToProcess) {
        const analysis = await agent.analyzeUrl(url);
        console.log(`- ${url}`);
        console.log(`  有效: ${analysis.isValid}`);
        console.log(`  飞书文档: ${analysis.isFeishuDoc}`);
        console.log(`  缓存状态: ${analysis.cacheStatus}`);
      }
    }

    if (urlsToProcess.length === 0) {
      console.log("没有找到需要处理的文档");
      return;
    }

    console.log(`\n开始处理 ${urlsToProcess.length} 个文档...`);
    console.log(`并行数: ${options.parallel}`);
    console.log(`使用缓存: ${options.cache}`);
    console.log(`重试次数: ${options.retry}`);

    // 使用智能体批量处理文档
    console.log(`\n使用智能体处理 ${urlsToProcess.length} 个文档...`);

    // 添加任务到智能体
    const taskIds = urlsToProcess.map((url) => agent.addTask(url));

    // 执行任务
    const results = await agent.executeTasks(taskIds);

    // 转换结果格式
    const processedResults = results.map((task) => ({
      url: task.url,
      success: task.status === TaskStatus.SUCCESS,
      error: task.error,
    }));

    // 统计结果
    const successful = processedResults.filter((r) => r.success).length;
    const failed = processedResults.filter((r) => !r.success).length;

    console.log("\n=".repeat(60));
    console.log("处理完成");
    console.log("=".repeat(60));
    console.log(`总计: ${results.length} 个文档`);
    console.log(`成功: ${successful} 个`);
    console.log(`失败: ${failed} 个`);

    if (failed > 0) {
      console.log("\n失败的文档:");
      processedResults
        .filter((r) => !r.success)
        .forEach((r, index) => {
          console.log(`  ${index + 1}. ${r.url}`);
          console.log(`     错误: ${r.error}`);
        });
    }

    // 显示任务统计信息
    const taskStats = agent.getTaskStats();
    console.log("\n任务统计:");
    console.log(`  总任务数: ${taskStats.total}`);
    console.log(`  成功: ${taskStats.success}`);
    console.log(`  失败: ${taskStats.failed}`);
    console.log(`  待处理: ${taskStats.pending}`);
    console.log(`  处理中: ${taskStats.running}`);

    // 显示缓存统计信息
    const cacheStats = await agent.getCacheStats();
    console.log("\n缓存统计:");
    console.log(`  缓存总数: ${cacheStats.total}`);
    console.log(`  有效缓存: ${cacheStats.total - cacheStats.expired}`);
    console.log(`  过期缓存: ${cacheStats.expired}`);

    // 清理过期缓存
    console.log("\n清理过期缓存...");
    await agent.cleanExpiredCache();
    console.log("过期缓存清理完成");
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
