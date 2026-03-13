/**
 * 命令行解析模块
 * 负责解析命令行参数
 */

/**
 * 命令行选项接口
 */
export interface CliOptions {
  url?: string;
  urls?: string[];
  space?: string;
  parallel?: number;
  retry?: number;
  cache?: boolean;
  help?: boolean;
  version?: boolean;
  pdf?: boolean;
  pdfOutput?: string;
}

/**
 * 命令行解析器类
 */
export class CliParser {
  /**
   * 解析命令行参数
   * @param args 命令行参数
   */
  static parse(args: string[]): CliOptions {
    const options: CliOptions = {};
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case "--url":
          if (i + 1 < args.length) {
            options.url = args[i + 1];
            i++;
          }
          break;
        case "--urls":
          if (i + 1 < args.length) {
            options.urls = args[i + 1].split(",");
            i++;
          }
          break;
        case "--space":
          if (i + 1 < args.length) {
            options.space = args[i + 1];
            i++;
          }
          break;
        case "--parallel":
          if (i + 1 < args.length) {
            options.parallel = parseInt(args[i + 1]);
            i++;
          }
          break;
        case "--retry":
          if (i + 1 < args.length) {
            options.retry = parseInt(args[i + 1]);
            i++;
          }
          break;
        case "--no-cache":
          options.cache = false;
          break;
        case "--help":
        case "-h":
          options.help = true;
          break;
        case "--version":
        case "-v":
          options.version = true;
          break;
        case "--pdf":
          options.pdf = true;
          break;
        case "--pdf-output":
          if (i + 1 < args.length) {
            options.pdfOutput = args[i + 1];
            i++;
          }
          break;
      }
    }
    
    return options;
  }

  /**
   * 验证命令行选项
   * @param options 命令行选项
   */
  static validate(options: CliOptions): { valid: boolean; error?: string } {
    if (options.help || options.version) {
      return { valid: true };
    }
    
    if (!options.url && !options.urls && !options.space) {
      return {
        valid: false,
        error: "必须指定 --url、--urls 或 --space 参数"
      };
    }
    
    return { valid: true };
  }

  /**
   * 打印帮助信息
   */
  static printHelp(): void {
    console.log("飞书文档爬虫 - Feishu Shadow");
    console.log("用法:");
    console.log("  node dist/index.js [选项]");
    console.log("");
    console.log("选项:");
    console.log("  --url <url>          指定单个飞书文档URL");
    console.log("  --urls <urls>        指定多个飞书文档URL，用逗号分隔");
    console.log("  --space <url>        指定飞书知识库空间URL");
    console.log("  --parallel <number>  指定并行处理数量 (默认: 3)");
    console.log("  --retry <number>     指定重试次数 (默认: 3)");
    console.log("  --no-cache           禁用缓存");
    console.log("  --pdf                将网页转换为PDF文件");
    console.log("  --pdf-output <path>  指定PDF输出路径 (默认: out/pdf/)");
    console.log("  --help, -h           显示帮助信息");
    console.log("  --version, -v        显示版本信息");
    console.log("");
    console.log("示例:");
    console.log("  node dist/index.js --url https://example.feishu.cn/wiki/xxx");
    console.log("  node dist/index.js --urls https://example.feishu.cn/wiki/xxx,https://example.feishu.cn/wiki/yyy");
    console.log("  node dist/index.js --space https://example.feishu.cn/wiki/space/xxx");
    console.log("  node dist/index.js --url https://example.com --pdf");
    console.log("  node dist/index.js --url https://example.com --pdf --pdf-output ./output.pdf");
  }

  /**
   * 打印版本信息
   */
  static printVersion(): void {
    console.log("飞书文档爬虫 - Feishu Shadow");
    console.log("版本: 1.0.0");
  }
}