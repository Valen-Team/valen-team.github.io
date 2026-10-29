---
title: 用编程 agent 构建
sidebar_label: Agent skill
description: 安装 Valen skill，让 Claude Code、Cursor、Codex 等编程 agent 设计好 Valen 集成。
---

# 用编程 agent 构建

[Valen skill](https://github.com/Valen-Team/skills) 教编程 agent 怎样用好 Valen：把一个决策拆成原子问题，组织文本和图像 state，写候选项（包括 `none` 分支），把多个问题合并到一次请求，读概率和定阈值，以及选择运行方式。精确语法则让 agent 去读在线的 Markdown 文档。

## 安装

Claude Code：

```bash
claude plugin marketplace add Valen-Team/skills
claude plugin install valen@valen-team
```

Codex：

```bash
codex plugin marketplace add Valen-Team/skills
codex plugin add valen@valen-team
```

Cursor、Gemini CLI 等其他 agent 通过 [skills.sh](https://skills.sh) 安装：

```bash
npx skills add Valen-Team/skills --skill valen
```

默认安装到当前项目；加 `-g` 安装到全局。手动安装时，把 [`skills/valen/`](https://github.com/Valen-Team/skills/tree/main/skills/valen) 复制到 agent 的 skills 目录，例如 Claude Code 的 `.claude/skills/valen/` 或 Codex 的 `.agents/skills/valen/`。

## 提问方式

直接描述你想要的结果；任务涉及 Valen 时 agent 会自动加载 skill：

> 用 Valen 检查商品图里有没有水印、logo 和模糊，拿不准的商品转人工审核。

> 把 `router.py` 里的关键词规则换成 Valen 问题，哪个队列都不匹配的消息走 `none` 分支。

> 用中间帧给 `videos/` 里每个短视频标注菜品，并在每个标签里记录帧序号。

在 Claude Code 中也可以用 `/valen:valen` 显式调用；在 Codex 中用 `$valen`。

完整示例见[用 agent skill 做客服分流](/cookbook/skill-support-router/)：agent 根据一页需求做出了什么，以及它在没见过的消息上的得分。

## 给 agent 读的文档

没有安装 skill 的 agent 也可以直接读取这些内容：

| 资源 | 地址 |
| --- | --- |
| 文档索引 | [`/zh-Hans/llms.txt`](https://valen-team.github.io/zh-Hans/llms.txt) · [English](https://valen-team.github.io/llms.txt) |
| 全部页面合集 | [`/zh-Hans/llms-full.txt`](https://valen-team.github.io/zh-Hans/llms-full.txt) |
| 任意页面的 Markdown | 在路径后加 `.md`，例如 [`/zh-Hans/docs/valen/api/systemone.md`](https://valen-team.github.io/zh-Hans/docs/valen/api/systemone.md) |
| 请求与响应结构 | [`/openapi.json`](https://valen-team.github.io/openapi.json) |

下一步：[写好问题](./question-design.md) · [API 调用](./api.md) · [Cookbook](/cookbook/)
