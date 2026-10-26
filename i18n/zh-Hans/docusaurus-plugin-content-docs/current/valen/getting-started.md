---
title: "第一次调用"
---

# 无需下载模型的第一次调用

Valen 对给定候选进行打分，适用于文本、图片和视频。第一次尝试使用托管文本 API，无需本地权重或训练环境；可用性与配额由服务决定。

```bash
curl https://api.valen-team.workers.dev/v1/decisions \
  -H 'Content-Type: application/json' \
  -d '{"model":"valen-2b","input":"A cat is on the sofa.","questions":[{"name":"cat","type":"predicate","instructions":"A cat is present."}]}'
```

读取 `answers[0].probability`，它是模型对该陈述的概率，并非正确性保证。[模型列表](./api/list-models.md)可确认当前可用的模型 ID；认证、限制和错误见 [API](./api.md)。

下一步：[选择尺寸、格式和后端](./choosing.md)、[使用概率](./probabilities.md)，或进入完整的 [Cookbook 工作流](/zh-Hans/cookbook/)。本地权重是可选路径，下载体积可能较大。

2026-10-26 的文本检查中，免费服务 valen-2b / valen-4b 成功，列表中的 valen-0.8b 返回 403（当前服务凭据不允许）。因此本页默认用 valen-2b；这是服务可用性记录，不是模型质量或全部后端验证。
