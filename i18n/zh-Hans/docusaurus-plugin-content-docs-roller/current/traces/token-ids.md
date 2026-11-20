---
title: "Token id 与 logprob"
---

# Token id 与 logprob

`--token-ids` 为 rollout 的每一次模型调用保存三样数据：端点收到的 token id、模型生成的 token id、每个生成 token 的 logprob。数据由端点直接返回，记录的就是模型实际读到和采样出的 token，不需要再套一遍对话模板，也不需要重新分词。`roller export --format tokens` 再把同一段对话的各次调用拼成一条序列，用于训练。

七个 Harness 都支持。本页的选项包含在 Roller 0.6.0 及之后的版本中：

```bash
uv tool install roller-agent    # 或：python -m pip install roller-agent
```

## 1. 端点

使用能按请求返回 token id 的 Chat Completions 端点。vLLM 通过请求字段 `return_token_ids` 提供，Roller 会自己加上这个字段。

vLLM 报告 logprob 有两种方式，在启动服务时设定：

| `--logprobs-mode` | token 的 logprob 取自 |
| --- | --- |
| `raw_logprobs`（vLLM 默认） | 应用 temperature 和 top-p 之前的分布 |
| `processed_logprobs` | 实际采样所用的分布 |

```bash
vllm serve <model> --logprobs-mode processed_logprobs
```

再加上模型需要的工具调用解析器和思考解析器。第一个 rollout 开始前，Roller 用两个不同的 temperature 各发一次只生成一个 token 的请求，判断端点属于哪一种，并以 `processed` 或 `raw` 记在 run 的 `info.json` 的 `configuration.token_ids.logprobs` 下。端点不返回 token id 时，run 在这一步结束。

## 2. 采集

采集在 Docker 中运行并显式指定 API 地址时，加上 `--capture-calls --token-ids`：

```bash
roller collect --tasks tasks.jsonl --harness hermes --model my-model \
  --api-base http://localhost:8000/v1 --capture-calls --token-ids
```

Hermes、OpenCode、Pi Agent 和 Codex 从 `OPENAI_API_KEY` 读取密钥，DeepSeek Harness 从 `DEEPSEEK_API_KEY` 读取，Claude Code 从 `ANTHROPIC_API_KEY` 读取；`--api-key-env NAME` 可改为从别的变量读取。OpenClaw 的密钥取自 `--model-config`。vLLM 启动时没有设 `--api-key` 的话，填任意非空值即可，例如 `export OPENAI_API_KEY=not-required`。

| Harness | Harness 使用的 API | 还需要 |
| --- | --- | --- |
| Hermes、OpenCode、DeepSeek Harness、Pi Agent | Chat Completions | 无 |
| OpenClaw | Chat Completions，对应 `--model-config` 中 `api` 为 `openai-completions` 的 provider | 无 |
| Claude Code | Messages | `--claude-chat-completions` |
| Codex | Responses | `--codex-chat-completions` |

```bash
# OpenClaw：端点和密钥取自 models.json 中的 provider
roller collect --tasks tasks.jsonl --harness openclaw --model vllm/my-model \
  --model-config models.json --capture-calls --token-ids

# Claude Code：API 地址不带 /v1
roller collect --tasks tasks.jsonl --harness claude-code --model my-model \
  --api-base http://localhost:8000 --claude-chat-completions --capture-calls --token-ids

# Codex
roller collect --tasks tasks.jsonl --harness codex --model my-model \
  --api-base http://localhost:8000/v1 --codex-chat-completions --capture-calls --token-ids
```

`--claude-chat-completions` 和 `--codex-chat-completions` 在请求记录代理上把 Harness 的 Messages 或 Responses 请求转换成 Chat Completions，再把响应转换回去。转换规则与 vLLM 自己的 Messages 和 Responses 端点相同，模型收到的 prompt 两种方式下一致。这两个选项不加 `--token-ids` 也能用，适合只提供 Chat Completions 的端点。

