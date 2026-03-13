/**
 * 文本后处理模块
 * 用于清洗OCR识别后的文本内容
 */

export class TextPostProcessor {
  private static readonly OCR_ERROR_FIXES: Record<string, string> = {
    'instaLL': 'install',
    'InstaLL': 'Install',
    'LocaLhost': 'localhost',
    'LocaL': 'Local',
    'autogenstudio': 'autogenstudio',
    'AutoGen': 'AutoGen',
    'autogen': 'autogen',
    'pip ': 'pip ',
    'conda ': 'conda ',
    'python': 'python',
    'Python': 'Python',
    'export ': 'export ',
    'ht tp': 'http',
    'htps': 'https',
    'APP S': 'Apps',
    'APP ': 'App ',
    'AP I': 'API',
    'APL': 'API',
    'AP Key': 'API Key',
    'AP_Key': 'API_KEY',
    'YOUR_AP_KEY': 'YOUR_API_KEY',
    'ARK_AP_KEY': 'ARK_API_KEY',
  };

  private static readonly NOISE_PATTERNS: RegExp[] = [
    /向\s*t[=＝]\s*AutoGen\s*篇[^\n]*三\s*$/gm,
    /向\s*t[=＝]\s*AutoGen[^\n]*(三|登录|注册).*$/gm,
    /AutoGen\s*(篇|局)[^\n]*(登录|注册|三).*$/gm,
    /登录\s*[\/\\]\s*注册/g,
    /^[A-Z]{3,}\s*\|.*$/gm,
    /^\|\s*[A-Z]+\s*\|.*$/gm,
    /^[-_=]{3,}$/gm,
    /^[═╬╬═]{3,}$/gm,
    /\s*[←→↑↓]\s*/g,
  ];

  private static readonly UI_ELEMENT_PATTERNS: RegExp[] = [
    /点击\s*$/gm,
    /^点\s*击\s*$/gm,
    /^[○●○@©®™]+\s*$/gm,
    /^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*$/gm,
    /^os\s*ro\s*@.*$/gm,
    /^\|\s*一\s*CR\s*$/gm,
    /^v\s*\d+[.,、．]\s*$/gm,
    /^w\s*代码块\s*$/gm,
    /^有\s*代码块\s*$/gm,
    /^六\s*代码块\s*$/gm,
    /^代码块\s*Plain\s*Text\s*$/gm,
    /^Plain\s*Text\s*$/gm,
  ];

  cleanChineseSpaces(text: string): string {
    let result = text;
    
    result = result.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
    
    result = result.replace(/([\u4e00-\u9fa5])\s+([，。！？、；：""''（）【】])/g, '$1$2');
    
    result = result.replace(/([，。！？、；：""''（）【】])\s+([\u4e00-\u9fa5])/g, '$1$2');
    
    result = result.replace(/([\u4e00-\u9fa5])\s+([a-zA-Z0-9])/g, '$1$2');
    
    result = result.replace(/([a-zA-Z0-9])\s+([\u4e00-\u9fa5])/g, '$1$2');
    
    return result;
  }

  fixOcrErrors(text: string): string {
    let result = text;
    
    Object.entries(TextPostProcessor.OCR_ERROR_FIXES).forEach(([wrong, right]) => {
      const regex = new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      result = result.replace(regex, right);
    });
    
    result = result.replace(/(\d)\s+(\d)/g, '$1$2');
    
    result = result.replace(/([a-zA-Z])\s+([a-zA-Z])/g, (match, p1, p2) => {
      if (match.length === 3) {
        return p1 + p2;
      }
      return match;
    });
    
    return result;
  }

  filterNoise(text: string): string {
    let result = text;
    
    TextPostProcessor.NOISE_PATTERNS.forEach(pattern => {
      result = result.replace(pattern, '');
    });
    
    TextPostProcessor.UI_ELEMENT_PATTERNS.forEach(pattern => {
      result = result.replace(pattern, '');
    });
    
    return result;
  }

  mergeBrokenParagraphs(text: string): string {
    const lines = text.split('\n');
    const mergedLines: string[] = [];
    let currentParagraph = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        if (currentParagraph) {
          mergedLines.push(currentParagraph);
          currentParagraph = '';
        }
        mergedLines.push('');
        continue;
      }
      
      const isCodeLine = /^(conda|pip|export|autogenstudio|http|python|npm|git|\$|\(|\[)/i.test(line);
      const isListLine = /^[\d①②③④⑤⑥⑦⑧⑨⑩]+[.、．)\]]\s/.test(line) || /^[*•\-]\s/.test(line);
      const isHeading = /^[一二三四五六七八九十]+[、,.]/.test(line) || /^第[一二三四五六七八九十\d]+[步章节]/.test(line);
      
      if (isCodeLine || isListLine || isHeading) {
        if (currentParagraph) {
          mergedLines.push(currentParagraph);
          currentParagraph = '';
        }
        mergedLines.push(line);
      } else if (line.endsWith('，') || line.endsWith('、') || line.endsWith('：')) {
        currentParagraph += line;
      } else if (currentParagraph && !currentParagraph.match(/[。！？.!?]$/)) {
        currentParagraph += line;
      } else {
        if (currentParagraph) {
          mergedLines.push(currentParagraph);
        }
        currentParagraph = line;
      }
    }
    
    if (currentParagraph) {
      mergedLines.push(currentParagraph);
    }
    
    return mergedLines.join('\n');
  }

  cleanUrls(text: string): string {
    let result = text;
    
    result = result.replace(/https?:\/\/[^\s\n]+/g, (url) => {
      return url
        .replace(/\s+/g, '')
        .replace(/[^\x00-\x7F]/g, '');
    });
    
    result = result.replace(/(https?:\/\/[^\s\n]+)\s*\n\s*([^\s\n]+)/g, (match, url, rest) => {
      if (rest.match(/^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/)) {
        return url + rest;
      }
      return match;
    });
    
    return result;
  }

  process(text: string): string {
    console.log("开始文本后处理...");
    
    let result = text;
    
    console.log("1. 过滤噪音...");
    result = this.filterNoise(result);
    
    console.log("2. 修复OCR错误...");
    result = this.fixOcrErrors(result);
    
    console.log("3. 清理中文字符空格...");
    result = this.cleanChineseSpaces(result);
    
    console.log("4. 清理URL...");
    result = this.cleanUrls(result);
    
    console.log("5. 合并段落...");
    result = this.mergeBrokenParagraphs(result);
    
    result = result
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    
    console.log("文本后处理完成");
    
    return result;
  }
}
