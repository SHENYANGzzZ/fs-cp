---
created: 2026-03-10
tags: #conversation #feishu-shadow #obsidian #skill
---

# Trae + Obsidian 集成开发 - 对话记录

**日期**：2026-03-10 14:00 - 17:30
**项目**：feishu-shadow
**标签**：#conversation #feishu-shadow #obsidian #skill

---

## 问题/需求

用户需要建立 Trae IDE 与 Obsidian 知识库的工作关联，实现：
1. 了解 Claudian 和 Obsidian Skills 的概念
2. 配置 Trae + Obsidian 集成
3. 整理现有 Obsidian 知识库
4. 创建自动同步 Skill
5. 同步 Skills 到全局系统

---

## 关键回答

### 要点一：Claudian 和 Obsidian Skills

**Claudian** 是一个 Obsidian 桌面端插件，核心功能：
- 连接 Claude Code CLI
- 支持 Claude Code 的 Skills 体系
- 可在 Obsidian 内直接与 Claude 交互、编辑文本

**Skills** 是 Claude Code 的"技能包"：
- 渐进式披露：按需展开，不一次性塞给模型
- 工作流程序化：把"工作流+领域知识"固化成可复用的能力
- 与 MCP 的区别：MCP 是"手脚"（连工具、调数据）；Skills 是"套路"（怎么做）

### 要点二：Obsidian + Trae 集成方案

两种主要方案：

**方案一：通过 MCP Server**
- 使用 `obsidian-mcp-server`
- 需要启用 Obsidian 的 Local REST API 插件
- 支持笔记读写、搜索、标签管理

**方案二：直接文件系统访问**
- 创建 `CLAUDE.md` 作为 AI 使用说明书
- 创建 `memory.md` 用于跨会话记忆
- Trae 可以直接读取 Obsidian 的 Markdown 文件

### 要点三：obsidian-sync Skill 开发

创建了完整的 Skill 结构：
```
.trae/skills/obsidian-sync/
├── SKILL.md                    # Skill 主文档
├── config.json                 # 配置文件
├── scripts/sync.py             # Python 同步脚本
├── templates/                  # Markdown 模板
│   ├── conversation.md
│   ├── dev-log.md
│   └── tasks.md
└── evals/evals.json            # 测试用例
```

核心功能：
- 对话记录同步
- 开发日志同步
- 任务进度同步
- 混合触发模式（重要内容自动同步，其他手动触发）

### 要点四：Skills 全局同步

创建了 `scripts/sync_skills.py` 同步脚本，实现：
- 项目 Skills 到全局系统的同步
- 哈希检测避免重复同步
- 冲突检测和处理
- 同步验证和报告生成

---

## 决策要点

- **决策1**：按项目组织文件结构（而非按日期），更符合开发工作流
- **决策2**：使用 Python 实现同步脚本，便于维护和扩展
- **决策3**：采用混合触发模式，平衡自动化和可控性
- **决策4**：保留 `.obsidian` 目录，可能以后会用到

---

## 代码变更

| 文件 | 变更类型 | 描述 |
|------|---------|------|
| `.trae/skills/obsidian-sync/SKILL.md` | 新增 | Skill 主文档 |
| `.trae/skills/obsidian-sync/scripts/sync.py` | 新增 | Python 同步脚本 |
| `.trae/skills/obsidian-sync/templates/*.md` | 新增 | 三种模板文件 |
| `.trae/skills/obsidian-sync/evals/evals.json` | 新增 | 测试用例 |
| `.trae/skills/obsidian-sync/config.json` | 新增 | 配置文件 |
| `scripts/sync_skills.py` | 新增 | Skills 全局同步脚本 |
| `obsidian-config/` | 删除 | 临时配置文件（已复制到 Obsidian 库） |
| `obsidian-notes/` | 删除 | 临时笔记文件（已复制到 Obsidian 库） |
| `obsidian-sync-output/` | 删除 | 临时同步输出 |
| `sync_report.md` | 删除 | 临时同步报告 |

---

## 后续行动

- [ ] 测试 obsidian-sync Skill 自动触发功能
- [ ] 完善同步脚本错误处理
- [ ] 添加配置文件支持
- [ ] 编写使用文档
- [ ] 探索 obsidian-mcp-server 集成

---

## 相关笔记

- [[知识管理的本质是建立连接]]
- [[笔记链接的艺术]]
- [[如何建立笔记链接网络]]
- [[学习Obsidian最佳实践]]
- [[Zettelkasten方法]]
- [[原子笔记的价值]]

---

## 备注

今天完成了 Trae + Obsidian 的完整集成方案，包括：
1. 知识库整理（补全断链、完善笔记）
2. obsidian-sync Skill 开发
3. Skills 全局同步
4. 临时文件清理

项目现在有了完整的 Obsidian 同步能力，可以通过触发词自动同步工作记录。
