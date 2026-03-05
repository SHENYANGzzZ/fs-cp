import { crawlFeishuDoc } from "./crawler";
import { CliParser } from "./utils/cli";
import { SpaceCrawler } from "./utils/space-crawler";
import { RetryHandler } from "./utils/retry-handler";

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

  // 验证参数
  const validation = CliParser.validate(options);
  if (!validation.valid) {
    console.error(`错误: ${validation.error}`);
    console.log('使用 --help 查看帮助信息');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('飞书文档爬虫 - Feishu Shadow');
  console.log('='.repeat(60));

  try {
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
        '提取文档列表'
      );

      console.log(`\n找到 ${documents.length} 个文档`);
      urlsToProcess = documents.map(doc => doc.url);

      // 保存文档列表
      const fs = require('fs');
      const path = require('path');
      const listPath = path.join(process.cwd(), 'out', 'document-list.json');
      const dir = path.dirname(listPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(listPath, JSON.stringify(documents, null, 2), 'utf8');
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

    if (urlsToProcess.length === 0) {
      console.log('没有找到需要处理的文档');
      return;
    }

    console.log(`\n开始处理 ${urlsToProcess.length} 个文档...`);
    console.log(`并行数: ${options.parallel}`);
    console.log(`使用缓存: ${options.cache}`);
    console.log(`重试次数: ${options.retry}`);

    // 批量处理文档
    const results = await processBatch(
      urlsToProcess,
      options.cache!,
      options.parallel!,
      retryHandler
    );

    // 统计结果
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('\n='.repeat(60));
    console.log('处理完成');
    console.log('='.repeat(60));
    console.log(`总计: ${results.length} 个文档`);
    console.log(`成功: ${successful} 个`);
    console.log(`失败: ${failed} 个`);

    if (failed > 0) {
      console.log('\n失败的文档:');
      results
        .filter(r => !r.success)
        .forEach((r, index) => {
          console.log(`  ${index + 1}. ${r.url}`);
          console.log(`     错误: ${r.error}`);
        });
    }

  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  }
}

/**
 * 批量处理文档
 */
async function processBatch(
  urls: string[],
  useCache: boolean,
  parallel: number,
  retryHandler: RetryHandler
): Promise<Array<{ url: string; success: boolean; error?: string }>> {
  const results: Array<{ url: string; success: boolean; error?: string }> = [];

  // 分批处理
  for (let i = 0; i < urls.length; i += parallel) {
    const batch = urls.slice(i, i + parallel);
    console.log(`\n处理批次 ${Math.floor(i / parallel) + 1}/${Math.ceil(urls.length / parallel)}`);

    const batchPromises = batch.map(async (url, index) => {
      const docNumber = i + index + 1;
      console.log(`\n[${docNumber}/${urls.length}] 开始处理: ${url}`);

      try {
        await retryHandler.execute(
          () => crawlFeishuDoc(url, undefined, useCache),
          `文档 ${docNumber}`
        );
        console.log(`[${docNumber}/${urls.length}] ✓ 处理成功`);
        return { url, success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[${docNumber}/${urls.length}] ✗ 处理失败: ${errorMsg}`);
        return { url, success: false, error: errorMsg };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // 批次之间添加延迟
    if (i + parallel < urls.length) {
      console.log('\n等待 3 秒后处理下一批次...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  return results;
}

// 运行主函数
main().catch(error => {
  console.error('程序异常退出:', error);
  process.exit(1);
});
