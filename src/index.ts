import { crawlFeishuDoc } from "./crawler";

// 硬编码测试URL
const url = "https://jcny2we8lxya.feishu.cn/wiki/Wb99wXcBYiVMyzkg9WrcftSlntd";
const useCache = false; // 暂时禁用缓存，确保修改的代码生效

console.log(`使用测试网址: ${url}`);
console.log(`是否使用缓存: ${useCache}`);
crawlFeishuDoc(url, undefined, useCache);
