const { crawlFeishuDoc } = require('./dist/crawler');

// 测试URL - 替换为实际的飞书文档URL
const testUrl = 'https://bytedance.larkoffice.com/docx/DQbddFg4QoJZq7x4qJucLkOdnWd';

console.log('开始测试滚动条状态检测功能...');
console.log(`测试URL: ${testUrl}`);

// 禁用缓存，确保使用最新代码
crawlFeishuDoc(testUrl, undefined, false)
  .then(() => {
    console.log('测试完成');
  })
  .catch((error) => {
    console.error('测试失败:', error);
  });
