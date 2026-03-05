import fs from 'fs';
import path from 'path';

function deleteDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        deleteDirectory(filePath);
      } else {
        fs.unlinkSync(filePath);
        console.log(`删除文件: ${filePath}`);
      }
    });
    fs.rmdirSync(dirPath);
    console.log(`删除目录: ${dirPath}`);
  }
}

// 清空out目录
const outDir = path.join(path.dirname(import.meta.url).replace('file://', ''), 'out');
deleteDirectory(outDir);

// 重新创建out目录
fs.mkdirSync(outDir, { recursive: true });
console.log('输出目录已清空并重新创建');
