---
title: "WildClawBench"
---

# WildClawBench

60 个真实场景 OpenClaw 任务，6 个类别。上游：<https://github.com/InternLM/WildClawBench>。

本页介绍 WildClawBench 的上游参数、对应的 Roller 配置，以及尚未支持的设置。
bench 层通用机制（`bench` 块、grading 时序、`stage` 防泄漏、聚合口径）见
[Bench 接入与评分](/roller/benches/bench-format/)。

## 1. 最短路径

```bash
# 1) 检出上游仓库
git clone https://github.com/InternLM/WildClawBench ~/WildClawBench

# 2) 按原有方式 source 上游的环境变量；Roller 复用同一批变量名，见 §3
set -a; . ~/WildClawBench/.env; set +a

# 3) 一键转换 + 采集 + 判分 + 汇总
roller collect --bench wildclawbench --bench-root ~/WildClawBench \
  --model <provider>/<model> \
  --harness openclaw --openclaw-image wildclawbench-ubuntu:v1.3 \
  --model-config my_api.json --parallel 4 \
  --output /tmp/wcb --run-name run1 \
  --pass-env NODE_EXTRA_CA_CERTS
```

任务快照与报告分别保存在 `run1/tasks.jsonl` 和 `run1/bench-report.json`。

同一次运行也可以写成 YAML 文件，并通过 `roller bench run` 启动，见
[Benchmark 运行配置](/roller/benches/benchmark-standard/)：

```bash
roller bench run --config examples/benchmarks/base.yaml \
  --extra-config examples/benchmarks/wildclawbench.yaml
```

## 2. 上游参数 → Roller 对应项

`eval/run_batch.py` 的 CLI 参数：

| 上游 | Roller | 备注 |
| --- | --- | --- |
| `--task` / `--category` | `collect --bench-task-id` / `--bench-category` | Roller 中两者均可重复传入；无效的 id 会报错，不会静默产生空运行 |
| `--model` | `collect --model` | 可重复，多模型笛卡尔展开 |
| `--parallel` | `collect --parallel` | |
| `--agent-backend` | `collect --harness` | adapter 写入 `openclaw`；`codex`/`claude-code`/`hermes` 可用 `--harness` 覆盖，原 `hermesagent` 可使用 `--harness hermes` |
| `--models-config` | `collect --model-config` | 两者均支持 `${ENV}` 展开 |
| `--thinking` | `collect --thinking` | adapter 不在 task 中固定 thinking，避免覆盖命令行设置 |
| `--lobster-env` | `collect --pass-env` | |
| `--lobster-name` | `collect --run-name` | 仅影响产物目录名 |
| `--global-parallel` | 无（Roller 只有一个全局池） | 相当于始终启用上游的 `--global-parallel`；上游默认按类别串行执行，完成一个池后再执行下一个 |
| `--lobster-workspace` | 未支持 | 上游用于注入 SOUL.md / USER.md 等角色配置。Roller 中须在 task 的 `files.context` 中显式声明 |
| `--openclaw-image-model` | 部分：`--set-image-model` / `--no-set-image-model` | Roller 支持使用同一个 chat model 或不设置 image model，暂不支持为 image tool 单独指定模型 |

环境变量（`.env`）：

| 上游 | Roller | 备注 |
| --- | --- | --- |
| `DOCKER_IMAGE` | `collect --openclaw-image` | |
| `GATEWAY_PORT` | `collect --gateway-port` | Roller 另提供 `--gateway-port-step`，用于错开并行 worker |
| `TASKS_SUBDIR` | `bench export` 的 `ROOT` 位置参数 | 也可传入 `<root>/tasks_x25`：若 `ROOT/tasks` 存在则使用该目录，否则将 `ROOT` 本身作为任务目录 |
| `OUTPUT_SUBDIR` | `collect --output` + `--run-name` | |
| `DEFAULT_MODEL` / `DEFAULT_PARALLEL` | 无默认值机制 | 显式传入 `--model` / `--parallel` |
| `HTTP_PROXY_INNER` / `HTTPS_PROXY_INNER` / `NO_PROXY_INNER` | 宿主机 `http_proxy` / `https_proxy` / `no_proxy` | OpenClaw harness 默认透传这些变量名，见 §3 |
| `BRAVE_API_KEY` | 同名，默认透传 | 同时用作 search shim 的 token |
| `SEARCH_SHIM_HOST_IP` / `SEARCH_SHIM_HOSTNAME` / `SEARCH_SHIM_CERT` | export 时读取同名变量 | 见 §5 |
| `OPENROUTER_API_KEY` / `OPENROUTER_BASE_URL` / `JUDGE_MODEL` | 同名 | 46/60 个任务的 grader 依赖这些变量评分，见 §3 |
| `WILDCLAW_TIMEOUT_MULTIPLIER` | export 时读取同名变量 | 见 §4 |

