---
title: "WildClawBench"
---

# WildClawBench

60 real-scenario OpenClaw tasks in 6 categories. Upstream:
<https://github.com/InternLM/WildClawBench>.

This guide maps WildClawBench's upstream parameters to Roller settings and
identifies options not yet supported. Generic bench-layer mechanics (`bench` block, grading timing, `stage`
leak prevention, aggregation) are in
[Bench integration and scoring](/roller/benches/bench-format/).

## 1. Shortest path

```bash
# 1) Check out upstream
git clone https://github.com/InternLM/WildClawBench ~/WildClawBench

# 2) Source the upstream environment variables as usual; Roller reuses the same variable names (see §3)
set -a; . ~/WildClawBench/.env; set +a

# 3) Translate + collect + grade + report in one command
roller collect --bench wildclawbench --bench-root ~/WildClawBench \
  --model <provider>/<model> \
  --harness openclaw --openclaw-image wildclawbench-ubuntu:v1.3 \
  --model-config my_api.json --parallel 4 \
  --output /tmp/wcb --run-name run1 \
  --pass-env NODE_EXTRA_CA_CERTS
```

The task snapshot and report are saved as `run1/tasks.jsonl` and
`run1/bench-report.json`.

The same run can be described in a YAML file and started with `roller bench run`; see
[Benchmark run configuration](/roller/benches/benchmark-standard/):

```bash
roller bench run --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/wildclawbench.yaml
```

## 2. Upstream parameters → Roller equivalents

CLI flags of `eval/run_batch.py`:

| Upstream | Roller | Notes |
| --- | --- | --- |
| `--task` / `--category` | `collect --bench-task-id` / `--bench-category` | Both can be repeated in Roller; an invalid id raises an error instead of silently producing an empty run |
| `--model` | `collect --model` | Repeatable; multi-model Cartesian expansion |
| `--parallel` | `collect --parallel` | |
| `--agent-backend` | `collect --harness` | The adapter writes `openclaw`; `codex`/`claude-code`/`hermes` can override with `--harness`; use `--harness hermes` for Hermes tasks |
| `--models-config` | `collect --model-config` | Both sides expand `${ENV}` |
| `--thinking` | `collect --thinking` | The adapter leaves task thinking unset so it does not override the command line |
| `--lobster-env` | `collect --pass-env` | |
| `--lobster-name` | `collect --run-name` | Affects only the artifact directory name |
| `--global-parallel` | none (Roller has one global pool) | Equivalent to upstream `--global-parallel` always being enabled; by default, upstream completes one category pool serially before starting the next |
| `--lobster-workspace` | Unsupported | Upstream uses it for persona files such as SOUL.md / USER.md. In Roller, declare them explicitly in the task's `files.context` |
| `--openclaw-image-model` | partial: `--set-image-model` / `--no-set-image-model` | Roller can use the chat model as the image model or leave it unset; a separate image model is not supported |

Environment variables (`.env`):

| Upstream | Roller | Notes |
| --- | --- | --- |
| `DOCKER_IMAGE` | `collect --openclaw-image` | |
| `GATEWAY_PORT` | `collect --gateway-port` | Roller also provides `--gateway-port-step` for staggering parallel workers |
| `TASKS_SUBDIR` | `ROOT` positional argument of `bench export` | `<root>/tasks_x25` can also be passed: Roller uses `ROOT/tasks` when it exists and otherwise treats `ROOT` itself as the task directory |
| `OUTPUT_SUBDIR` | `collect --output` + `--run-name` | |
| `DEFAULT_MODEL` / `DEFAULT_PARALLEL` | no default-value mechanism | Pass `--model` / `--parallel` explicitly |
| `HTTP_PROXY_INNER` / `HTTPS_PROXY_INNER` / `NO_PROXY_INNER` | host `http_proxy` / `https_proxy` / `no_proxy` | The OpenClaw harness already passes these names by default; see §3 |
| `BRAVE_API_KEY` | same name, passed through by default | Also used as the search shim token |
| `SEARCH_SHIM_HOST_IP` / `SEARCH_SHIM_HOSTNAME` / `SEARCH_SHIM_CERT` | Read the matching variables at export | See §5 |
| `OPENROUTER_API_KEY` / `OPENROUTER_BASE_URL` / `JUDGE_MODEL` | same name | Graders for 46/60 tasks depend on them for scoring; see §3 |
| `WILDCLAW_TIMEOUT_MULTIPLIER` | Read the matching variable at export | See §4 |

