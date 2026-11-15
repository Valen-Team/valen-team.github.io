---
title: "Harness tool availability"
---

# Harness tool availability

This page lists the tools each Harness exposes to the model by default and the flags that select a different set. The tool definitions a model actually received are recorded in `trace.jsonl` and in the `tools` field of `trace_ACTF.json`.

## 1. Default tools and selection flags

| Harness | Default tools | Selection flags |
| --- | --- | --- |
| OpenClaw | The native OpenClaw tool registry for the configured model | Model configuration in `--model-config` |
| Codex | Native Codex tools, with Web search disabled | `--codex-config`, `--codex-web-search cached/live` |
| Claude Code | Native Claude Code tools | `--claude-settings`, `--claude-permission-mode` |
| Hermes | The `terminal` and `file` toolsets, plus `vision` unless `--no-hermes-vision` is set | `--hermes-toolset NAME`, repeatable. `native` selects Hermes' own toolset discovery |
| OpenCode | `bash`, `read`, `write`, `edit`, `apply_patch`, `glob`, `grep`, and `skill` | `--opencode-native-tools`, with `--opencode-deny-tool NAME` for exclusions |
| DeepSeek | The `sdk-minimal` profile, which provides one persistent `bash` tool | `--deepseek-profile sdk`, `--deepseek-permission-mode MODE`, `--deepseek-input-modalities text,image` |
| Pi Agent | The seven built-in tools `read`, `bash`, `edit`, `write`, `grep`, `find`, and `ls` | None |

Without these flags a Harness keeps its default tools, and existing runs resume with their recorded configuration.

## 2. Hermes toolsets

`--hermes-toolset NAME` replaces the default toolsets with the named ones. Repeat the flag to select several. `--hermes-toolset native` passes no toolset list, so Hermes enables whatever its own discovery finds in the container.

Tools run through the `local` terminal backend inside the task container. Lazy dependency installation, host identity, persistent memory, and background review stay disabled, so a toolset that needs extra packages or service credentials works only when the image provides the packages and `--pass-env` or the task's `runtime.env` provides the credentials. `--no-hermes-vision` excludes the `vision` toolset from any selection.

## 3. OpenCode native tools

`--opencode-native-tools` permits every tool in the native OpenCode registry. Collection is non-interactive, so permitted tools run without approval prompts. `--opencode-deny-tool NAME` denies one tool or permission and can be repeated.

LSP servers, formatters, default plugins, and project configuration discovery stay disabled. Tools that call external services need their dependencies and credentials inside the container.

## 4. DeepSeek profiles

`--deepseek-profile sdk` selects the full native profile, which adds file and search tools next to the shell. Its Bash tool starts a separate process for each call. `sdk-minimal` keeps one shell, so shell variables persist there and not under `sdk`. Files and the session persist under both. A custom profile name is passed to the SDK unchanged and must exist in the image.

`--deepseek-permission-mode` sets the native permission mode to `read-only`, `workspace-write`, or `danger-full-access`. It applies inside the task container only; host inputs remain read-only mounts. When the flag is omitted, `sdk-minimal` keeps its own mode and every other profile runs with `danger-full-access`: the file sandbox those profiles default to has no backend in the container, and shell commands would be refused.

`--deepseek-input-modalities text,image` declares that the model accepts images, so the `read_image` tool of the `sdk` profile sends them to the model.

Under any profile Roller records every model request, enforces `--deepseek-max-steps`, and disables automatic model retries and session uploads to the provider.

## 5. Subagents

Subagent tools are available only when their calls are captured with `--capture-calls`:

| Harness | Subagent tool | Without `--capture-calls` | With `--capture-calls` |
| --- | --- | --- | --- |
| Hermes | `delegation` toolset | Not enabled, including under `--hermes-toolset native`. Naming it explicitly is rejected | Enabled by default, discovered under `native`, or named explicitly |
| OpenCode | `task` tool | Denied, including under `--opencode-native-tools` | Permitted. The Explore subagent is limited to `bash`, `read`, `glob`, and `grep` |
| DeepSeek | Delegation tools of the `sdk` profile, such as `subagent` and `workflow` | Not offered to the model | Not offered to the model |

`--capture-calls` requires an explicit API address, `--network host`, and wire tracing. The [Subagent capture protocol](/roller/traces/subagent-capture-protocol/) describes what it records.

## 6. Run configuration

The run configuration records the Hermes toolsets, the OpenCode tool policy and deny list, and the DeepSeek profile, permission mode and input modalities. Changing any of them requires a new `--run-name`. A `null` tool list in the run configuration means that the native runtime selects the tools.