## 3. 环境变量如何进入容器

环境变量通过三种方式进入容器：

| 来源 | 缺失时 |
| --- | --- |
| 任务 `## Env` → `runtime.env`（名字清单） | 任务失败，报错 `requires missing environment variable X` |
| OpenClaw harness 默认清单（`OPENROUTER_*`、`BRAVE_API_KEY`、`TAVILY_API_KEY`、大小写两种形式的 proxy 变量） | 静默跳过（值为空时不传递） |
| `--pass-env NAME` | 静默跳过 |
| `bench.grade.env`（同样来自 `## Env`） | 仅警告：`grading environment variable X is unset` |

评分时，host 环境变量通过 `-e` 传给 `docker exec`，无需额外设置 `--pass-env`。

60 个任务中有 46 个由 judge 评分。比较两个 run 前，应确认 `OPENROUTER_BASE_URL`
和 `JUDGE_MODEL` 一致；不同的评分网关或 judge 模型会影响分数可比性。

## 4. 超时

每个任务自带 `timeout_seconds`（实测 300/360/600/900/1200 五档），因此
必须启用 `--task-timeouts`，否则所有任务均回退到单一的 `--timeout`。

如需延长超时，请设置与上游同名的环境变量，该变量在 export 时读取：

```bash
WILDCLAW_TIMEOUT_MULTIPLIER=2 roller bench export wildclawbench ~/WildClawBench -o /tmp/wcb_x2.jsonl
```

取值为 `ceil(base × multiplier)`，与上游 `tools/run_with_timeout_multiplier.py` 一致；
非法值（非数字、0、负数）会直接报错，不会静默按 1× 运行。

`--timeout` 不能替代超时乘数。上游乘数修改任务文件中的 `timeout_seconds`，
该值也会写入 prompt 前缀（§6），使提示中的时间预算与实际时限一致。
`--timeout` 仅改变实际时限，例如 Agent 可能被告知有 300 秒，实际却有 600 秒。
Adapter 在构建任务行之前应用乘数，prompt 和运行配置使用同一个调整后的值。

## 5. Search：上游不调用真实的 Brave

上游将 `api.search.brave.com` 指向本地 shim，该 shim 兼容 Brave 协议并使用 Serper 后端
（`tools/serper_brave_shim.py`，443 端口自签 TLS），通过 `docker run --add-host` 和挂载的
证书实现。Roller 没有 `--add-host` 或额外挂载参数，因此 adapter 通过两条
`runtime.setup` 命令完成相同配置，以 root 身份在 Agent 启动前执行：

1. 向 `/etc/hosts` 写入 `<SEARCH_SHIM_HOST_IP> <SEARCH_SHIM_HOSTNAME>`；
2. 将 `SEARCH_SHIM_CERT` 的内容内联写入
   `/usr/local/share/ca-certificates/wildclaw-search-shim.crt`，运行
   `update-ca-certificates`，并追加到 certifi 的 bundle（requests/httpx 不读取系统证书库）。

这些设置在 export 时读取，名称和默认值与上游相同。`SEARCH_SHIM_CERT` 的相对路径
按 checkout 根目录解析，因此 export 前应先 source `.env`。未配置时会跳过，并记录日志。

OpenClaw 的 `web_search` 通过 Node 发起请求，Node 不读取系统证书库，因此还需要设置：

```bash
export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/wildclaw-search-shim.crt
roller collect ... --pass-env NODE_EXTRA_CA_CERTS
```

缺少这一步时，每次搜索都会返回
`{"status":"error","tool":"web_search","error":"fetch failed"}`，但 Agent 仍会继续执行，
run 也会产生分数。运行后可用以下命令检查搜索是否失败：

