---
title: "ZeroBench"
---

# ZeroBench

ZeroBench bench 适配器运行 [ZeroBench](https://huggingface.co/datasets/jonathan-roberts1/zerobench)，将题目图片作为文件放入 `/task`，供 Agent 使用工具裁剪、增强并查看。评分采用官方严格的 `{final answer}` 提取与匹配规则，不需要外部 judge 模型和额外环境变量。

可运行的 Cookbook 位于 [`examples/cookbook/zerobench-claude-code`](https://github.com/Valen-Team/Roller/tree/main/examples/cookbook/zerobench-claude-code)。

## 1. 环境准备

安装带有 `zerobench` extra 的 Roller：

```bash
pip install 'roller-agent[zerobench]'
```

Roller 通过 `datasets` 按固定 Hugging Face revision 读取数据集并在 task 中记录 revision（可通过 `ZEROBENCH_REVISION` 覆盖），题目图片写入 `--bench-root`。离线宿主机可预先准备好 `HF_HOME` 缓存并导出 `HF_HUB_OFFLINE=1 HF_DATASETS_OFFLINE=1`。

## 2. 变体与执行

- **`--bench-variant zerobench`**：100 道主问题。
- **`--bench-variant zerobench_subquestions`**：334 道视觉子问题。
- **默认 Harness**：`claude-code`（支持 Docker 以及通过 `--sandbox-provider` / `--sandbox-template` 在远程沙箱运行）。

```bash
export ANTHROPIC_API_KEY='...'

mkdir -p ./zerobench-data

roller collect \
  --bench zerobench \
  --bench-variant zerobench \
  --bench-root ./zerobench-data \
  --harness claude-code \
  --model my-model \
  --api-base http://localhost:8000 \
  --samples 5 \
  --output runs \
  --run-name zerobench-main

roller bench report runs/zerobench-main
```

在无外网出口的远程沙箱中采集时，使用实现 `route_http` 的 provider 将 Claude Code 请求转回宿主机代理，即可照常使用 `--wire-trace full`、`--capture-calls` 和 `--token-ids`。`--claude-sandbox-binary`、`--claude-context-window` 和 `--claude-tool-images-inline` 详见 [Claude Code Harness 指南](/roller/harnesses/claude-code-configuration/)。

## 3. 判分与指标

评分器从 Agent 最终回复中提取最后一个 `{...}` 分组并执行 ZeroBench 官方严格匹配规则，不依赖外部 judge 服务。

每题采样 `k` 次（论文中为 5 次）后，`roller bench report` 报告 `avg@k` 和 `pass@k`。
