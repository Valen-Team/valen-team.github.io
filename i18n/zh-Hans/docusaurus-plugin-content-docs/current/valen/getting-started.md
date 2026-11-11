---
title: "第一次调用"
---

# 无需下载模型的第一次调用

Valen 对给定候选进行打分，适用于文本、图片和视频。第一次尝试使用托管 API，无需本地权重或训练环境；可用性与配额由服务决定。

```bash
curl https://api.valen-team.workers.dev/v1/decisions \
  -H 'Content-Type: application/json' \
  -d '{"model":"valen-2b","input":"A cat is on the sofa.","questions":[{"name":"cat","type":"predicate","instructions":"A cat is present."}]}'
```

读取 `answers[0].probability`，它是模型对该陈述的概率。[模型列表](./api/list-models.md)可确认当前可用的模型 ID；认证、限制和错误见 [API](./api.md)。

下一步：[选择尺寸、格式和后端](./choosing.md)、[使用概率](./probabilities.md)，或进入完整的 [Cookbook 工作流](/zh-Hans/cookbook/)。本地权重是可选路径，下载体积可能较大。

托管 API 以 `valen-0.8b`、`valen-2b`、`valen-4b` 提供 Valen-Decision-1.5 0.8B、2B 和 4B；本页使用 `valen-2b`。9B 和 27B 通过[下载权重](./choosing.md)运行。