## 3. How environment variables enter the container

Environment variables enter the container in three ways:

| Source | If missing |
| --- | --- |
| Task `## Env` → `runtime.env` (name list) | Task fails with `requires missing environment variable X` |
| OpenClaw harness default list (`OPENROUTER_*`, `BRAVE_API_KEY`, `TAVILY_API_KEY`, both-case proxy names) | Silently skipped (empty values are not passed) |
| `--pass-env NAME` | Silently skipped |
| `bench.grade.env` (also from `## Env`) | Warning only: `grading environment variable X is unset` |

During scoring, Roller passes host environment variables to `docker exec` with `-e`. An additional
`--pass-env` is not required.

A judge scores 46 of the 60 tasks. Before comparing runs, check that
`OPENROUTER_BASE_URL` and `JUDGE_MODEL` match. Changing the scoring gateway or
judge model affects score comparability.

## 4. Timeouts

Each task carries its own `timeout_seconds` (five measured values:
300/360/600/900/1200), so `--task-timeouts` must be enabled. Otherwise all tasks
fall back to a single `--timeout`.

To extend timeouts, set the upstream environment variable of the same name, which is read at
export:

```bash
WILDCLAW_TIMEOUT_MULTIPLIER=2 roller bench export wildclawbench ~/WildClawBench -o /tmp/wcb_x2.jsonl
```

The value is `ceil(base × multiplier)`, matching upstream
`tools/run_with_timeout_multiplier.py`. Invalid values (non-numeric, 0,
negative) raise an error immediately instead of silently running at 1×.

`--timeout` cannot replace the multiplier. The upstream multiplier changes
`timeout_seconds` in the task file, which also sets the time budget in the
prompt prefix (§6). `--timeout` changes only the execution limit: the prompt
may state that the Agent has 300 seconds while the actual limit is 600.
The adapter applies the multiplier before building the task row, so the prompt
and execution limit use the same adjusted value.

## 5. Search: upstream does not call the real Brave API

Upstream resolves `api.search.brave.com` to a local shim that implements the Brave protocol
with a Serper backend (`tools/serper_brave_shim.py`, self-signed TLS on port
443), using `docker run --add-host` and a mounted certificate. Roller provides
neither `--add-host` nor an extra mount flag. The adapter therefore implements the same
configuration as two `runtime.setup` commands, which run as root before the Agent starts:

1. Write `<SEARCH_SHIM_HOST_IP> <SEARCH_SHIM_HOSTNAME>` into `/etc/hosts`;
2. Inline the contents of `SEARCH_SHIM_CERT` into
   `/usr/local/share/ca-certificates/wildclaw-search-shim.crt`, run
   `update-ca-certificates`, and append it to certifi's bundle
   (requests/httpx do not read the system store).

These variables are read at export (same names and defaults as upstream; a relative
`SEARCH_SHIM_CERT` is likewise resolved against the checkout root). Therefore, source
`.env` before export. If the variables are unset, the commands are skipped and one log line is written.

OpenClaw sends `web_search` requests through Node, which does not read the
system certificate store. Also set:

```bash
export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/wildclaw-search-shim.crt
roller collect ... --pass-env NODE_EXTRA_CA_CERTS
```

