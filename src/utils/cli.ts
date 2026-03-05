/**
 * 命令行参数处理模块
 */

export interface CliOptions {
  url?: string;
  urls?: string[];
  space?: string;
  output?: string;
  cache?: boolean;
  parallel?: number;
  retry?: number;
  help?: boolean;
}

export class CliParser {
  /**
   * 解析命令行参数
   */
  static parse(args: string[]): CliOptions {
    const options: CliOptions = {
      cache: true,
      parallel: 3,
      retry: 3,
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '-h':
        case '--help':
          options.help = true;
          break;

        case '-u':
        case '--url':
          options.url = args[++i];
          break;

        case '-s':
        case '--space':
          options.space = args[++i];
          break;

        case '-o':
        case '--output':
          options.output = args[++i];
          break;

        case '--no-cache':
          options.cache = false;
          break;

        case '-p':
        case '--parallel':
          options.parallel = parseInt(args[++i], 10);
          break;

        case '-r':
        case '--retry':
          options.retry = parseInt(args[++i], 10);
          break;

        case '--urls':
          // 支持多个URL，逗号分隔
          options.urls = args[++i].split(',').map(u => u.trim());
          break;
      }
    }

    return options;
  }

  /**
   * 打印帮助信息
   */
  static printHelp(): void {
    console.log(`
飞书文档爬虫 - Feishu Shadow

用法:
  npm start -- [选项]

选项:
  -h, --help              显示帮助信息
  -u, --url <url>         爬取单个文档URL
  -s, --space <url>       爬取整个知识库空间的所有文档
  --urls <url1,url2>      爬取多个文档URL（逗号分隔）
  -o, --output <dir>      输出目录（默认: ./out）
  --no-cache              禁用缓存
  -p, --parallel <num>    并行处理数量（默认: 3）
  -r, --retry <num>       失败重试次数（默认: 3）

示例:
  # 爬取单个文档
  npm start -- -u "https://xxx.feishu.cn/wiki/xxxxx"

  # 爬取整个知识库空间
  npm start -- -s "https://xxx.feishu.cn/wiki/space/xxxxx"

  # 爬取多个文档
  npm start -- --urls "url1,url2,url3"

  # 禁用缓存并设置并行数
  npm start -- -s "https://xxx.feishu.cn/wiki/space/xxxxx" --no-cache -p 5
`);
  }

  /**
   * 验证选项
   */
  static validate(options: CliOptions): { valid: boolean; error?: string } {
    if (options.help) {
      return { valid: true };
    }

    if (!options.url && !options.space && !options.urls) {
      return {
        valid: false,
        error: '必须指定 -u/--url、-s/--space 或 --urls 参数',
      };
    }

    if (options.parallel && (options.parallel < 1 || options.parallel > 10)) {
      return {
        valid: false,
        error: '并行数必须在 1-10 之间',
      };
    }

    if (options.retry && (options.retry < 0 || options.retry > 10)) {
      return {
        valid: false,
        error: '重试次数必须在 0-10 之间',
      };
    }

    return { valid: true };
  }
}
