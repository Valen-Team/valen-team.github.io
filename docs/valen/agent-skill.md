---
title: Build with a coding agent
sidebar_label: Agent skill
description: Install the Valen skill so Claude Code, Cursor, Codex and other coding agents design Valen integrations well.
---

# Build with a coding agent

The [Valen skill](https://github.com/Valen-Team/skills) teaches a coding agent how to build with Valen. It covers turning a decision into atomic questions, designing text and image state, writing candidates (including a `none` route), bundling questions into one request, reading probabilities and thresholds, and choosing a runtime. It points the agent at the live Markdown docs for exact syntax.

## Install

Claude Code:

```bash
claude plugin marketplace add Valen-Team/skills
claude plugin install valen@valen-team
```

Codex:

```bash
codex plugin marketplace add Valen-Team/skills
codex plugin add valen@valen-team
```

Cursor, Gemini CLI and other agents through [skills.sh](https://skills.sh):

```bash
npx skills add Valen-Team/skills --skill valen
```

Installation is project-local by default; add `-g` to install globally. To install by hand, copy [`skills/valen/`](https://github.com/Valen-Team/skills/tree/main/skills/valen) into the agent's skills directory, such as `.claude/skills/valen/` for Claude Code or `.agents/skills/valen/` for Codex.

## Ask

Describe the outcome you want; the agent loads the skill when the task involves Valen:

> Use Valen to screen product photos for watermarks, logos and blur, and send uncertain listings to human review.

> Replace the keyword rules in `router.py` with Valen questions, with a `none` route for messages that fit no queue.

> Tag each clip in `videos/` with the dish shown, using the middle frame, and keep the frame index with every tag.

In Claude Code you can also invoke it explicitly with `/valen:valen`; in Codex, with `$valen`.

For a complete example, see [Build a support router with the agent skill](/cookbook/skill-support-router/): what an agent built from a one-page brief, and how it scored on unseen messages.

## Docs for agents

Agents without the skill can read the same material directly:

| Resource | URL |
| --- | --- |
| Documentation index | [`/llms.txt`](https://valen-team.github.io/llms.txt) · [简体中文](https://valen-team.github.io/zh-Hans/llms.txt) |
| Every page in one file | [`/llms-full.txt`](https://valen-team.github.io/llms-full.txt) |
| Any page as Markdown | Append `.md` to its path, for example [`/docs/valen/api/systemone.md`](https://valen-team.github.io/docs/valen/api/systemone.md) |
| Request and response schemas | [`/openapi.json`](https://valen-team.github.io/openapi.json) |

Next: [Write questions that work](./question-design.md) · [API calls](./api.md) · [Cookbook](/cookbook/)
