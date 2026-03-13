/**
 * 格式化 Word 文档生成脚本
 * 用于清理 OCR 内容并生成格式化的文档
 */

const { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
  BorderStyle,
  LevelFormat,
  ExternalHyperlink,
} = require("docx");
const fs = require("fs");
const path = require("path");

const INPUT_FILE = process.argv[2] || "./out/AutoGen篇_AutoGen快速入门/extracted_content.txt";
const OUTPUT_DIR = path.dirname(INPUT_FILE);

function cleanOcrText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/([a-zA-Z0-9])\s+([a-zA-Z0-9])/g, "$1$2")
    .replace(/([a-zA-Z])\s+([a-zA-Z])/g, "$1$2")
    .replace(/([0-9])\s+([0-9])/g, "$1$2")
    .replace(/\s+([.,;:!?，。；：！？、])/g, "$1")
    .replace(/([.,;:!?，。；：！？、])\s+/g, "$1 ")
    .replace(/\s*([()（）\[\]【】{}《》<>])\s*/g, "$1")
    .trim();
}

function isTitle(line, index) {
  if (index < 5 && line.includes("AutoGen")) return true;
  if (/^[一二三四五六七八九十]+[、,.]/.test(line)) return true;
  if (/^v?\s*\d+[.,、]\s*.{2,20}$/.test(line)) return true;
  if (/环境准备|模型登记|配置大脑/.test(line)) return true;
  return false;
}

function isSubTitle(line) {
  if (/^第[一二三四五六七八九十\d]+步/.test(line)) return true;
  if (/^\d+[.,、]\s*.{2,25}$/.test(line)) return true;
  return false;
}

function isCodeBlock(line) {
  if (/^(conda|pip|export|autogenstudio|http|python|npm|git)/i.test(line)) return true;
  if (/代码块|Plain Text/.test(line)) return true;
  return false;
}

function isUrl(line) {
  return /^https?:\/\//.test(line);
}

function isListItem(line) {
  if (/^[*•\-]\s/.test(line)) return true;
  if (/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(line)) return true;
  if (/^\d+[.、]\s/.test(line)) return true;
  return false;
}

function isNoise(line) {
  if (/^(向|有|忌|了|A|v|w|六|五|三|KL|PS|INFO|Uvicorn|AppLication|Started|Waiting)/.test(line)) return true;
  if (/登录.*注册/.test(line)) return true;
  if (/AutoGen 篇.*三$/.test(line)) return true;
  if (/^[a-zA-Z0-9\s\.\-\_]+$/.test(line) && line.length < 5) return true;
  if (/^\|/.test(line)) return true;
  if (/^[A-Z]{2,}/.test(line)) return true;
  return false;
}

function processContent(rawText) {
  const lines = rawText.split("\n");
  const elements = [];
  let inCodeBlock = false;
  let codeContent = [];
  let lastType = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      if (inCodeBlock && codeContent.length > 0) {
        elements.push({ type: "code", content: codeContent.join("\n") });
        codeContent = [];
        inCodeBlock = false;
      }
      continue;
    }

    const line = cleanOcrText(rawLine);
    if (!line || line.length < 2) continue;

    if (isNoise(rawLine)) continue;

    if (rawLine.includes("代码块") || rawLine === "Plain Text") {
      inCodeBlock = true;
      continue;
    }

    if (inCodeBlock) {
      if (isCodeBlock(rawLine)) {
        codeContent.push(line);
        continue;
      } else if (!/^[a-zA-Z0-9\s\.\-\_\/\\:]+$/.test(rawLine)) {
        if (codeContent.length > 0) {
          elements.push({ type: "code", content: codeContent.join("\n") });
          codeContent = [];
        }
        inCodeBlock = false;
      } else {
        codeContent.push(line);
        continue;
      }
    }

    if (isUrl(line)) {
      elements.push({ type: "url", content: line });
    } else if (isTitle(line, i)) {
      elements.push({ type: "title", content: line });
    } else if (isSubTitle(line)) {
      elements.push({ type: "subtitle", content: line });
    } else if (isListItem(line)) {
      elements.push({ type: "list", content: line.replace(/^[*•\-①②③④⑤⑥⑦⑧⑨⑩\d.、]+\s*/, "") });
    } else {
      elements.push({ type: "paragraph", content: line });
    }
  }

  if (codeContent.length > 0) {
    elements.push({ type: "code", content: codeContent.join("\n") });
  }

  return elements;
}

function createDocument(elements) {
  const children = [];
  let listCounter = 0;

  for (const el of elements) {
    switch (el.type) {
      case "title":
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: el.content, bold: true, size: 36 })],
        }));
        break;

      case "subtitle":
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          children: [new TextRun({ text: el.content, bold: true, size: 28 })],
        }));
        break;

      case "code":
        children.push(new Paragraph({
          spacing: { before: 150, after: 150 },
          shading: { fill: "f5f5f5" },
          border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: "cccccc" },
          },
          indent: { left: 400 },
          children: [new TextRun({ text: el.content, font: "Consolas", size: 20 })],
        }));
        break;

      case "url":
        children.push(new Paragraph({
          spacing: { after: 80 },
          children: [
            new ExternalHyperlink({
              children: [new TextRun({ text: el.content, color: "0563c1", underline: {} })],
              link: el.content,
            }),
          ],
        }));
        break;

      case "list":
        children.push(new Paragraph({
          spacing: { after: 80, line: 360 },
          indent: { left: 720 },
          children: [new TextRun({ text: "• " + el.content })],
        }));
        break;

      default:
        children.push(new Paragraph({
          spacing: { after: 120, line: 360 },
          children: [new TextRun({ text: el.content })],
        }));
    }
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: "Microsoft YaHei", size: 24 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
}

async function main() {
  console.log("读取内容文件:", INPUT_FILE);
  const rawText = fs.readFileSync(INPUT_FILE, "utf-8");
  
  console.log("处理内容...");
  const elements = processContent(rawText);
  console.log(`提取到 ${elements.length} 个元素`);

  console.log("生成 Word 文档...");
  const doc = createDocument(elements);
  const buffer = await Packer.toBuffer(doc);
  
  const outputPath = path.join(OUTPUT_DIR, "AutoGen快速入门_格式化.docx");
  fs.writeFileSync(outputPath, buffer);
  console.log("文档已生成:", outputPath);
}

main().catch(console.error);
