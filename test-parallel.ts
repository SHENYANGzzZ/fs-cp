import { crawlMultipleFeishuDocs } from './src/crawler';

// 测试并行处理功能
async function testParallelProcessing() {
  console.log('测试并行处理功能...');
  
  // 使用相同的URL多次测试（实际使用时应该使用不同的URL）
  const urls = [
    'https://jcny2we8lxya.feishu.cn/wiki/QBZ7wUMVwiR0NRkIGGbcTFd9nMg',
    'https://jcny2we8lxya.feishu.cn/wiki/QBZ7wUMVwiR0NRkIGGbcTFd9nMg',
    'https://jcny2we8lxya.feishu.cn/wiki/QBZ7wUMVwiR0NRkIGGbcTFd9nMg'
  ];
  
  try {
    await crawlMultipleFeishuDocs(urls);
    console.log('并行处理测试完成');
  } catch (error) {
    console.error('并行处理测试失败:', error);
  }
}

testParallelProcessing();
