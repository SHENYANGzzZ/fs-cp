/**
 * 飞书文档爬虫主入口
 */

import { FeishuCrawler } from './crawler/index.js';

/**
 * 导出爬虫类
 */
export { FeishuCrawler };

/**
 * 主函数
 */
async function main() {
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
    process.exit(0);
  } else {
    console.error('爬取失败！');
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
