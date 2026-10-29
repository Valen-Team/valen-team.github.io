import React, {useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {ArrowLeft, ArrowRight} from 'lucide-react';
import {useChinese} from './Content';

// Recipes are grouped by the goal they serve; modality is a second filter.
// Each goal's color is the paper color of its covers.
const goals = [
  {id:'foundations', label:['Foundations', '入门'], color:'var(--paper-foundations)'},
  {id:'route', label:['Route & triage', '路由与分流'], color:'var(--paper-route)'},
  {id:'select', label:['Select, don\'t generate', '选择而非生成'], color:'var(--paper-select)'},
  {id:'evidence', label:['Find & judge evidence', '找证据、判相关'], color:'var(--paper-evidence)'},
  {id:'verify', label:['Verify & escalate', '核查与升级'], color:'var(--paper-verify)'},
  {id:'vision', label:['Images & video', '看图看视频'], color:'var(--paper-vision)'},
  {id:'data', label:['Answers into data', '把回答变成数据'], color:'var(--paper-data)'},
  {id:'adapt', label:['Adapt & ship', '适配与上线'], color:'var(--paper-adapt)'},
];

const entries = [
  {id:'function-calling', goal:'route', modality:'text', date:'2026-10-29', featured:true, title:['Turn a command into a function call', '把一句话变成函数调用'], summary:['One request picks the function and fills every closed-set argument; code reads only the chosen one.', '一次请求同时选函数、填所有封闭参数，代码只读取被选中函数的参数。']},
  {id:'document-check', goal:'vision', modality:'image', date:'2026-10-29', featured:true, title:['Check scanned forms against the record', '核对扫描表单与系统记录'], summary:['Ask one question per field, then accept, reject or review the scan in code.', '每个字段问一个问题，再由代码决定通过、驳回还是复核。']},
  {id:'skill-support-router', goal:'route', modality:'text', date:'2026-10-29', featured:true, title:['Build a support router with the agent skill', '用 agent skill 做客服分流'], summary:['A coding agent with the Valen skill turned a one-page brief into a router scoring 98% on unseen messages.', '装了 Valen skill 的编程 agent 根据一页需求写出分流器，在没见过的消息上得分 98%。']},
  {id:'value-extraction', goal:'select', modality:'text', date:'2026-10-29', title:['Pick the right date from an email', '从邮件里挑出正确的日期'], summary:['Code finds every date; Valen picks the new delivery date and a predicate catches emails without one.', '代码找出所有日期，Valen 选出新的交货日期，另一个判断题识别没有新日期的邮件。']},
  {id:'rerank', goal:'evidence', modality:'text', date:'2026-10-29', title:['Rerank retrieved passages', '重排检索结果'], summary:['Ask whether each retrieved passage answers the question, then sort and escalate when none does.', '逐条判断检索到的段落能否回答问题，排序后在没有合适段落时转人工。']},
  {id:'citation-check', goal:'verify', modality:'text', date:'2026-10-29', title:['Check claims against their citations', '核查论断与引用来源'], summary:['Separate supported, contradicted and unsupported claims, and escalate the ones the source does not settle.', '区分有依据、被反驳和无依据的论断，来源说不清的交给人工。']},
  {id:'llm-guardrails', goal:'verify', modality:'text', date:'2026-10-29', title:['Guardrails for LLM replies', '给 LLM 回复加护栏'], summary:['One predicate per policy rule decides whether a draft is sent, blocked, reviewed or regenerated.', '每条政策规则一个判断题，决定草稿是发送、拦截、复核还是重写。']},
  {id:'event-monitoring', goal:'vision', modality:'video', date:'2026-10-29', title:['Find when events happen in a clip', '找出视频里事件发生的时间'], summary:['Ask the same questions of evenly spaced frames and smooth the timeline in code.', '对均匀抽取的帧问同样的问题，再由代码平滑成时间线。']},
  {id:'composite-scoring', goal:'data', modality:'image', date:'2026-10-29', title:['Score photos once, weigh them per storefront', '一次打分，按店铺需求加权'], summary:['Score lighting, background and framing once; each storefront ranks photos with its own weights.', '对光线、背景和构图各打一次分，不同店铺用各自的权重排序。']},
  {id:'api-quickstart', goal:'foundations', modality:'text image video', date:'2026-10-27', title:['API basics', 'API 入门'], summary:['Run text, image and video-frame examples through an HTTP service.', '通过 HTTP 服务运行文本、图片和视频帧示例。']},
  {id:'local-inference', goal:'foundations', modality:'text image video', date:'2026-10-26', title:['Local inference basics', '本地推理基础'], summary:['Use both protocols with an offline native or ONNX model, including direct video.', '使用离线原版或 ONNX 模型运行两种协议，包括直接视频输入。']},
  {id:'ticket-routing', goal:'route', modality:'text', date:'2026-10-27', title:['Route support tickets', '工单分流'], summary:['Turn intent probabilities and explicitness scores into a queue and review priority.', '用意图概率和明确程度评分生成处理队列与人工审核优先级。']},
  {id:'unknown-categories', goal:'route', modality:'text', date:'2026-10-27', title:['When no option fits: handling unknown categories', '候选项都不对: 未知类别处理'], summary:['Compare none choices and review gates with recorded misses, false alarms and offline replay.', '用真实预测对比 none 与人工复核门槛，查看漏检、误报并离线复算。']},
  {id:'calibrated-routing', goal:'route', modality:'text', date:'2026-10-27', title:['Calibrate ticket routing', '校准工单分流'], summary:['Fit a reusable routing policy on your own tickets and send uncertain cases for review.', '用自己的工单拟合可复用的分流规则，将未达条件的请求交给人工。']},
  {id:'product-screening', goal:'vision', modality:'image', date:'2026-10-27', title:['Screen product images', '商品图片筛选'], summary:['Check photographic print listings against the animals pictured and rank matches.', '检查摄影挂画商品分类是否与图片中的动物一致，并按匹配概率排序。']},
  {id:'video-tagging', goal:'vision', modality:'video image', date:'2026-10-27', title:['Tag short videos', '短视频标注'], summary:['Sample one bounded frame and produce a reviewable sauce-color tag.', '抽取一个有界视频帧，输出可人工复核的酱汁颜色标签。']},
  {id:'domain-finetuning', goal:'adapt', modality:'text', date:'2026-10-26', title:['Domain LoRA fine-tuning', '领域 LoRA 微调'], summary:['Prepare independent splits, fine-tune complete 0.8B, resume and compare on one held-out test.', '从完整 0.8B 准备独立划分、微调、恢复并在同一测试集比较。']},
];

const pageSize = 6;

const modalities = [['all', 'All', '全部'], ['text', 'Text', '文本'], ['image', 'Image', '图片'], ['video', 'Video', '视频']];

function Topic({goal}:{goal:string}) {
  const zh=useChinese(), g=goals.find(x=>x.id===goal)!;
  return <span className="cookbook-topic"><i style={{background:g.color}}/>{g.label[zh?1:0]}</span>;
}

function Card({e, large}:{e:typeof entries[number]; large?:boolean}) {
  const zh=useChinese(), cover=useBaseUrl(`/img/cookbook/${e.id}.webp`), paper=goals.find(g=>g.id===e.goal)!.color;
  return <Link to={`/cookbook/${e.id}/`} className={large?'cookbook-card cookbook-card-large':'cookbook-card'}>
    <img src={cover} alt="" loading="lazy" width={960} height={640} style={{background:paper}}/>
    <Topic goal={e.goal}/>
    <h3>{e.title[zh?1:0]}</h3>
    {!large&&<p>{e.summary[zh?1:0]}</p>}
    {!large&&<time dateTime={e.date}>{e.date}</time>}
  </Link>;
}

export default function CookbookIndex() {
  const zh=useChinese(), [query,setQuery]=useState(''), [goal,setGoal]=useState('all'), [modality,setModality]=useState('all'), [page,setPage]=useState(0), top=useRef<HTMLDivElement>(null);
  const q=query.trim().toLowerCase();
  const rows=entries
    .filter(e=>(goal==='all'||e.goal===goal) && (modality==='all'||e.modality.includes(modality))
      && `${e.title.join(' ')} ${e.summary.join(' ')} ${e.modality}`.toLowerCase().includes(q))
    .sort((a,b)=>b.date.localeCompare(a.date));
  const showFeatured=!q&&goal==='all'&&modality==='all';
  const list=rows.filter(e=>!(showFeatured&&e.featured)), pageCount=Math.ceil(list.length/pageSize);
  const turn=(n:number)=>{setPage(n); top.current?.scrollIntoView({block:'start'});};
  return <section className="cookbook-directory" aria-label={zh?'教程目录':'Tutorial directory'}>
    <label className="cookbook-search">
      <span className="sr-only">{zh?'搜索教程':'Search cookbooks'}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
      <input type="search" value={query} onChange={e=>{setQuery(e.target.value); setPage(0);}} placeholder={zh?'搜索教程':'Search cookbooks'}/>
    </label>
    {showFeatured&&<>
      <h2 className="cookbook-heading">{zh?'精选':'Featured'}</h2>
      <div className="cookbook-featured">{entries.filter(e=>e.featured).map(e=><Card key={e.id} e={e} large/>)}</div>
    </>}
    <div className="cookbook-bar" ref={top}>
      <div className="cookbook-tabs" role="tablist">
        {[{id:'all', label:['All', '全部']}, ...goals].map(g=><button key={g.id} role="tab" aria-selected={goal===g.id}
          onClick={()=>{setGoal(g.id); setPage(0);}}>{g.label[zh?1:0]}</button>)}
      </div>
      <div className="cookbook-pills">
        {modalities.map(([v,en,cn])=><button key={v} aria-pressed={modality===v} onClick={()=>{setModality(v); setPage(0);}}>{zh?cn:en}</button>)}
      </div>
    </div>
    <p className="cookbook-count" role="status">{zh?`${rows.length} 篇教程`:`${rows.length} cookbook${rows.length===1?'':'s'}`}</p>
    <div className="cookbook-cards">{list.slice(page*pageSize, (page+1)*pageSize).map(e=><Card key={e.id} e={e}/>)}</div>
    {pageCount>1&&<nav className="cookbook-pagination" aria-label={zh?'教程分页':'Cookbook pages'}>
      <button type="button" onClick={()=>turn(page-1)} disabled={page===0} aria-label={zh?'上一页':'Previous page'}><ArrowLeft size={17} aria-hidden="true"/></button>
      <span aria-live="polite">{zh?`第 ${page+1} / ${pageCount} 页`:`${page+1} / ${pageCount}`}</span>
      <button type="button" onClick={()=>turn(page+1)} disabled={page===pageCount-1} aria-label={zh?'下一页':'Next page'}><ArrowRight size={17} aria-hidden="true"/></button>
    </nav>}
    {rows.length===0&&<p>{zh?'没有匹配的教程，请尝试其他关键词。':'No cookbooks found. Try another search.'}</p>}
  </section>;
}
