import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import {useChinese} from './Content';

const entries = [
  {id:'api-quickstart', category:'foundations', modality:'text image video', title:['API basics', 'API 入门'], summary:['Run the three original notebook examples through an HTTP service.', '通过 HTTP 服务运行旧 Notebook 的文本、图片和视频帧示例。']},
  {id:'local-inference', category:'foundations', modality:'text image video', title:['Local inference basics', '本地推理基础'], summary:['Use both protocols with an offline native or ONNX model, including direct video.', '使用离线原版或 ONNX 模型运行两种协议，包括直接视频输入。']},
  {id:'ticket-routing', category:'applications', modality:'text', title:['Route support tickets', '工单分流'], summary:['Turn intent probabilities and explicitness scores into a queue and review priority.', '用意图概率和明确程度评分生成处理队列与人工审核优先级。']},
  {id:'product-screening', category:'applications', modality:'image', title:['Screen product images', '商品图片筛选'], summary:['Check photographic print listings against the animals pictured and rank matches.', '检查摄影挂画商品分类是否与图片中的动物一致，并按匹配概率排序。']},
  {id:'video-tagging', category:'applications', modality:'video image', title:['Tag short videos', '短视频标注'], summary:['Sample one bounded frame and produce a reviewable sauce-color tag.', '抽取一个有界视频帧，输出可人工复核的酱汁颜色标签。']},
];

export default function CookbookIndex() {
  const zh=useChinese(), [query,setQuery]=useState(''), [category,setCategory]=useState('all');
  const rows=entries.filter(e=>(category==='all'||e.category===category||e.modality.includes(category)) && `${e.title.join(' ')} ${e.summary.join(' ')} ${e.modality}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="cookbook-directory" aria-label={zh?'教程目录':'Tutorial directory'}>
    <div className="cookbook-filters">
      <label>{zh?'搜索教程':'Search tutorials'}<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={zh?'搜索任务、输入或教程…':'Search tasks, inputs or tutorials…'}/></label>
      <label>{zh?'分类':'Category'}<select value={category} onChange={e=>setCategory(e.target.value)}>
        {[['all','All','全部'],['foundations','Foundations','基础'],['applications','Applications','应用'],['text','Text','文本'],['image','Image','图片'],['video','Video','视频']].map(([v,en,cn])=><option key={v} value={v}>{zh?cn:en}</option>)}
      </select></label>
    </div>
    <p className="cookbook-count" role="status">{zh?`${rows.length} 篇教程`:`${rows.length} tutorial${rows.length===1?'':'s'}`}</p>
    <div className="cookbook-cards">
      {rows.map(e=><article key={e.id} className="cookbook-card">
        <small>{e.category==='foundations'?(zh?'基础':'FOUNDATIONS'):(zh?'应用':'APPLICATIONS')} · {e.modality.split(' ').map(m=>zh?({text:'文本',image:'图片',video:'视频'}[m]):m).join(' / ')}</small>
        <h2><Link to={`/cookbook/${e.id}/`}>{e.title[zh?1:0]}</Link></h2>
        <p>{e.summary[zh?1:0]}</p>
      </article>)}
    </div>
    {rows.length===0&&<p>{zh?'没有匹配的教程，请尝试其他关键词。':'No tutorials found. Try another search.'}</p>}
  </section>;
}
