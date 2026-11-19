---
title: "四个模型、四种 Harness 采集 WildClawBench"
description: "用 OpenClaw、Codex、Claude Code 和 DeepSeek Harness 采集、评分并浏览四个自部署模型的 WildClawBench 轨迹。"
---

# 四个模型、四种 Harness 采集 WildClawBench

本案例使用 DeepSeek-V4.1-Flash-1017、GLM-5.3-Flash、Kimi K3 和 Kimi K3.1 Pro，
每组模型与 Harness 组合运行相同的 28 个任务，每题三次。数据集覆盖 OpenClaw、
Codex、Claude Code 和 DeepSeek Harness，共 1,344 条轨迹。Roller 负责启动隔离环境、
保存会话、评分和导出，结果可以直接在 HF 的轨迹查看器中浏览。

可以[浏览公开轨迹](https://huggingface.co/datasets/Valen-Team/Roller-WildClawBench-Trajectories)，
也可以使用[可运行示例](https://github.com/Valen-Team/Roller/tree/main/examples/cookbook/wildclawbench-open-models)
采集自己的模型。

| 项目 | 设置 |
| --- | --- |
| 任务 | 28 个依赖本地素材及任务自带模拟服务的 WildClawBench 任务 |
| 重复次数 | 每模型每题 3 次，每组 84 条，每种 Harness 共 336 条 |
| 模型 | DeepSeek-V4.1-Flash-1017、GLM-5.3-Flash、Kimi K3、Kimi K3.1 Pro |
| Harness | OpenClaw 2026.3.11、Codex CLI 0.149.0 和 Claude Code 2.1.222、DeepSeek Harness 0.1.5rc1 |
| Judge | 四种 Harness 均使用 GLM-5.3-Flash |
| 时限 | 原题超时；评分 120 秒；Roller 层不重试 |
| 并发 | 每模型 8 个 rollout；同时运行的采集作业共享 2 个评分槽位 |

## 批次

16 组模型与 Harness 组合各包含 84 次尝试。数据集卡片记录版本和设置。
对照图用全部尝试计算均分，缺分计零。轨迹表将缺分保留为 null，并记录运行状态和评分错误。

## 1. 准备环境

从 Git 检出并安装 Roller。Docker 采集需要运行中的 Docker，E2B 采集需要 Python 3.11 或更高版本。

```bash
git clone https://github.com/Valen-Team/Roller.git
cd Roller
pip install -e .
```

下载 [WildClawBench](https://github.com/InternLM/WildClawBench) 及任务素材，进入示例目录：

```bash
cd examples/cookbook/wildclawbench-open-models
export WILDCLAWBENCH_ROOT=~/WildClawBench
```

公开镜像保留 benchmark 的任务环境：

```bash
docker pull ghcr.io/valen-team/roller-wildclaw-base:1.3-clean.1
docker pull ghcr.io/valen-team/roller-wildclaw-codex:1.3-codex0.149.0
docker pull ghcr.io/valen-team/roller-wildclaw-claude-code:1.3-claude2.1.222
```

基础镜像移除了原镜像中的个人构建凭据和身份状态，发布层不包含原敏感历史层；
Codex 派生镜像增加 CLI、Node.js 和 ripgrep。Claude Code 镜像在新容器里首次调用时
从 npm registry 安装固定版本的 CLI。Roller 从 benchmark 检出目录放入原始题目文件及刻意设置的测试 key。构建方法见
[镜像说明](https://github.com/Valen-Team/Roller/tree/main/docker/wildclawbench)。

## 2. 设置 Judge

评分器使用兼容 OpenAI Chat Completions 的服务：

```bash
export OPENROUTER_BASE_URL=http://localhost:8001/v1
export OPENROUTER_API_KEY=not-required
export JUDGE_MODEL=glm-5.3-flash
```

把地址和 key 换成自己的服务。如果配置了代理，将内网服务主机加入 `NO_PROXY`。
Roller 会为匹配已配置网段的评分端点补上具体主机，使 HTTPX 也能正确绕过代理。

## 3. 使用 Codex 采集

模型服务需要支持 Responses，包括流式返回、工具调用和图片。模型 ID 使用服务实际提供的名称：

```bash
export MODEL=glm-5.3-flash
export OPENAI_BASE_URL=http://localhost:8000/v1
export OPENAI_API_KEY=not-required
export MODEL_CONTEXT_WINDOW=98304
export RUN_NAME=wildclawbench-codex-glm
./collect-codex.sh --dry-run
./collect-codex.sh
```

上下文长度按实际部署填写。换模型时修改 `MODEL`、端点和 `RUN_NAME`，不同调用可以并行运行。
每个调用的 worker 数和评分并发独立设置。

对于能接收用户图片、但会丢失工具返回图片的 Kimi K3.1 Pro 服务，
在运行脚本前设置 `TOOL_IMAGES_AS_USER=1`：Roller 保留工具文本，
将原样的图片字节附到后续用户消息。其他原生支持工具图片的后端保持关闭即可。
详见 [Codex 配置](/roller/harnesses/codex-configuration/)。

先检查一条真实任务时，可以指定单独的任务列表和重复次数：

```bash
printf '%s\n' 05_Creative_Synthesis_task_10_social_poster_multi_crop > one-task.txt
TASK_IDS_FILE="$PWD/one-task.txt" RUNS_PER_TASK=1 PARALLEL=1 \
  RUN_NAME=wildclawbench-codex-check ./collect-codex.sh
```

## 4. 使用 OpenClaw 采集

调整 `models.json` 中的模型 ID 和上下文长度。示例包含同一个 Chat Completions 服务中的四个模型：

```bash
export ROLLER_INFER_BASE_URL=http://localhost:8000/v1
export ROLLER_INFER_API_KEY=not-required
./collect.sh --dry-run
./collect.sh
```

不同模型使用不同端点时，在 `models.json` 中分别定义 provider。
示例的每次响应输出上限为 32,768 token，思考强度沿用服务端配置。公开批次采用：

| 模型 | 服务配置 |
| --- | --- |
| DeepSeek-V4.1-Flash-1017 | vLLM、DSpark=5、Engram CPU offload；开启思考，effort 100 |
| GLM-5.3-Flash | vLLM、MTP=5；reasoning effort max |
| Kimi K3 | vLLM、DSpark=8；thinking effort max |
| Kimi K3.1 Pro | SGLang、DFLASH 宽度 5；reasoning effort max |

Codex 批次保留这些后端默认值，并使用 32,768 token 响应上限。新采集可以使用自己服务支持的设置。

## 5. 使用 Claude Code 采集

模型服务需提供 Anthropic Messages 接口，支持流式返回、工具调用和工具返回的图片。
模型 ID 使用服务实际提供的名称。

```bash
export MODEL=glm-5.3-flash
export ANTHROPIC_BASE_URL=http://localhost:8000
export ANTHROPIC_API_KEY=not-required
./collect-claude-code.sh --dry-run
./collect-claude-code.sh
```

试跑一题时，可以复用上文的 `one-task.txt`。

```bash
TASK_IDS_FILE="$PWD/one-task.txt" RUNS_PER_TASK=1 PARALLEL=1 \
  RUN_NAME=wildclawbench-claude-code-check ./collect-claude-code.sh
```

公开批次用预装同版本 CLI 的本地镜像采集，CLI 安装耗时没有计入任务时限。
用 `CLAUDE_CODE_IMAGE` 指定本地镜像。
构建方法见 [Roller 任务镜像说明](https://github.com/Valen-Team/Roller/tree/main/docker/wildclawbench)。

如果 Messages 网关拒绝 PDF `document` 块，在 Roller 检出目录运行
`pip install -e '.[pdf]'`，再给采集脚本加 `--claude-pdf-as-images`。
Roller 会发送逐页提取的文本和 PNG，并在 wire trace 中记录转发的请求。
需要让 Claude Code 提前压缩时，把 `CLAUDE_CODE_MAX_CONTEXT_TOKENS` 设为端点的上下文长度。

本批次的四个端点均使用 Messages，Claude Code 请求的输出上限为 32,000 token。
后端拒绝 PDF 的样本使用逐页转换补跑，GLM 上下文报错的样本按端点的 98,304 token
窗口补跑。每道题的每次重复在数据集中各有一行，包括应用这些设置后仍出现的错误和超时。

## 6. 使用 DeepSeek Harness 采集

模型服务需支持流式 Chat Completions 和工具调用。图像任务还需要支持图像输入的模型。

Docker 路径从 Roller 仓库根目录构建任务镜像，然后进入示例目录。

```bash
docker build --build-arg BASE_IMAGE=ghcr.io/valen-team/roller-wildclaw-base:1.3-clean.1 \
  -t roller-wildclaw-deepseek:1.3-deepseek0.1.5rc1 docker/deepseek
cd examples/cookbook/wildclawbench-open-models
export DEEPSEEK_IMAGE=roller-wildclaw-deepseek:1.3-deepseek0.1.5rc1
export MODEL=your-model-id
export MODEL_BASE=https://model.example/v1
./collect-deepseek.sh --dry-run
./collect-deepseek.sh --deepseek-profile sdk --deepseek-input-modalities text,image
```

使用 E2B 时，按[公开模板配方](https://github.com/Valen-Team/Roller/tree/main/docker/wildclawbench#e2b-template)安装 `.[e2b]` 并构建模板。在采集端设置 `E2B_API_KEY`、`SANDBOX_PROVIDER=e2b` 和 `SANDBOX_TEMPLATE`，再运行同一个脚本。模型端点和评分端点要能从 E2B 沙箱访问。首次试跑可用模板配方里的单题命令跑日历调度题。该题使用本地评分器，从 PyPI 安装预热依赖。

## 7. 查看和导出

```bash
roller view runs/wildclawbench-codex-glm
roller bench report runs/wildclawbench-codex-glm
roller export runs/wildclawbench-codex-glm --format hf --output dataset \
  --preserve-task-keys --redact-rules redact.json
```

每条可用轨迹都有表格记录和可浏览会话。成功且能够转换的样本还包含聊天格式字段；
失败样本可能只有部分会话。原始 run 保持不变。

`--preserve-task-keys` 保留题目中刻意放置的测试 key，同时继续替换已知的环境凭据、
采集端点和宿主机路径。按自己的环境调整 `redact.json`，查看导出内容后再发布。
详见[轨迹输出](/roller/traces/trajectory-outputs/#hugging-face-export)。

## 8. 追加到 HF 数据集

```bash
hf upload <owner>/<dataset> dataset . --repo-type dataset
```

将其他模型导出到同一目录即可增加对应分组。同一种 Harness、同一个模型再次采集时，
给新文件单独的批次名称，保留旧轨迹；附一份简短批次说明，记录日期、模型、版本、
题目范围和兼容设置。数据卡和结果表从同一份导出表更新。

本案例公开全部尝试及评分，暂不单独制作筛选后的 SFT 子集。
HF 提供浏览和下载，GitHub 提供代码与使用示例，GHCR 提供任务环境。
