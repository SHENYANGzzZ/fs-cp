#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Skills 同步脚本
将项目中的 Skills 同步到全局系统
"""

import os
import sys
import json
import shutil
import hashlib
import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional


class SkillSync:
    """Skills 同步管理器"""
    
    def __init__(self, project_skills_path: str, global_skills_path: str):
        """
        初始化同步管理器
        
        Args:
            project_skills_path: 项目 Skills 目录路径
            global_skills_path: 全局 Skills 目录路径
        """
        self.project_path = Path(project_skills_path)
        self.global_path = Path(global_skills_path)
        self.sync_report = {
            "start_time": None,
            "end_time": None,
            "duration_seconds": 0,
            "total_skills": 0,
            "synced_skills": [],
            "skipped_skills": [],
            "conflicts": [],
            "errors": [],
            "status": "pending"
        }
        
    def calculate_dir_hash(self, dir_path: Path) -> str:
        """计算目录内容的哈希值，用于检测变更"""
        hasher = hashlib.md5()
        for root, dirs, files in os.walk(dir_path):
            dirs.sort()
            for filename in sorted(files):
                filepath = Path(root) / filename
                if filepath.suffix in ['.pyc', '.pyo', '.DS_Store']:
                    continue
                try:
                    with open(filepath, 'rb') as f:
                        hasher.update(filepath.name.encode())
                        hasher.update(f.read())
                except Exception:
                    pass
        return hasher.hexdigest()
    
    def get_skill_info(self, skill_path: Path) -> Optional[Dict]:
        """获取 Skill 的详细信息"""
        skill_md = skill_path / "SKILL.md"
        if not skill_md.exists():
            return None
            
        info = {
            "name": skill_path.name,
            "path": str(skill_path),
            "has_skill_md": True,
            "files_count": 0,
            "total_size": 0,
            "hash": self.calculate_dir_hash(skill_path)
        }
        
        for root, dirs, files in os.walk(skill_path):
            for f in files:
                if f not in ['.DS_Store', '.gitignore']:
                    info["files_count"] += 1
                    info["total_size"] += (Path(root) / f).stat().st_size
                    
        return info
    
    def list_project_skills(self) -> List[Dict]:
        """列出项目中的所有 Skills"""
        skills = []
        if not self.project_path.exists():
            return skills
            
        for item in self.project_path.iterdir():
            if item.is_dir() and not item.name.startswith('.'):
                info = self.get_skill_info(item)
                if info:
                    skills.append(info)
        return skills
    
    def list_global_skills(self) -> List[Dict]:
        """列出全局系统中的所有 Skills"""
        skills = []
        if not self.global_path.exists():
            return skills
            
        for item in self.global_path.iterdir():
            if item.is_dir() and not item.name.startswith('.'):
                info = self.get_skill_info(item)
                if info:
                    skills.append(info)
        return skills
    
    def detect_conflicts(self, project_skill: Dict, global_skill: Dict) -> Dict:
        """检测同步冲突"""
        conflict = {
            "skill_name": project_skill["name"],
            "type": None,
            "details": None
        }
        
        if project_skill["hash"] != global_skill["hash"]:
            conflict["type"] = "content_mismatch"
            conflict["details"] = {
                "project_hash": project_skill["hash"],
                "global_hash": global_skill["hash"],
                "project_files": project_skill["files_count"],
                "global_files": global_skill["files_count"]
            }
        else:
            conflict["type"] = "identical"
            
        return conflict
    
    def sync_skill(self, skill_name: str, force: bool = False) -> Dict:
        """
        同步单个 Skill
        
        Args:
            skill_name: Skill 名称
            force: 是否强制覆盖
            
        Returns:
            同步结果
        """
        result = {
            "skill_name": skill_name,
            "status": "unknown",
            "action": None,
            "message": None,
            "files_copied": 0,
            "bytes_copied": 0
        }
        
        project_skill_path = self.project_path / skill_name
        global_skill_path = self.global_path / skill_name
        
        if not project_skill_path.exists():
            result["status"] = "error"
            result["message"] = f"项目 Skill 不存在: {skill_name}"
            return result
        
        project_info = self.get_skill_info(project_skill_path)
        
        if global_skill_path.exists():
            global_info = self.get_skill_info(global_skill_path)
            conflict = self.detect_conflicts(project_info, global_info)
            
            if conflict["type"] == "identical":
                result["status"] = "skipped"
                result["action"] = "none"
                result["message"] = "内容完全相同，跳过同步"
                return result
            
            if not force:
                result["status"] = "conflict"
                result["action"] = "pending"
                result["message"] = "存在冲突，需要确认是否覆盖"
                result["conflict_details"] = conflict["details"]
                return result
            
            result["action"] = "overwrite"
            try:
                shutil.rmtree(global_skill_path)
            except Exception as e:
                result["status"] = "error"
                result["message"] = f"删除旧版本失败: {str(e)}"
                return result
        else:
            result["action"] = "create"
        
        try:
            shutil.copytree(project_skill_path, global_skill_path)
            result["status"] = "success"
            result["files_copied"] = project_info["files_count"]
            result["bytes_copied"] = project_info["total_size"]
            result["message"] = f"成功同步 {result['files_copied']} 个文件"
        except Exception as e:
            result["status"] = "error"
            result["message"] = f"复制失败: {str(e)}"
            
        return result
    
    def sync_all(self, force: bool = False) -> Dict:
        """
        同步所有 Skills
        
        Args:
            force: 是否强制覆盖冲突
            
        Returns:
            同步报告
        """
        self.sync_report["start_time"] = datetime.datetime.now().isoformat()
        start = datetime.datetime.now()
        
        project_skills = self.list_project_skills()
        self.sync_report["total_skills"] = len(project_skills)
        
        for skill in project_skills:
            result = self.sync_skill(skill["name"], force=force)
            
            if result["status"] == "success":
                self.sync_report["synced_skills"].append(result)
            elif result["status"] == "skipped":
                self.sync_report["skipped_skills"].append(result)
            elif result["status"] == "conflict":
                self.sync_report["conflicts"].append(result)
            elif result["status"] == "error":
                self.sync_report["errors"].append(result)
        
        end = datetime.datetime.now()
        self.sync_report["end_time"] = end.isoformat()
        self.sync_report["duration_seconds"] = (end - start).total_seconds()
        self.sync_report["status"] = "completed"
        
        return self.sync_report
    
    def verify_sync(self) -> Dict:
        """验证同步结果"""
        verification = {
            "verified": True,
            "mismatches": [],
            "missing_skills": []
        }
        
        project_skills = self.list_project_skills()
        global_skills = {s["name"]: s for s in self.list_global_skills()}
        
        for project_skill in project_skills:
            skill_name = project_skill["name"]
            
            if skill_name not in global_skills:
                verification["missing_skills"].append(skill_name)
                verification["verified"] = False
                continue
            
            global_skill = global_skills[skill_name]
            
            if project_skill["hash"] != global_skill["hash"]:
                verification["mismatches"].append({
                    "skill_name": skill_name,
                    "project_hash": project_skill["hash"],
                    "global_hash": global_skill["hash"]
                })
                verification["verified"] = False
        
        return verification
    
    def generate_report(self) -> str:
        """生成同步报告"""
        lines = [
            "# Skills 同步报告",
            "",
            f"**同步时间**: {self.sync_report['start_time']}",
            f"**耗时**: {self.sync_report['duration_seconds']:.2f} 秒",
            f"**状态**: {self.sync_report['status']}",
            "",
            "---",
            "",
            "## 统计摘要",
            "",
            f"| 指标 | 数量 |",
            f"|------|------|",
            f"| 项目 Skills 总数 | {self.sync_report['total_skills']} |",
            f"| 成功同步 | {len(self.sync_report['synced_skills'])} |",
            f"| 跳过（无变更） | {len(self.sync_report['skipped_skills'])} |",
            f"| 冲突待处理 | {len(self.sync_report['conflicts'])} |",
            f"| 错误 | {len(self.sync_report['errors'])} |",
            "",
        ]
        
        if self.sync_report["synced_skills"]:
            lines.extend([
                "---",
                "",
                "## 成功同步的 Skills",
                "",
            ])
            for skill in self.sync_report["synced_skills"]:
                lines.append(f"- **{skill['skill_name']}** - {skill['message']}")
            lines.append("")
        
        if self.sync_report["skipped_skills"]:
            lines.extend([
                "---",
                "",
                "## 跳过的 Skills（无变更）",
                "",
            ])
            for skill in self.sync_report["skipped_skills"]:
                lines.append(f"- **{skill['skill_name']}** - {skill['message']}")
            lines.append("")
        
        if self.sync_report["conflicts"]:
            lines.extend([
                "---",
                "",
                "## 冲突待处理",
                "",
            ])
            for skill in self.sync_report["conflicts"]:
                lines.append(f"- **{skill['skill_name']}** - {skill['message']}")
            lines.append("")
        
        if self.sync_report["errors"]:
            lines.extend([
                "---",
                "",
                "## 错误信息",
                "",
            ])
            for skill in self.sync_report["errors"]:
                lines.append(f"- **{skill['skill_name']}** - {skill['message']}")
            lines.append("")
        
        lines.extend([
            "---",
            "",
            f"*报告生成时间: {datetime.datetime.now().isoformat()}*"
        ])
        
        return "\n".join(lines)


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Skills 同步工具")
    parser.add_argument("--project-path", required=True, help="项目 Skills 目录路径")
    parser.add_argument("--global-path", required=True, help="全局 Skills 目录路径")
    parser.add_argument("--force", action="store_true", help="强制覆盖冲突")
    parser.add_argument("--verify", action="store_true", help="仅验证同步结果")
    parser.add_argument("--report-path", help="报告保存路径")
    
    args = parser.parse_args()
    
    sync = SkillSync(args.project_path, args.global_path)
    
    if args.verify:
        verification = sync.verify_sync()
        print(json.dumps(verification, indent=2, ensure_ascii=False))
        return
    
    report = sync.sync_all(force=args.force)
    
    report_text = sync.generate_report()
    
    if args.report_path:
        with open(args.report_path, "w", encoding="utf-8") as f:
            f.write(report_text)
        print(f"报告已保存到: {args.report_path}")
    
    print(report_text)
    
    if report["errors"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
