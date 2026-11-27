---
title: "Roller"
slug: /
description: "Run tool-using agents in disposable Docker containers, collect their trajectories, grade benchmark tasks and export SFT data."
---

# Roller documentation

Roller runs tool-using AI agents in disposable Docker containers and records the full process: prompts, reasoning, tool calls, tool results, generated files, and run metadata. It is designed for repeatable data collection and evaluation across different models and agent runtimes.

New users should read the [Introduction](/roller/start/introduction/) first. It explains the main concepts and requires no setup. Then follow [Getting started](/roller/start/getting-started/) to create a first trajectory.

## What Roller does

Roller takes a set of Tasks, one or more models, and a Harness as input. It creates an isolated rollout for every Task and model combination, then writes the results to a structured run directory.

~~~text
tasks.jsonl × models
        │
        ▼
Agent Harness in Docker
        │
        ├─ trace.jsonl       Harness-native events
        ├─ trace_ACTF.json   unified analysis trace
        ├─ trace_SFT.json    standard training sample
        ├─ results/          files produced by the agent
        └─ info.json         status, usage, and provenance
~~~

Common uses include:

- collecting single-turn, multi-turn, and tool-using Agent trajectories.
- comparing models or Harnesses on the same Tasks.
- reviewing reasoning, tool calls, tool results, and generated files.
- preparing normalized traces or SFT JSONL.
- resuming interrupted collection and inspecting results in the built-in Viewer.

Roller requires Python 3.10+. The project currently uses Task schema <code>roller.task/v1</code>. It is in Beta and licensed under Apache 2.0. Source: [GitHub](https://github.com/Valen-Team/Roller).

## Choose a Harness

The first-run guide uses OpenClaw. That path is sufficient until one successful trajectory has been produced. The other Harnesses apply when a specific agent runtime or API protocol is required.

| Harness | Model API | Typical use |
| --- | --- | --- |
| OpenClaw (default) | OpenAI Responses or Chat Completions | Custom/open models, multimodal input, and dynamic User Simulator |
| Codex | Responses | Codex CLI tool trajectories |
| Claude Code | Anthropic <code>/v1/messages</code> | Claude Code tools, native thinking, and remote sandboxes |
| Hermes | OpenAI Chat Completions | Native request and tool-message traces |
| OpenCode | OpenAI Chat Completions | Native CLI sessions and file tools |
| DeepSeek Harness | DeepSeek Chat Completions | Native SDK sessions, persistent Bash, and E2B sandboxes |
| Pi Agent | OpenAI Chat Completions | Native AgentSession and coding tools |
| Stirrup | OpenAI Chat Completions | Host-side agent loop (`code_exec`, `view_image`, `finish`) with offline containers or remote sandboxes |

All eight use the same Task, Sample, trace, and SFT formats, as well as the same Viewer, retry, and Resume workflow. Their images, APIs, tools, and reasoning options differ.

### Capability matrix

| Harness | Docker | Remote sandbox | User Simulator | `--capture-calls` & `--token-ids` | `roller import` | Prebuilt image |
| --- | --- | --- | --- | --- | --- | --- |
| OpenClaw | Yes | — | Yes | Yes | — | Upstream (`ghcr.io/openclaw/openclaw:2026.11.10`) |
| Codex | Yes | — | Yes | Yes (`--codex-chat-completions` for `--token-ids`) | Yes (`~/.codex`) | `ghcr.io/valen-team/roller-codex:0.172.0` |
| Claude Code | Yes | Yes (`--sandbox-provider`) | Yes | Yes (`--claude-chat-completions` for `--token-ids`) | Yes (`~/.claude`) | Build locally (`docker/claude-code`) |
| Hermes | Yes | — | Yes | Yes | — | `ghcr.io/valen-team/roller-hermes:8fc037444731` |
| OpenCode | Yes | — | Yes | Yes | — | `ghcr.io/valen-team/roller-opencode:1.19.6` |
| DeepSeek Harness | Yes | WildClawBench only (`e2b` / `roller.sandbox_providers`) | Yes | Yes | — | `ghcr.io/valen-team/roller-deepseek:0.2.2rc2` |
| Pi Agent | Yes | — | Yes | Yes | — | `ghcr.io/valen-team/roller-pi:1.6.1` |
| Stirrup | Yes | Yes (`roller.sandbox_providers`) | — | Yes | — | Base image (`python:3.13-slim`) |

## Where to begin

1. Read [Introduction](/roller/start/introduction/) to understand Task, Harness, rollout, run, and trace.
2. Follow [Getting started](/roller/start/getting-started/) to install Roller, run a dry-run, collect one batch, and open the Viewer.
3. Use [Task format](/roller/tasks/task-format/) when writing custom Tasks.
4. Read the matching Harness guide when a runtime other than the OpenClaw example is required.
5. Use [Trajectory outputs](/roller/traces/trajectory-outputs/) for the exact trace, SFT, wire-trace, or failure-retention rules.