Harness 感知不到差别。代理在转发的请求里加上 `return_token_ids` 和 `logprobs`，并在 Harness 读到响应之前去掉其中的 token 字段。`capture/` 下保存的调用和 `wire_trace.jsonl` 记录的是 Harness 发出和收到的内容。

## 3. `token_ids.jsonl`

每个 sample 有一个 `token_ids.jsonl`，生成了 token 的每次模型调用占一行：

| 字段 | 内容 |
| --- | --- |
| `request_seq` | 调用的编号，与 `wire_trace.jsonl` 和 `capture/` 中一致 |
| `continues` | 这次调用所接续的那次调用的 `request_seq`，没有则为 `null` |
| `prompt_token_ids` | 端点收到的 prompt token。`continues` 有值时，只保存那次调用的 prompt 和生成内容之后的 token |
| `completion_token_ids` | 模型生成的 token，包括思考和工具调用 |
| `logprobs` | `completion_token_ids` 中每个 token 的 logprob，顺序相同 |
| `finish_reason` | `stop`、`tool_calls` 或 `length` |
| `complete` | 响应在结束前中断时为 `false` |
| `request` | 去掉 messages 和 tools 的请求：模型、采样参数和思考强度 |

同一段对话里，后一次调用会把前面的内容重新发送。如果它的 prompt 以某次较早调用的 prompt 加生成内容开头，这一行就在 `continues` 里写上那次调用，只保存其后的 token。这样文件大小随对话长度线性增长，而不是按平方增长。一次调用的完整 prompt，是它所接续的调用的 prompt 和生成内容，再接上它自己的 `prompt_token_ids`。

prompt 不以这种方式开头时，`continues` 为 `null`：

- 主 Agent 或子 Agent 的第一次调用；
- 上下文压缩时生成摘要的那次调用，以及压缩之后的第一次调用，后者的 prompt 从摘要开始；
- Harness 以另一种形式回传历史的调用。例如 Hermes 在后续请求里不带之前各轮的思考。

## 4. 导出 {#export}

```bash
roller export runs/my-run --format tokens
```

命令写出 `runs/my-run/tokens/tokens.jsonl`，每个 sample 一行：

| 字段 | 内容 |
| --- | --- |
| `task_id`、`model`、`harness`、`sample`、`sample_index` | 这一行对应的 sample |
| `bench`、`category`、`score`、`score_key` | 评分过的 run 的 bench 分数 |
| `status` | rollout 的结果 |
| `logprobs_mode` | 第 1 节中的 `processed` 或 `raw` |
| `request` | 第一次调用的 `request` |
| `sequences` | 这个 sample 的 token 序列 |

每条序列把一次调用和接续它的调用拼在一起：

| 字段 | 内容 |
| --- | --- |
| `participant_id` | 发出这些调用的主 Agent 或子 Agent |
| `request_seqs` | 序列中的各次调用，按顺序排列 |
| `finish_reasons` | 各次调用的 `finish_reason` |
| `token_ids` | 对话的每个 token，各出现一次，按模型读到和生成的顺序排列 |
| `generated` | 模型生成的 token 为 `1`，属于 prompt 的为 `0` |
| `logprobs` | 生成位置上的 logprob，其余位置为 `null` |

子 Agent 有自己的序列。发生过上下文压缩的对话，从摘要开始另起一条序列。

## 5. 适用范围

- `--token-ids` 需要 `--capture-calls`。Roller 0.6.0 只在 Docker 中记录 token id。Roller 的 Git 版本在远程沙箱（`--sandbox-provider`）中也能记录：采集端和沙箱模板都用 `pip install git+https://github.com/Valen-Team/Roller.git` 安装，由沙箱内的请求记录代理写 `token_ids.jsonl`。
- token id 是所服务模型的分词器编号。请把模型名称和版本与数据一起保存。
- `roller export --format hf` 不包含 `token_ids.jsonl`。加上 `--include-runs` 时会复制 sample 的全部文件，其中包括 token id。文本脱敏作用不到 token id，除非打算公开这些 token，请在 `--redact-rules` 文件里加上 `"exclude": ["samples/*/token_ids.jsonl"]`。