```bash
grep -c '"toolName": "web_search"' <run>/samples/*/*/trace.jsonl
grep -c 'fetch failed'             <run>/samples/*/*/trace.jsonl
```

`web_fetch` 经由 proxy 访问，与 shim 无关，因此"`web_fetch` 返回 200"不能证明搜索可用。

## 6. Prompt：上游 runner 会添加前缀

上游 `eval/run_batch.py` 在每个任务的 user prompt 前添加一段 277 字符的前缀，
其中写入该任务的 `timeout_seconds`。变量虽然名为 `system_prompt`，内容仍属于 user 消息。
Adapter 保留这段前缀，使导出的 prompt 与上游逐字节一致；遗漏它会改变全部 60 个任务的输入。

## 7. `## Workspace Path` 不是 Agent 的工作目录

```
<declared>/
├── exec/    # 种子文件 —— 这才是 Agent 的工作目录（60/60 个任务都有）
├── tmp/     # warmup 用的 fixture（5 个任务有）→ files.context，落到 <workspace>/tmp
└── gt/      # ground truth（26 个任务有）→ bench.grade.stage，评分时才进容器
```

挂载整个 `<declared>` 目录会使种子文件多出一层路径：skill 和 warmup 引用
`/tmp_workspace/utils.py`，文件却位于 `/tmp_workspace/exec/` 下。同时，Agent 会获得
读取 `gt/` 的权限。因此 `workspace` 指向 `<declared>/exec`，通过挂载范围隔离答案，
无需再过滤文件。Adapter 同时为每个 task 设置 `runtime.workspace_path` 为
`/tmp_workspace`，各 Harness 的工作目录与任务 prompt 和 grader 中的绝对路径一致。

## 8. 段落映射总表

| 上游段落 | 映射到 |
| --- | --- |
| `## Prompt` | `prompt`（前置 §6 的前缀） |
| `## Env` | `runtime.env` 和 `bench.grade.env` |
| `## Warmup` | `runtime.setup`（位于 §5 的 shim 配置之后） |
| `## Skills` | `files.context` 的 `role: skill` 条目 |
| `## Workspace Path` | 见 §7 |
| `## Automated Checks` | `bench.grade.code` |
| frontmatter `timeout_seconds` | `timeout_seconds` |

## 9. 已知问题

- 镜像可能预设 `http_proxy`。例如 `wildclawbench-ubuntu:v1.3` 设置了代理，却未配置
  `no_proxy`，可能使自建 gateway 的请求超时，出现 `request_count=0` 和全部任务
  在同一秒退出的情况。可使用 WCB `.env` 中的 `*_INNER` 代理配置，其 `NO_PROXY_INNER`
  已包含内网地址。容器内 `curl` 请求失败也不能单独证明服务不可达：OpenClaw 的 HTTP
  客户端不读取 `http_proxy`，可能仍能连接。
- 输出预算需要覆盖 reasoning。返回 `reasoning_content` 的模型先生成推理，再生成正文。
  `maxTokens` 过小时可能返回 `finish_reason: length` 和空 `content`。已有测试中，
  同一模型在 `max_tokens=16` 时 `content` 为空，设为 400 后正常结束。
  应按长任务需求设置 `--model-config` 中的 `maxTokens`。
- `SEARCH_SHIM_CERT` 在上游 `.env` 中是相对路径（相对于 WCB checkout 根目录）。
  Roller 在 export 时按 `ROOT` 解析该路径；若通过 `--pass-env` 将其传入容器，该
  相对路径在容器内没有意义。
- 不能仅凭 `info.json` 的 `status` 统计失败率。`bench report` 读取 `score.json`。
  四种常见的 `status: error` 情况中，有三种仍有有效分数：observation 包含图片、
  工具调用中途超时、末轮只有工具调用而没有收尾文本。见
  [Bench 接入与评分 §3.2](/roller/benches/bench-format/#32-grading-失败--0-分)。
- WildClawBench 的 task 设置了 `bench.grade.grade_on_agent_failure`：Agent 超时或
  报错退出后，Roller 仍对存活的 workspace 评分，与上游 runner 一致。分数由任务
  grader 决定。
