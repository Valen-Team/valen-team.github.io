import React from 'react';
import Link from '@docusaurus/Link';
import {projects, useChinese} from './Content';
import {Arrow} from './Icons';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function ProjectCards({filter = 'all', visual = false}: {filter?: 'all' | 'models' | 'evaluation'; visual?: boolean}) {
  const zh = useChinese(); const lang = zh ? 1 : 0;
  const mark = useBaseUrl('/img/valen-mark.png');
  const jevalkit = useBaseUrl('/img/jevalkit-light.svg');
  const scene = useBaseUrl('/img/valen-glass-scene.webp');
  return <div className="project-grid">{projects.map((p, i) => (filter === 'all' || (filter === 'models' && i === 0) || (filter === 'evaluation' && i === 1)) && <article key={p.name} data-v-project={i === 1 ? 'jevalkit' : undefined} className={`v-card project-card project-card-${i}`}>
    {visual && (i === 0 ? <div className="project-visual project-visual--model"><img src={scene} alt="" loading="lazy" width="1774" height="887"/><span>TEXT / IMAGE / VIDEO</span></div> : <div className="project-visual project-visual--tool" aria-hidden="true"><div className="tool-orbit tool-orbit-1"/><div className="tool-orbit tool-orbit-2"/><div className="tool-surface"><img src={jevalkit} alt="" width="900" height="150"/></div><div className="tool-pill tool-pill--top">{zh ? '统一评测' : 'ONE EVALUATION INTERFACE'}</div><div className="tool-pill tool-pill--bottom">{zh ? '运行 → 比较 → 复现' : 'RUN → COMPARE → REPRODUCE'}</div></div>)}
    <div className="project-card-top"><span className="eyebrow">{p.category[lang]}</span><img className={`project-brand${i === 1 ? ' project-brand--jevalkit' : ''}`} src={i === 0 ? mark : jevalkit} alt="" width={i === 0 ? 56 : 160} height="48" loading="lazy"/></div>
    <h3><Link to={p.docs}>{p.name}</Link><span className="project-number">0{i + 1}</span></h3>
    <p className="project-description">{p.description[lang]}</p>
    <p className="project-detail">{p.detail[lang]}</p>
    <div className="project-tags">{p.tags.map(t => <span key={t}>{zh ? t.replace('8 benchmark families', '8 类 Benchmark').replace('20 model families', '20 个模型家族').replace('Text / Image / Video', '文本 / 图片 / 视频') : t}</span>)}</div>
    <div className="project-links"><Link to={p.docs}>{zh ? '阅读文档' : 'Read the docs'}<Arrow/></Link><a href={p.repo}>GitHub<Arrow diagonal/></a><a href={p.resource}>{p.action[lang]}<Arrow diagonal/></a></div>
  </article>)}</div>;
}
