---
title: "VIALS"
---

# VIALS

VIALS bench 适配器运行 [VIALS](https://huggingface.co/datasets/handshake-ai-research/VIALS) `tasks` 配置 `test` split 的 161 道科学图像题，支持工具辅助代码执行，在采集进程内通过 LLM judge 判分，并报告 `pass^k`、`avg@k` 和 `pass@k`。

可运行的 Cookbook 位于 [`examples/cookbook/vials-stirrup`](https://github.com/Valen-Team/Roller/tree/main/examples/cookbook/vials-stirrup)。

## 1. 环境准备

安装带有 `vials` extra 的 Roller（使用默认 Stirrup Harness 时需 Python 3.12+ 并同时安装 `stirrup`）：

```bash
pip install 'roller-agent[stirrup,vials]'
```

从 Roller 仓库的 `docker/vials` 目录构建工具镜像（包含 Python 3.13、题目提示词提到的 11 个科学计算 Python 库以及 Tesseract OCR）。如果仅通过 PyPI 安装了 `roller-agent`，请先克隆仓库获取 `docker/vials`：

```bash
git clone https://github.com/Valen-Team/Roller.git
cd Roller
docker build -t roller-vials docker/vials
```

Roller 会按固定的 Hugging Face revision 将数据集下载缓存到 `--bench-root` 并在每个 task 中记录 revision；设置 `VIALS_REVISION` 可切换版本。

## 2. 协议与执行

- **默认 Harness**：`stirrup`。
- **工作区**：每道题的图片位于 `/task`，Agent 需将最终答案写入 `/task/answer.txt` 的 `ANSWER:` 行。
- **离线容器执行**：任务容器以 `--network none` 运行。Stirrup 的 Agent 循环与模型请求都在 Roller 宿主机进程内完成，代码执行在无网容器内隔离运行。
- **采集端判分**：VIALS 通过 `bench.grade.collector_files` 取回 `/task/answer.txt` 并在 Roller 进程内调用 judge，judge 密钥不进入容器。

```bash
export OPENAI_API_KEY='...'
export JUDGE_BASE_URL='https://api.openai.com/v1'
export JUDGE_API_KEY='...'

mkdir -p ./vials-data

roller collect \
  --bench vials \
  --bench-root ./vials-data \
  --harness stirrup \
  --stirrup-image roller-vials \
  --network none \
  --model my-model \
  --api-base http://localhost:8000/v1 \
  --samples 3 \
  --output runs \
  --run-name vials-run

roller bench report runs/vials-run
```

## 3. 判分与指标

judge 会对比提取出的答案与参考答案（计数题包含可接受的数值范围）。若 judge 推理以 `UNVERIFIABLE:` 开头，Roller 会附上题目图片再次询问。缺少 `answer.txt` 或没有 `ANSWER:` 行直接计 `0` 分，不调用 judge。

可通过 `JUDGE_MODEL`、`JUDGE_REASONING_EFFORT`、`JUDGE_MAX_TOKENS`（或带 `VIALS_` 前缀的同名变量）覆盖 judge 配置。judge 调用失败的 sample 保持未评分状态，执行 `roller collect --resume` 会重新判分。

每题采样 `k` 次（Cookbook 默认 3 次）后，`roller bench report` 输出：

- `pass^k`：全部 `k` 次采样均答对的题目占比
- `avg@k`：答对 sample 的占比
- `pass@k`：至少有 1 次采样答对的题目占比
