# 开发日志模板
# 用于生成标准化的开发日志 Markdown 文件

---
created: {{date}}
tags: #dev-log #{{project}}
---

# {{project}} 开发日志

**日期**：{{date}}
**标签**：#dev-log #{{project}}

---

## 今日进展

### 完成内容

{{#each completed}}
- {{this}}
{{/each}}

### 代码变更

| 文件 | 变更类型 | 描述 |
|------|---------|------|
{{#each code_changes}}
| {{file}} | {{type}} | {{description}} |
{{/each}}

---

## 遇到的问题

{{#each problems}}
### 问题：{{title}}

- **原因**：{{cause}}
- **解决方案**：{{solution}}
- **相关代码**：
  ```
  {{code}}
  ```

{{/each}}

---

## 技术决策

{{#each decisions}}
- **决策**：{{title}}
  - **原因**：{{reason}}
  - **影响**：{{impact}}
  - **替代方案**：{{alternatives}}

{{/each}}

---

## 明日计划

{{#each plans}}
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
