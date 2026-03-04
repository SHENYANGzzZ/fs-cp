import { crawlFeishuDoc } from "./crawler";

// 获取命令行参数
const args = process.argv.slice(2);
const url = args[0];
const useCache = !args.includes("--no-cache");

if (!url) {
  console.error("请提供飞书文档URL");
  process.exit(1);
}

console.log(`使用用户提供的网址: ${url}`);
console.log(`是否使用缓存: ${useCache}`);
crawlFeishuDoc(url, undefined, useCache);
