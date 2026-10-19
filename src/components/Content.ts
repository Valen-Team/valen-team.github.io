import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export function useChinese() { return useDocusaurusContext().i18n.currentLocale === 'zh-Hans'; }

export const projects = [
  {name: 'Valen', kind: 'model' as const, category: ['DECISION MODELS', '决策模型'], description: ['A multimodal System One model. Text, images, and video in. Decision probabilities out.', '多模态 System One 模型。理解文本、图片与视频，输出候选决策的概率。'], detail: ['Open weights in 0.8B, 2B, and 4B. Tools for inference, training, and evaluation.', '开放 0.8B、2B、4B 模型权重，提供推理、训练与评测工具。'], tags: ['0.8B · 2B · 4B', 'Text / Image / Video'], docs: '/docs/valen/', repo: 'https://github.com/Valen-Team/Valen', resource: 'https://huggingface.co/Valen-Team', action: ['Explore models', '浏览模型']},
  {name: 'JevalKit', kind: 'tool' as const, category: ['EVALUATION TOOLKIT', '评测工具'], description: ['A common ground for decision models. Evaluate, compare, and understand their decisions.', '为决策模型提供统一的评测接口。运行评测、比较结果，理解模型的决策表现。'], detail: ['Unified model interfaces, prepared datasets, and reproducible scoring protocols.', '统一模型接口、即用数据集与可复现的评分协议。'], tags: ['8 benchmark families', '20 model families'], docs: '/docs/jevalkit/', repo: 'https://github.com/Valen-Team/JevalKit', resource: 'https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard', action: ['View leaderboard', '查看排行榜']},
];

export const updates = [
  {date: '2026-10-19', type: ['TOOLING', '工具发布'], title: ['Introducing the JevalKit Leaderboard', 'JevalKit Leaderboard 正式发布'], description: ['Compare decision models across benchmarks, explore probability metrics, and download results.', '跨 Benchmark 比较决策模型，查看概率指标并下载评测结果。'], slug: '/news/jevalkit-leaderboard/'},
  {date: '2026-10-13', type: ['RELEASE', '版本更新'], title: ['More ways to run Valen: API, ONNX, and GGUF', '通过 API、ONNX 和 GGUF 使用 Valen'], description: ['New deployment formats and an API cookbook make it easier to bring decisions into your applications.', '新增部署格式与 API Cookbook，更方便地将决策能力接入应用。'], slug: '/news/valen-deployment/'},
  {date: '2026-10-07', type: ['MODELS & DATA', '模型与数据'], title: ['Valen 0.8B, 2B, and 4B — now with vision', 'Valen 0.8B、2B、4B：让决策看见世界'], description: ['Open multimodal decision models and VisualDecisionBench for image and video evaluation.', '开放多模态决策模型，以及用于图像与视频决策评测的 VisualDecisionBench。'], slug: '/news/valen-multimodal/'},
];
