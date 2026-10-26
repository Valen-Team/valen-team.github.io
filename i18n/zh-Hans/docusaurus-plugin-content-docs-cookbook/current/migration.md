---
title: 旧内容迁移表
---

# 维护入口与迁移对应表

四份 Notebook 是两套教程的中英文版本，不是四个不同应用。以下表格区分重复内容和独有内容。完整教程、代码及 JSON 样例数据只在官网仓库维护；API 与部署文档继续维护各自的参考信息。

| 旧来源 | 处理与保留价值 | 新维护入口 |
| --- | --- | --- |
| `Valen/https://valen-team.github.io/cookbook/api-quickstart/` | 保留 API 配置、文本、图片、视频抽帧三个例子；移除仅用于 Notebook 的展示依赖 | [API 入门](../api-quickstart/) |
| `Valen/https://valen-team.github.io/zh-Hans/cookbook/api-quickstart/` | 中文译本，与英文共享可执行源文件 | [中文 API 入门](/zh-Hans/cookbook/api-quickstart/) |
| `Valen/https://valen-team.github.io/cookbook/local-inference/` | 保留原版加载、双协议、choice/predicate/score、直接视频与独有动作问题；补充 ONNX 分支 | [本地推理基础](../local-inference/) |
| `Valen/https://valen-team.github.io/zh-Hans/cookbook/local-inference/` | 中文译本，与英文共享源文件及实际输出 | [中文本地推理基础](/zh-Hans/cookbook/local-inference/) |
| 官网 `/docs/valen/quickstart/` 及中文页 | 原有完整图片/视频教程移入 Cookbook；保留安装、模型加载、最短协议调用、execution/temperature 说明；原路由继续有效 | [本地推理基础](../local-inference/) |
| 官网 API 参考与主页三个互动示例 | 协议/字段/错误/最短请求保留；互动示例引用 Cookbook 的样例 JSON，中文交互文案继续保留；不再维护独立完整教程 | [API 入门](../api-quickstart/) 与 API 参考 |
| 主仓库 README、中英文 inference/data-format、官网 resources/overview 与旧博客引用 | 更新可控制的 Notebook 链接；部署说明与训练数据格式文档保留 | 本目录与相应基础教程 |
| Python/JavaScript SDK README 的多问题业务讲解和媒体操作步骤 | 应用解释改为 Cookbook 链接；安装、短调用、后端选项、浏览器集成与底层媒体接口示例仍在 SDK 仓库 | [工单分流](../ticket-routing/)、[图片筛选](../product-screening/)、[视频标注](../video-tagging/) |
| C++ SDK | 没有旧 Notebook 的完整应用正文；保留其独有的 SystemOne 文本 C++ 集成示例并补充 Cookbook 入口 | Cookbook 与 C++ SDK 文档 |
| HF 0.8B/2B/4B 原版模型卡的完整图片/视频步骤 | 移除重复教程，保留最短文本调用、模型配置、协议和下载/训练信息 | [本地推理基础](../local-inference/) |
| HF ONNX/GGUF 双语模型卡 | 保留各格式独有安装、图/权重限制、质量评测与启动命令；业务流程统一链接至 Cookbook | Cookbook 与后端部署文档 |
| `Valen-API` 演示应用 | 保留其独有浏览器交互与打包素材；更正来源链接；演示不是另一份维护的应用教程 | 官网 Cookbook |
| `Valen/assets/cookbook/` | 图片/视频是 SDK 等仍使用的共享素材；保留稳定 URL，不随 Notebook 删除 | 原素材 URL |

新增工单分流复用原文本意图题，并补充审核与排序；图片筛选复用羊群题，用两个商品声明展示匹配与不匹配；视频标注复用酱汁颜色题并保留帧位置。未将同一段调用换标题凑成多个案例。

## 旧链接的限制

官网可控制的链接已切换为新入口；`/docs/valen/quickstart/` 作为部署参考继续保留。官网同时提供旧文件名风格的便利跳转（例如 `/cookbook/api_quickstart/`）。GitHub 上已删除 `.ipynb` 的旧 URL **不能由官网重定向**。请更新书签和外部引用；历史提交中的 Notebook 属于历史快照，不作为现行教程维护。

删除顺序是：迁移内容 → 构建及链接检查 → 官网部署与在线验证 → 删除旧 Notebook。旧目录最多保留简短迁移 README。迁移与发布状态以 [验证记录](../validation/) 为准。

## 维护源

- 文章：官网仓库 `cookbook/` 与 `i18n/zh-Hans/docusaurus-plugin-content-docs-cookbook/current/`。
- 可执行脚本与样例：官网仓库 `static/cookbook/code/`；网页直接 import，ZIP 从源文件生成。
- 真实执行输出：`static/cookbook/results.json`；原始验证记录与性能报告可从验证页下载。
- 主仓库与 SDK/HF 只链接完整流程，不复制业务教程。
