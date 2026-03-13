# 任务进度模板
# 用于生成标准化的任务进度 Markdown 文件

---
created: {{created_date}}
updated: {{updated_date}}
tags: #tasks #{{project}}
---

# {{project}} 任务进度

**更新日期**：{{updated_date}}
**标签**：#tasks #{{project}}

---

## 📊 项目概览

**项目状态**：{{status}}
**当前迭代**：{{iteration}}
**整体进度**：{{overall_progress}}%

---

## 🔄 进行中

{{#each in_progress}}
- [ ] **{{title}}**
  - 进度：{{progress}}%
  - 负责人：{{assignee}}
  - 截止日期：{{deadline}}
  - 备注：{{note}}

{{/each}}

---

## ✅ 已完成

{{#each completed}}
- [x] **{{title}}**
  - 完成日期：{{completed_date}}
  - 耗时：{{duration}}
  - 备注：{{note}}

{{/each}}

---

## 📋 待办

{{#each pending}}
- [ ] **{{title}}**
  - 优先级：{{priority}}
  - 预计工时：{{estimate}}
  - 备注：{{note}}

{{/each}}

---

## 🚫 阻塞

{{#each blocked}}
- [ ] **{{title}}**
  - 阻塞原因：{{reason}}
  - 需要帮助：{{help_needed}}
  - 预计解除：{{expected_resolve}}

{{/each}}

---

## 🎯 里程碑

| 里程碑 | 目标日期 | 状态 | 完成日期 | 备注 |
|--------|---------|------|---------|------|
{{#each milestones}}
| {{name}} | {{target_date}} | {{status_icon}} | {{completed_date}} | {{note}} |
{{/each}}

---

## 📈 统计

- **总任务数**：{{total_tasks}}
- **已完成**：{{completed_count}}
- **进行中**：{{in_progress_count}}
- **待办**：{{pending_count}}
- **阻塞**：{{blocked_count}}

---

## 📝 更新历史

{{#each history}}
### {{date}}
- {{action}}：{{description}}

{{/each}}

---

## 相关笔记

{{#each related_notes}}
- [[{{this}}]]
{{/each}}
