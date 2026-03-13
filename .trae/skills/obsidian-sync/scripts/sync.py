#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Obsidian 同步脚本
用于将 Trae 工作记录同步到 Obsidian 知识库
"""

import os
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List


class ObsidianSync:
    """Obsidian 同步管理器"""
    
    def __init__(self, vault_path: str, project_name: str):
        """
        初始化同步管理器
        
        Args:
            vault_path: Obsidian 库路径
            project_name: 项目名称
        """
        self.vault_path = Path(vault_path)
        self.project_name = project_name
        self.project_path = self.vault_path / "01-Projects" / project_name
        
    def ensure_directories(self):
        """确保必要的目录结构存在"""
        directories = [
            self.project_path / "conversations" / datetime.now().strftime("%Y-%m"),
            self.project_path / "dev-logs",
            self.project_path / "tasks",
            self.vault_path / "05-Daily",
        ]
        for dir_path in directories:
            dir_path.mkdir(parents=True, exist_ok=True)
            
    def sync_conversation(self, content: Dict) -> str:
        """
        同步对话记录
        
        Args:
            content: 对话内容字典，包含：
                - topic: 主题
                - questions: 问题列表
                - answers: 回答列表
                - decisions: 决策列表
                - actions: 行动项列表
                - code_changes: 代码变更列表
                
        Returns:
            保存的文件路径
        """
        self.ensure_directories()
        
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M")
        month_str = now.strftime("%Y-%m")
        
        topic = content.get("topic", "未命名对话")
        safe_topic = self._safe_filename(topic)
        filename = f"{date_str}-{safe_topic}.md"
        filepath = self.project_path / "conversations" / month_str / filename
        
        markdown = self._generate_conversation_markdown(content, date_str, time_str)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(markdown)
            
        return str(filepath)
    
    def sync_dev_log(self, content: Dict) -> str:
        """
        同步开发日志
        
        Args:
            content: 开发日志内容字典，包含：
                - completed: 完成事项列表
                - code_changes: 代码变更列表
                - problems: 问题列表
                - decisions: 决策列表
                - plans: 明日计划列表
                
        Returns:
            保存的文件路径
        """
        self.ensure_directories()
        
        date_str = datetime.now().strftime("%Y-%m-%d")
        filepath = self.project_path / "dev-logs" / f"{date_str}.md"
        
        markdown = self._generate_dev_log_markdown(content, date_str)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(markdown)
            
        return str(filepath)
    
    def sync_tasks(self, content: Dict) -> str:
        """
        同步任务进度
        
        Args:
            content: 任务内容字典，包含：
                - in_progress: 进行中任务
                - completed: 已完成任务
                - pending: 待办任务
                - milestones: 里程碑
                
        Returns:
            保存的文件路径
        """
        self.ensure_directories()
        
        filepath = self.project_path / "tasks" / "tasks.md"
        
        markdown = self._generate_tasks_markdown(content)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(markdown)
            
        return str(filepath)
    
    def _generate_conversation_markdown(self, content: Dict, date_str: str, time_str: str) -> str:
        """生成对话记录 Markdown"""
        lines = [
            f"# {content.get('topic', '未命名对话')} - 对话记录",
            "",
            f"**日期**：{date_str} {time_str}",
            f"**项目**：{self.project_name}",
            f"**标签**：#conversation #{self.project_name}",
            "",
            "---",
            "",
            "## 问题/需求",
            "",
            content.get("question", "无描述"),
            "",
            "---",
            "",
            "## 关键回答",
            "",
        ]
        
        for i, answer in enumerate(content.get("answers", []), 1):
            lines.append(f"### 要点{i}")
            lines.append(answer)
            lines.append("")
            
        lines.extend([
            "---",
            "",
            "## 决策要点",
            "",
        ])
        
        for decision in content.get("decisions", []):
            lines.append(f"- **{decision.get('title', '决策')}**：{decision.get('content', '')}")
            
        lines.extend([
            "",
            "---",
            "",
            "## 代码变更",
            "",
        ])
        
        for change in content.get("code_changes", []):
            lines.append(f"- 文件：`{change.get('file', '')}`")
            lines.append(f"  - 变更：{change.get('description', '')}")
            lines.append("")
            
        lines.extend([
            "---",
            "",
            "## 后续行动",
            "",
        ])
        
        for action in content.get("actions", []):
            lines.append(f"- [ ] {action}")
            
        lines.extend([
            "",
            "---",
            "",
            "## 相关笔记",
            "",
        ])
        
        for note in content.get("related_notes", []):
            lines.append(f"- [[{note}]]")
            
        return "\n".join(lines)
    
    def _generate_dev_log_markdown(self, content: Dict, date_str: str) -> str:
        """生成开发日志 Markdown"""
        lines = [
            f"# {self.project_name} 开发日志",
            "",
            f"**日期**：{date_str}",
            f"**标签**：#dev-log #{self.project_name}",
            "",
            "---",
            "",
            "## 今日进展",
            "",
            "### 完成内容",
            "",
        ]
        
        for item in content.get("completed", []):
            lines.append(f"- {item}")
            
        lines.extend([
            "",
            "### 代码变更",
            "",
            "| 文件 | 变更类型 | 描述 |",
            "|------|---------|------|",
        ])
        
        for change in content.get("code_changes", []):
            lines.append(f"| {change.get('file', '')} | {change.get('type', '')} | {change.get('description', '')} |")
            
        lines.extend([
            "",
            "---",
            "",
            "## 遇到的问题",
            "",
        ])
        
        for problem in content.get("problems", []):
            lines.append(f"### 问题：{problem.get('title', '')}")
            lines.append(f"- **原因**：{problem.get('cause', '')}")
            lines.append(f"- **解决方案**：{problem.get('solution', '')}")
            lines.append("")
            
        lines.extend([
            "---",
            "",
            "## 技术决策",
            "",
        ])
        
        for decision in content.get("decisions", []):
            lines.append(f"- **决策**：{decision.get('title', '')}")
            lines.append(f"  - **原因**：{decision.get('reason', '')}")
            lines.append(f"  - **影响**：{decision.get('impact', '')}")
            lines.append("")
            
        lines.extend([
            "---",
            "",
            "## 明日计划",
            "",
        ])
        
        for plan in content.get("plans", []):
            lines.append(f"- [ ] {plan}")
            
        lines.extend([
            "",
            "---",
            "",
            "## 相关笔记",
            "",
        ])
        
        for note in content.get("related_notes", []):
            lines.append(f"- [[{note}]]")
            
        return "\n".join(lines)
    
    def _generate_tasks_markdown(self, content: Dict) -> str:
        """生成任务进度 Markdown"""
        now = datetime.now().strftime("%Y-%m-%d")
        
        lines = [
            f"# {self.project_name} 任务进度",
            "",
            f"**更新日期**：{now}",
            f"**标签**：#tasks #{self.project_name}",
            "",
            "---",
            "",
            "## 进行中",
            "",
        ]
        
        for task in content.get("in_progress", []):
            progress = task.get("progress", 0)
            lines.append(f"- [ ] {task.get('title', '')} - 进度：{progress}%")
            
        lines.extend([
            "",
            "## 已完成",
            "",
        ])
        
        for task in content.get("completed", []):
            date = task.get("completed_date", "")
            lines.append(f"- [x] {task.get('title', '')} - 完成日期：{date}")
            
        lines.extend([
            "",
            "## 待办",
            "",
        ])
        
        for task in content.get("pending", []):
            lines.append(f"- [ ] {task}")
            
        lines.extend([
            "",
            "## 里程碑",
            "",
            "| 里程碑 | 目标日期 | 状态 | 备注 |",
            "|--------|---------|------|------|",
        ])
        
        for milestone in content.get("milestones", []):
            status = milestone.get("status", "")
            status_icon = {"completed": "✅ 完成", "in_progress": "🔄 进行中", "pending": "⏳ 待开始"}.get(status, status)
            lines.append(f"| {milestone.get('name', '')} | {milestone.get('date', '')} | {status_icon} | {milestone.get('note', '')} |")
            
        lines.extend([
            "",
            "---",
            "",
            "## 更新历史",
            "",
            f"### {now}",
        ])
        
        for update in content.get("updates", []):
            lines.append(f"- {update}")
            
        return "\n".join(lines)
    
    def _safe_filename(self, name: str) -> str:
        """生成安全的文件名"""
        unsafe_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
        for char in unsafe_chars:
            name = name.replace(char, '-')
        return name[:50]


def main():
    """主函数 - 用于命令行调用"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Obsidian 同步工具")
    parser.add_argument("--vault", required=True, help="Obsidian 库路径")
    parser.add_argument("--project", required=True, help="项目名称")
    parser.add_argument("--type", choices=["conversation", "dev-log", "tasks", "all"], 
                       default="all", help="同步类型")
    parser.add_argument("--input", help="输入 JSON 文件路径")
    
    args = parser.parse_args()
    
    sync = ObsidianSync(args.vault, args.project)
    
    if args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            content = json.load(f)
    else:
        content = {}
        
    if args.type == "conversation":
        path = sync.sync_conversation(content)
        print(f"对话记录已保存到: {path}")
    elif args.type == "dev-log":
        path = sync.sync_dev_log(content)
        print(f"开发日志已保存到: {path}")
    elif args.type == "tasks":
        path = sync.sync_tasks(content)
        print(f"任务进度已保存到: {path}")
    elif args.type == "all":
        if "conversation" in content:
            print(f"对话记录: {sync.sync_conversation(content['conversation'])}")
        if "dev_log" in content:
            print(f"开发日志: {sync.sync_dev_log(content['dev_log'])}")
        if "tasks" in content:
            print(f"任务进度: {sync.sync_tasks(content['tasks'])}")


if __name__ == "__main__":
    main()
