# 对话记录模板
# 用于生成标准化的对话记录 Markdown 文件

---
created: {{date}}
tags: #conversation #{{project}}
---

# {{topic}} - 对话记录

**日期**：{{date}} {{time}}
**项目**：{{project}}
**标签**：#conversation #{{project}}

---

## 问题/需求

{{question}}

---

## 关键回答

{{#each answers}}
### 要点{{@index}}
{{this}}

{{/each}}

---

## 决策要点

{{#each decisions}}
- **{{title}}**：{{content}}
{{/each}}

---

## 代码变更

{{#each code_changes}}
- 文件：`{{file}}`
  - 变更：{{description}}
  - 类型：{{type}}

{{/each}}

---

## 后续行动

{{#each actions}}
- [ ] {{this}}
{{/each}}

---

## 相关笔记

{{#each related_notes}}
- [[{{this}}]]
{{/each}}

---

## 备注

{{notes}}