Without this step, every search returns
`{"status":"error","tool":"web_search","error":"fetch failed"}`, but the Agent
continues working and the run still produces scores. After a run, check for
search failures with the following commands:

```bash
grep -c '"toolName": "web_search"' <run>/samples/*/*/trace.jsonl
grep -c 'fetch failed'             <run>/samples/*/*/trace.jsonl
```

`web_fetch` uses the proxy and is unrelated to the shim. Therefore a 200 response
from `web_fetch` does not prove that search works.

## 6. Prompt: the upstream runner prepends a prefix

Upstream `eval/run_batch.py` adds a 277-character prefix to every user prompt,
including the task's `timeout_seconds`. Despite the variable name
`system_prompt`, this content belongs to the user message. The adapter retains
the prefix so exported prompts match upstream byte for byte. Omitting it would
change the input to all 60 tasks.

## 7. `## Workspace Path` is not the Agent workspace

```
<declared>/
├── exec/    # seed files; the Agent's working directory (present in 60/60 tasks)
├── tmp/     # warmup fixtures (present in 5 tasks) → files.context, placed in <workspace>/tmp
└── gt/      # ground truth (present in 26 tasks) → bench.grade.stage, copied into the container only for grading
```

Mounting the entire `<declared>` directory adds an unwanted path level: skills
and warmup refer to `/tmp_workspace/utils.py`, but the file is located under
`/tmp_workspace/exec/`. It also exposes `gt/` to the Agent. Setting `workspace`
to `<declared>/exec` isolates the answers through the mount layout, without
filtering individual files. The adapter also sets `runtime.workspace_path` to
`/tmp_workspace` on every row, so each Harness works in the directory that task
prompts and graders address by absolute path.

## 8. Section mapping

| Upstream section | Maps to |
| --- | --- |
| `## Prompt` | `prompt` (with the §6 prefix prepended) |
| `## Env` | `runtime.env` and `bench.grade.env` |
| `## Warmup` | `runtime.setup` (after the §5 shim wiring) |
| `## Skills` | `files.context` entries with `role: skill` |
| `## Workspace Path` | See §7 |
| `## Automated Checks` | `bench.grade.code` |
| frontmatter `timeout_seconds` | `timeout_seconds` |

## 9. Known pitfalls

- An image may preset `http_proxy`. For example, `wildclawbench-ubuntu:v1.3`
  sets it without a matching `no_proxy`. Requests to a self-hosted gateway
  may time out, leaving `request_count=0` and all tasks exiting in the same
  second. Use the `*_INNER` proxy settings in WCB's `.env`; its
  `NO_PROXY_INNER` includes intranet addresses. A failed `curl` inside the
  container does not by itself prove the service is unreachable: OpenClaw's
  HTTP client does not read `http_proxy` and may still connect.
- The output budget must cover reasoning. Models that return
  `reasoning_content` generate it before the answer. A small `maxTokens` may
  yield `finish_reason: length` with empty `content`. In an existing test,
  the same model returned an empty answer at `max_tokens=16` and finished
  normally at 400. Set `maxTokens` in `--model-config` to allow for long tasks.
- `SEARCH_SHIM_CERT` is a relative path in the upstream `.env` (relative to
  the WCB checkout root). Roller resolves it against `ROOT` at export. If it is passed
  into the container with `--pass-env`, the relative path has no meaning inside the container.
- Do not use `info.json` `status` alone to calculate the failure rate.
  `bench report` reads `score.json`. Of four common `status: error` cases,
  three still have valid scores: images in observations, timeouts during tool
  calls, and a final turn with only a tool call and no closing text. See
  [Bench integration and scoring §3.2](/roller/benches/bench-format/#32-a-grading-failure-is-not-a-0-score).
- WildClawBench rows set `bench.grade.grade_on_agent_failure`, so a sample whose
  Agent timed out or exited with an error is still graded on the live workspace,
  as the upstream runner does. The task grader decides its score.
