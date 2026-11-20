---
title: "Token ids and logprobs"
---

# Token ids and logprobs

`--token-ids` saves, for every model call of a rollout, the token ids the endpoint received, the token ids it generated, and the logprob of each generated token. The data comes from the endpoint itself, so it holds exactly the tokens the model read and sampled: no chat template is applied a second time and no text is tokenized again. `roller export --format tokens` then joins the calls of a conversation into one sequence for training.

All seven Harnesses are supported. The options on this page are part of Roller 0.6.0 and later:

```bash
uv tool install roller-agent    # or: python -m pip install roller-agent
```

## 1. Endpoint

Use a Chat Completions endpoint that returns token ids on request. vLLM does, through its `return_token_ids` request field; Roller sets the field itself.

vLLM reports logprobs in one of two ways, set when the server starts:

| `--logprobs-mode` | The logprob of a token is taken |
| --- | --- |
| `raw_logprobs` (vLLM default) | Before temperature and top-p are applied |
| `processed_logprobs` | From the distribution the token was sampled from |

```bash
vllm serve <model> --logprobs-mode processed_logprobs
```

Add the tool-call and reasoning parsers your model needs. Before the first rollout, Roller sends the endpoint two one-token requests at different temperatures and records which of the two it reports, as `processed` or `raw`, under `configuration.token_ids.logprobs` in the `info.json` of the run. An endpoint that returns no token ids ends the run there.

## 2. Collect

Add `--capture-calls --token-ids` to a collection that runs in Docker with an explicit API base:

```bash
roller collect --tasks tasks.jsonl --harness hermes --model my-model \
  --api-base http://localhost:8000/v1 --capture-calls --token-ids
```

The Harness reads its key from `OPENAI_API_KEY` for Hermes, OpenCode, Pi Agent and Codex, `DEEPSEEK_API_KEY` for DeepSeek Harness and `ANTHROPIC_API_KEY` for Claude Code; `--api-key-env NAME` reads it from another variable. OpenClaw takes the key from `--model-config`. For a vLLM server started without `--api-key`, any non-empty value works, such as `export OPENAI_API_KEY=not-required`.

| Harness | API the Harness speaks | Also needed |
| --- | --- | --- |
| Hermes, OpenCode, DeepSeek Harness, Pi Agent | Chat Completions | Nothing |
| OpenClaw | Chat Completions, for a provider whose `api` is `openai-completions` in `--model-config` | Nothing |
| Claude Code | Messages | `--claude-chat-completions` |
| Codex | Responses | `--codex-chat-completions` |

```bash
# OpenClaw: the endpoint and key come from the provider in models.json
roller collect --tasks tasks.jsonl --harness openclaw --model vllm/my-model \
  --model-config models.json --capture-calls --token-ids

# Claude Code: the API base has no /v1
roller collect --tasks tasks.jsonl --harness claude-code --model my-model \
  --api-base http://localhost:8000 --claude-chat-completions --capture-calls --token-ids

# Codex
roller collect --tasks tasks.jsonl --harness codex --model my-model \
  --api-base http://localhost:8000/v1 --codex-chat-completions --capture-calls --token-ids
```

`--claude-chat-completions` and `--codex-chat-completions` translate the Messages or Responses requests of the Harness to Chat Completions at the request recording proxy, and the response back. The translation follows the one vLLM applies in its own Messages and Responses endpoints, so the model receives the same prompt either way. Both options also work without `--token-ids`, for an endpoint that serves only Chat Completions.

The Harness does not see the difference. The proxy adds `return_token_ids` and `logprobs` to the request it forwards and removes the token fields from the response before the Harness reads it. The saved calls under `capture/` and `wire_trace.jsonl` hold what the Harness sent and received.

## 3. `token_ids.jsonl`

Each sample has a `token_ids.jsonl` with one row per model call that generated tokens:

| Field | Content |
| --- | --- |
| `request_seq` | The number of the call, as in `wire_trace.jsonl` and `capture/` |
| `continues` | The `request_seq` of the call this one continues, or `null` |
| `prompt_token_ids` | The prompt tokens the endpoint received. When `continues` is set, only the tokens after the prompt and completion of that call |
| `completion_token_ids` | The tokens the model generated, including reasoning and tool calls |
| `logprobs` | The logprob of each token in `completion_token_ids`, in the same order |
| `finish_reason` | `stop`, `tool_calls` or `length` |
| `complete` | `false` when the response was cut off before its end |
| `request` | The request without its messages and tools: model, sampling parameters and reasoning effort |

A later call of a conversation resends the earlier ones. When its prompt starts with the prompt and completion of an earlier call, the row names that call in `continues` and stores only the tokens that follow, so the file grows with the length of the conversation and not with its square. The full prompt of a call is the prompt and completion of the call it continues, followed by its own `prompt_token_ids`.

`continues` is `null` when the prompt does not start that way:

- the first call of the main agent or of a subagent;
- the call that writes the summary of a context compaction, and the first call after it, whose prompt starts from that summary;
- a call of a Harness that sends the history back in another form. Hermes, for example, leaves the reasoning of earlier turns out of later requests.

## 4. Export {#export}

```bash
roller export runs/my-run --format tokens
```

The command writes `runs/my-run/tokens/tokens.jsonl` with one row per sample:

| Field | Content |
| --- | --- |
| `task_id`, `model`, `harness`, `sample`, `sample_index` | The sample the row describes |
| `bench`, `category`, `score`, `score_key` | The bench score, for a graded run |
| `status` | The outcome of the rollout |
| `logprobs_mode` | `processed` or `raw`, from section 1 |
| `request` | The `request` of the first call |
| `sequences` | The token sequences of the sample |

Each sequence joins a call with the calls that continue it:

| Field | Content |
| --- | --- |
| `participant_id` | The main agent or subagent that made the calls |
| `request_seqs` | The calls in the sequence, in order |
| `finish_reasons` | The `finish_reason` of each call |
| `token_ids` | Every token of the conversation once, in the order the model read and generated them |
| `generated` | `1` where the model generated the token, `0` where it was part of a prompt |
| `logprobs` | The logprob at each generated position, `null` elsewhere |

A subagent has its own sequences. A conversation that was compacted continues in a new sequence that starts with the summary.

## 5. Scope

- `--token-ids` needs `--capture-calls` and Docker execution; a remote sandbox is not supported.
- Token ids are numbers of the tokenizer of the served model. Keep the model name and revision with the data.
- `roller export --format hf` leaves `token_ids.jsonl` out. With `--include-runs` it copies every file of the samples, token ids included. Text redaction does not reach token ids, so add `"exclude": ["samples/*/token_ids.jsonl"]` to the `--redact-rules` file unless the tokens are meant to be published.
