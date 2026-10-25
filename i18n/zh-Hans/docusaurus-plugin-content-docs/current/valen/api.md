---
title: API 调用
sidebar_label: API 调用
---

# API 调用

托管 API 和本地部署支持两种协议：

| 接口 | 方法 | 路径 | 文档 |
|---|---|---|---|
| System One | POST | `/v1/systemone` | [接口参考](./api/systemone.md) |
| Decisions | POST | `/v1/decisions` | [接口参考](./api/decisions.md) |

托管服务还提供模型列表接口：

| 接口 | 方法 | 路径 | 文档 |
|---|---|---|---|
| List Models | GET | `/v1/models` | [接口参考](./api/list-models.md) |

## 服务地址

| 入口 | Base URL | 请求头 |
|---|---|---|
| 免费 API | `https://api.valen-team.workers.dev` | 无需 Key |
| API Key | `https://llm-proxy.openxxlab.com` | `Authorization: Bearer $VALEN_API_KEY` |

如需申请 API Key 或提高调用额度，请邮件联系 [liuziyu77@sjtu.edu.cn](mailto:liuziyu77@sjtu.edu.cn)。

本地服务的模型名与图片输入格式见：[SGLang](./sglang.md) · [vLLM](./vllm.md) · [Transformers](./quickstart.md)。

应用内接入见 [ONNX 与 SDK](./onnx.md)，包含 Python 本地 ONNX 服务和 Python / JavaScript HTTP 客户端示例。
