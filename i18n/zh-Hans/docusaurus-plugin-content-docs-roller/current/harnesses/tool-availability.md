---
title: "Harness 工具开放情况"
---

# Harness 工具开放情况

本页列出各 Harness 默认向模型开放的工具，以及用于选择其他工具集合的参数。模型实际收到的工具定义记录在 `trace.jsonl` 和 `trace_ACTF.json` 的 `tools` 字段中。

## 1. 默认工具与选择参数

| Harness | 默认工具 | 选择参数 |
| --- | --- | --- |
| OpenClaw | 所配置模型对应的 OpenClaw 原生工具注册表 | `--model-config` 中的模型配置 |
| Codex | Codex 原生工具，Web 搜索默认关闭 | `--codex-config`、`--codex-web-search cached/live` |
| Claude Code | Claude Code 原生工具 | `--claude-settings`、`--claude-permission-mode` |
| Hermes | `terminal` 和 `file` 工具集，未设置 `--no-hermes-vision` 时另含 `vision` | `--hermes-toolset NAME`，可重复指定。`native` 表示使用 Hermes 自身的工具集发现 |
| OpenCode | `bash`、`read`、`write`、`edit`、`apply_patch`、`glob`、`grep` 和 `skill` | `--opencode-native-tools`，配合 `--opencode-deny-tool NAME` 排除工具 |
| DeepSeek | `sdk-minimal` profile，提供一个持久化的 `bash` 工具 | `--deepseek-profile sdk`、`--deepseek-permission-mode MODE`、`--deepseek-input-modalities text,image` |
| Pi Agent | 七种内置工具 `read`、`bash`、`edit`、`write`、`grep`、`find` 和 `ls` | 无 |

未使用这些参数时，Harness 保持默认工具，已有的 run 按原有配置 Resume。

## 2. Hermes 工具集

`--hermes-toolset NAME` 以指定的工具集替换默认工具集，可重复指定多个。`--hermes-toolset native` 不传入工具集列表，由 Hermes 在容器内自行发现并启用工具。

工具通过 `local` terminal backend 在 task 容器内执行。自动安装依赖、宿主身份、持久记忆和后台 review 保持关闭，因此需要额外依赖或服务凭据的工具集，只有在镜像已安装依赖、并通过 `--pass-env` 或 task 的 `runtime.env` 传入凭据时才可用。`--no-hermes-vision` 会从任何选择中排除 `vision` 工具集。

## 3. OpenCode 原生工具

`--opencode-native-tools` 允许 OpenCode 原生注册表中的全部工具。采集过程非交互，被允许的工具无需审批直接执行。`--opencode-deny-tool NAME` 禁用一个工具或权限，可重复指定。

LSP、formatter、默认插件和项目配置发现保持关闭。调用外部服务的工具需要容器内具备相应依赖和凭据。

## 4. DeepSeek profile

`--deepseek-profile sdk` 选择完整的原生 profile，在 shell 之外提供文件和搜索工具。其 Bash 工具每次调用启动独立进程。`sdk-minimal` 保持同一个 shell，因此 shell 变量在 `sdk-minimal` 下保留，在 `sdk` 下不保留。文件和 session 在两种 profile 下均保留。自定义 profile 名称原样传给 SDK，必须已存在于镜像中。

`--deepseek-permission-mode` 将原生权限模式设为 `read-only`、`workspace-write` 或 `danger-full-access`，仅作用于 task 容器内部，宿主输入仍为只读挂载。省略该参数时，`sdk-minimal` 使用自身的模式，其他 profile 使用 `danger-full-access`：这些 profile 默认的文件沙箱在容器内没有可用后端，shell 命令会被拒绝。

`--deepseek-input-modalities text,image` 声明模型接受图片，`sdk` profile 的 `read_image` 工具由此把图片发给模型。

在任何 profile 下，Roller 均记录每次模型请求、执行 `--deepseek-max-steps` 限制，并关闭自动模型重试和向服务端上传 session。

## 5. 子 Agent

子 Agent 工具仅在通过 `--capture-calls` 捕获其调用时可用：

| Harness | 子 Agent 工具 | 未开启 `--capture-calls` | 开启 `--capture-calls` |
| --- | --- | --- | --- |
| Hermes | `delegation` 工具集 | 不启用，`--hermes-toolset native` 下同样如此。显式指定会被拒绝 | 默认启用，`native` 下由原生发现启用，也可显式指定 |
| OpenCode | `task` 工具 | 禁用，`--opencode-native-tools` 下同样如此 | 允许。Explore 子 Agent 仅可使用 `bash`、`read`、`glob` 和 `grep` |
| DeepSeek | `sdk` profile 的委派类工具，如 `subagent`、`workflow` | 不提供给模型 | 不提供给模型 |

`--capture-calls` 要求显式 API 地址、`--network host` 并开启 wire trace，协议细节见 [Subagent 采集协议](/roller/traces/subagent-capture-protocol/)。

## 6. 运行配置

运行配置记录 Hermes 工具集、OpenCode 工具策略与禁用列表，以及 DeepSeek 的 profile、权限模式和输入模态。修改其中任何一项都需要使用新的 `--run-name`。运行配置中工具列表为 `null` 表示由原生运行时决定工具。
