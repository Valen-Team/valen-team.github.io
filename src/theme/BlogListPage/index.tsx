import React, {useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import type {Props} from '@theme/BlogListPage';
import {useChinese} from '../../components/Content';
import {Arrow} from '../../components/Icons';

export default function BlogListPage({items, metadata}: Props) {
  const zh = useChinese(); const [filter, setFilter] = useState('all');
  const visible = items.filter(({content: Content}) => filter === 'all' || Content.metadata.tags.some(t => t.label.toLowerCase() === filter || t.permalink.split('/').includes(filter)));
  return <Layout title={zh ? '动态与发布' : 'News & releases'} description={zh ? '万澜团队的模型、评测工具和研究进展。' : 'The latest models, tools, benchmarks, and research from Valen Team.'}><main className="site-container interior-page">
    <header className="page-intro"><p className="eyebrow">{zh ? '来自万澜团队' : 'FROM VALEN TEAM'}</p><h1>{zh ? <>每一步，<em>新进展。</em></> : <>Progress, <em>as it happens.</em></>}</h1><p>{zh ? '开放模型、新工具与研究进展。记录我们正在构建的一切。' : 'Open models, new tools, and research updates. A record of what we are building, and what comes next.'}</p></header>
    <div className="filter-bar" aria-label={zh ? '按主题筛选动态' : 'Filter news by topic'}>{[['all', zh ? '全部动态' : 'All updates'], ['release', zh ? '发布' : 'Releases'], ['models', zh ? '模型' : 'Models'], ['tooling', zh ? '工具' : 'Tooling'], ['data', zh ? '数据' : 'Data']].map(([key, label]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
    <div className="news-list news-index-list" aria-live="polite">{visible.map(({content: Content}) => {const m = Content.metadata; return <Link key={m.permalink} to={m.permalink} className="news-row"><time dateTime={m.date}>{m.date.slice(0,10)}</time><div><span className="eyebrow news-type">{m.tags.map(t => t.label).join(' / ')}</span><h2>{m.title}</h2><p>{m.description}</p></div><Arrow diagonal/></Link>;})}{!visible.length && <p className="project-coverage-note">{zh ? '此分类暂时没有动态。' : 'No updates in this category yet.'}</p>}</div>
    {(metadata.previousPage || metadata.nextPage) && <nav className="benchmark-actions" aria-label={zh ? '动态分页' : 'News pagination'}>{metadata.previousPage && <Link to={metadata.previousPage}>{zh ? '上一页' : 'Previous page'}</Link>}{metadata.nextPage && <Link to={metadata.nextPage}>{zh ? '下一页' : 'Next page'}</Link>}</nav>}
    <div className="news-subscribe"><p>{zh ? '通过 RSS，在你常用的阅读器中关注新发布。' : 'Follow new releases in your favorite feed reader.'}</p><a href={`${zh ? '/zh-Hans' : ''}/news/rss.xml`}>{zh ? '订阅 RSS' : 'Subscribe via RSS'}<Arrow diagonal/></a></div>
  </main></Layout>;
}
