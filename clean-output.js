/**
 * 清理输出目录脚本
 * 每次运行程序前执行，确保输出目录干净
 */

const fs = require('fs');
const path = require('path');

// 输出目录路径
const outputDir = path.join(__dirname, 'out');

console.log('开始清理输出目录...');

// 检查输出目录是否存在
if (fs.existsSync(outputDir)) {
  // 读取输出目录内容
  const files = fs.readdirSync(outputDir);
  
  // 删除目录中的所有文件和子目录
  files.forEach(file => {
    const filePath = path.join(outputDir, file);
    const stats = fs.statSync(filePath