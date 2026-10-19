import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {useChinese} from '../components/Content';
import {Arrow} from '../components/Icons';

export default function Benchmarks() {
  const zh = useChinese();
  return <Layout title="VisualDecisionBench" description={zh ? '用于图像与视频决策的多模态评测基准。' : 'A multimodal benchmark for image and video decision-making.'}><main className="site-container interior-page">
    <header className="page-intro"><p className="eyebrow">{zh ? '多模态决策评测' : 'EVALUATING MULTIMODAL DECISIONS'}</p><h1 className="benchmark-title">VisualDecisionBench</h1><p>{zh ? '模型理解了当前状态吗？它能选出有用的行动吗？用图像与视频任务，评测结构化决策。' : 'Does a model understand the state? Can it choose a useful action? Evaluate structured decisions grounded in images and video.'}</p></header>
    <div className="benchmark-facts"><div><strong>1,696</strong><span>{zh ? '共享状态' : 'shared states'}</span></div><div><strong>9,143</strong><span>{zh ? '评测问题' : 'evaluation questions'}</span></div><div><strong>2</strong><span>{zh ? '模态：图片与视频' : 'modalities: image & video'}</span></div></div>
    <div className="benchmark-actions"><a className="v-button primary-button" href="https://huggingface.co/datasets/Valen-Team/VisualDecisionBench">{zh ? '下载数据集' : 'Get the dataset'}<Arrow diagonal/></a><a className="v-link text-button" href="https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard">{zh ? '查看排行榜' : 'View leaderboard'}<Arrow diagonal/></a><Link className="v-link text-button" to="/docs/jevalkit/quickstart/">{zh ? '运行评测' : 'Run evaluation'}<Arrow/></Link></div>
    <div className="benchmark-body"><h2>{zh ? '一次评测，多种决策' : 'Several ways to make a decision'}</h2><p>{zh ? '完整发布集包含 2,000 个图像问题和 7,143 个视频问题，覆盖三类结构化决策。' : 'The full released set includes 2,000 image questions and 7,143 video questions across three structured decision types.'}</p><ul><li><strong>Choice</strong> — {zh ? '在命名候选项之间分配概率。' : 'assign probabilities to named candidates.'}</li><li><strong>Noul</strong> — {zh ? '判断一个命题为真或假的概率。' : 'estimate whether a statement is true or false.'}</li><li><strong>Score</strong> — {zh ? '在有序等级上给出概率分布。' : 'return a distribution over ordered grades.'}</li></ul><h2>{zh ? '理解结果' : 'Understand the results'}</h2><p>{zh ? 'JevalKit 保留模态、问题类型与领域的分类结果。硬标签准确率、概率分布评分与有序评分分别报告；比较模型时应使用相同的数据摘要和评分协议。' : 'JevalKit retains breakdowns by modality, task type, and domain. Hard-label accuracy, probability scores, and ordinal scores are reported separately. Compare models using the same dataset hashes and scoring protocols.'}</p><Link className="v-link text-button" to="/docs/jevalkit/benchmarks/">{zh ? '阅读评分协议' : 'Read scoring protocols'}<Arrow/></Link></div>
  </main></Layout>;
}
