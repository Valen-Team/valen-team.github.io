---
title: "会话导入"
---

# 会话导入

`roller import` 把本机已有的 Claude Code 和 Codex 会话导入成 Roller run。每个会话生成一个 sample，包含原生会话、ACTF 轨迹，能转换时还有 SFT 记录。之后 Viewer 和 `roller export --format atif|sft|hf` 像读取采集出的 run 一样读取它。不需要 Docker、模型服务和任务列表。

这个命令包含在 Roller 0.5.0 及之后的版本中：

```bash
uv tool install roller-agent    # 或：python -m pip install roller-agent
```

## 1. 导入

按项目列出会导入的会话，不写任何文件：

```bash
roller import --dry-run
```

把所有会话导入 `runs/my-sessions` 并打开：

```bash
roller import --output runs --run-name my-sessions
roller view runs/my-sessions
```

命令结束时打印摘要：新导入、已更新、未变化、空会话和失败的会话数，跳过的子代理会话数，以及有 SFT 记录的 sample 数。失败的会话逐条列出错误信息，退出码为 1。

| 参数 | 默认值 | 作用 |
| --- | --- | --- |
| `PATH ...` | 下文的会话目录 | 改为导入这些会话文件或目录 |
| `--harness` | 两种都导 | 只导入 `claude-code` 或 `codex` 的会话 |
| `--output` | `runs` | 输出根目录 |
| `--run-name` | `imported` | run 目录名 |
| `--since YYYY-MM-DD` | 全部 | 只导入此日期及之后开始的会话 |
| `--project GLOB` | 全部 | 只导入项目名（工作目录的最后一段）匹配的会话，可重复 |
| `--parallel N` | `4` | 同时转换的会话数 |
| `--dry-run` | 关闭 | 按项目打印会话数、大小和起止日期，不写文件 |

几千个会话的导入需要几分钟。Codex 的压缩会话在 run 里以解压后的形式保存，磁盘请预留会话目录大小的三倍左右。

## 2. 导入哪些文件

| Harness | 读取 | 不导入 |
| --- | --- | --- |
| Claude Code | `~/.claude/projects`（或 `$CLAUDE_CONFIG_DIR/projects`）下的 `<项目>/<会话>.jsonl` | `<会话>/subagents/` 下的子代理会话和 `agent-*.jsonl` |
| Codex | `~/.codex/sessions` 和 `~/.codex/archived_sessions`（或 `$CODEX_HOME` 下对应目录）里的 `rollout-*.jsonl` 和 `rollout-*.jsonl.zst` | `session_meta` 标明来源为子代理的 rollout |

- 子代理的工作以启动它的那次工具调用的结果回到父会话，这部分保留在父会话的轨迹里。
- 同一个 Codex 会话出现多份时，`sessions/` 优先于 `archived_sessions/`，`.jsonl` 优先于 `.jsonl.zst`。在另一个项目目录里续接过的 Claude Code 会话，取最长的那个文件。
- 没有模型回复的会话（例如只有排队中的提示）计为空会话，不生成 sample。

每个 sample 位于 `samples/<模型>/<编号>_<会话 id>/`：

| 文件 | 内容 |
| --- | --- |
| `trace.jsonl` | 原生会话；`.jsonl.zst` 文件存解压后的内容 |
| `trace_ACTF.json` | 统一轨迹。Harness 注入到用户消息里的内容（如 `<system-reminder>`）保留在轨迹中，因为模型读到了它们 |
| `trace_SFT.json` | 能转换时的 SFT 记录（见第 5 节） |
| `info.json` | 模型、用量、耗时、`title`、`project`，以及 `provenance.import`：源文件及其大小和修改时间、会话 id、工作目录、CLI 版本、git 分支、提交和远端，以及它续接的会话 |

sample 的模型是会话里回复次数最多的那个；会话里出现过的所有模型列在 `provenance.import.models`。

