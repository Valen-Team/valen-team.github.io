import React, {useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import ProjectCards from '../components/ProjectCards';
import {useChinese} from '../components/Content';
import {Arrow} from '../components/Icons';

export default function Projects() {
  const zh = useChinese(); const [filter, setFilter] = useState('all');
  return <Layout title={zh ? '项目' : 'Projects'} description={zh ? '探索万澜团队的开放模型、评测工具与数据。' : 'Explore open models, evaluation tools, and datasets from Valen Team.'}><main className="site-container interior-page">
    <header className="page-intro"><p className="eyebrow">{zh ? '共同构建的开放生态' : 'AN ECOSYSTEM, BUILT IN THE OPEN'}</p><h1>{zh ? <>从想法，<em>到行动。</em></> : <>Ideas into <em>action.</em></>}</h1><p>{zh ? '从多模态决策到可复现评测，探索我们正在构建的模型、工具与数据。' : 'From multimodal decisions to reproducible evaluation. Explore the models, tools, and data we are building.'}</p></header>
    <div className="filter-bar" aria-label={zh ? '按类型筛选项目' : 'Filter projects by type'}>{[['all', zh ? '全部项目' : 'All projects'], ['models', zh ? '模型' : 'Models'], ['evaluation', zh ? '评测' : 'Evaluation'], ['data', zh ? '数据' : 'Data']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <div aria-live="polite">{filter !== 'data' && <ProjectCards filter={filter as 'all' | 'models' | 'evaluation'}/>}
    {(filter === 'all' || filter === 'data' || filter === 'evaluation') && <div className="resource-grid">
      <article className="resource-card"><p className="eyebrow">{zh ? '多模态决策基准' : 'MULTIMODAL BENCHMARK'}</p><h2>VisualDecisionBench</h2><p>{zh ? '图像与视频决策评测，覆盖 Choice、Noul 和 Score 三类问题。包含 1,696 个共享状态和 9,143 个问题。' : 'Image and video decision evaluation across Choice, Noul, and Score tasks. Contains 1,696 shared states and 9,143 questions.'}</p><Link className="v-link text-button" to="/benchmarks/">{zh ? '探索 Benchmark' : 'Explore benchmark'}<Arrow/></Link></article>
      <article className="resource-card"><p className="eyebrow">{zh ? '评测数据' : 'EVALUATION DATA'}</p><h2>JevalKit Datasets</h2><p>{zh ? '8 类决策 Benchmark，整理为 10 份 TSV 视图。保留数据摘要、评分协议与来源信息。' : 'Eight decision benchmark families in ten ready-to-use TSV views, with source provenance, dataset hashes, and scoring protocols.'}</p><a className="v-link text-button" href="https://huggingface.co/datasets/Valen-Team/JevalKit_Datasets">{zh ? '浏览数据集' : 'Explore datasets'}<Arrow diagonal/></a></article>
    </div>}</div>
    <p className="project-coverage-note">{zh ? '模型注册数量不等于完整实测覆盖。具体模型、Benchmark 与协议覆盖请查看 JevalKit 文档和排行榜。' : 'Model registration is distinct from full evaluation coverage. See the JevalKit docs and leaderboard for per-model, per-benchmark results.'}</p>
  </main></Layout>;
}