## 3. 再次导入

再次运行同一条命令，会导入新会话，并把文件大小或修改时间有变化的会话重新导入到原来的 sample 目录。未变化的会话跳过。仍在写入的会话导入到当前位置，下次运行时更新。

## 4. Viewer 里的标题

Viewer 按开始时间倒序列出导入的 run。每个会话显示标题，下面一行是项目名和开始日期；搜索范围包括标题和项目名。

标题取 Claude Code 会话名（用户设置的或自动生成的），没有时取用户输入的第一条消息。Harness 注入到用户消息里的内容会跳过，例如 `<system-reminder>`、`<environment_context>`、命令输出和图片占位。标题不改变轨迹。

## 5. SFT 记录

`roller export runs/my-sessions --format sft` 写出 SFT 记录和索引；导入的 sample 在索引里多三个字段：

| 字段 | 取值 |
| --- | --- |
| `tools_source` | `captured`：会话记录的工具定义。`captured_merged`：会话记录了多份工具列表（例如工具搜索加载了更多工具），记录里列出所有工具，每个工具取最后一次的定义。`inferred`：会话没有记录工具定义，按调用和用到的参数名构造 |
| `system_prompt_source` | `captured` 或 `missing` |
| `parent_session_id` | 这个会话续接或分叉自的会话；记录会重复它的历史，可据此去重 |

较新版本的 Claude Code 会记录请求的系统提示和工具；更早的会话没有系统提示，工具为推断。Codex 各版本都记录系统提示，较新版本记录工具定义。

以下会话不生成 SFT 记录：

- 模型上下文被压缩过，一条记录无法同时表示压缩前后的上下文；
- 工具结果里有 `document` 块；
- 文本里本来就有字面的 `<image>`，这是多模态记录格式的保留标记；
- 模型调用了会话从未加载过定义的工具。

每个 sample 的原因写在 `info.json` 的 `runtime.trajectory_conversion`，`roller export --format sft` 会统计被排除的 sample 数。

## 6. 上传到 Hugging Face

```bash
roller export runs/my-sessions --format hf --output my-sessions-hf
```

除了对所有 run 都会替换的内容（见 [Hugging Face 导出](/roller/traces/trajectory-outputs/#hugging-face-export)），导入的会话还会替换：

- 会话和导出机器的 home 目录：`/Users/<name>`、`/home/<name>` 替换为 `/Users/user`、`/home/user`，Claude Code 项目目录的 `-Users-<name>-` 形式同样替换；有多个用户名时依次为 `user-2`、`user-3`。不少于四个字符的用户名单独出现时也会替换；
- 会话记录的账号标识；
- 导出机器的全局 git 用户名和邮箱；
- 导出环境里凭据变量的值，即名字以 `key`、`token`、`secret`、`password` 或 `credential` 结尾的变量。

其余邮箱、仓库地址、PR 链接、内网主机名和形状不固定的密钥不会替换。上传前：

1. 查看 `my-sessions-hf.redaction-report.json`。它列出仍含邮箱、home 路径、内网 IP、凭据形状或私钥的行，不复制具体值。
2. 为剩下的内容补规则后重新导出。`replace` 替换文本，`exclude` 排除文件，`forbid` 在仍能匹配时停止导出：

   ```json
   {
     "replace": [
       {"pattern": "my-private-org", "with": "example-org"},
       {"pattern": "https://git\\.internal\\.example\\.com/[\\w./-]+", "with": "https://git.example.com/repo"}
     ],
     "forbid": ["internal\\.example\\.com"]
   }
   ```

   ```bash
   roller export runs/my-sessions --format hf --output my-sessions-hf --redact-rules rules.json
   ```

3. 用密钥扫描工具扫一遍输出目录：

   ```bash
   trufflehog filesystem my-sessions-hf
   gitleaks dir my-sessions-hf
   ```

导出只生成本地文件夹，是否上传由你决定。
