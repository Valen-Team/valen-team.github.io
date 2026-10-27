import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import {ArrowRight, Check, FileText, SlidersHorizontal} from 'lucide-react';
import {useChinese} from '../Content';
import evidence from '../../data/reliability.json';
import './reliability.css';

type Bin = {lower:number; upper:number; n:number; mean_probability:number|null; accuracy:number|null; accuracy_interval:number[]|null};
type Point = {coverage:number; error_rate:number|null; accepted:number};
type Metrics = {ece:number|null; nll:number|null; brier:number|null; accuracy:number|null; probability_one_questions:number; bins:Bin[]; risk_coverage:Point[]};
type Operating = {validation_target:number; policy_url?:string; test:{coverage:number; accepted:number; errors:number; eligible:number; error_rate:number|null; error_interval:number[]|null}};
type Entry = {model:string; status:string; reason?:string; revision?:string; questions?:number; report_url?:string; report_bytes?:number; calibration_url?:string; source_url?:string; protocol_url?:string; scope?:string; before?:Metrics; after?:Metrics; operating_points?:Operating[]};
const models = evidence.models as Entry[];
const percent = (v:number|null|undefined) => v == null ? '—' : `${(100*v).toFixed(1)}%`;
const metric = (v:number|null|undefined) => v == null ? '—' : v.toFixed(4);

function Curve({before,after,kind,zh,operating}:{before:Metrics;after:Metrics;kind:'reliability'|'risk';zh:boolean;operating?:Operating}) {
  const reliability=kind==='reliability';
  const title=reliability ? (zh?'报出的概率与实际正确率':'Stated probability vs. observed accuracy') : (zh?'自动处理覆盖率与错误率':'Automated coverage vs. error rate');
  const points=(m:Metrics):[number,number][] => reliability
    ? m.bins.filter(b=>b.n>0).map(b=>[b.mean_probability!,b.accuracy!])
    : m.risk_coverage.filter(p=>p.accepted>0 && p.error_rate!==null).map(p=>[p.coverage,p.error_rate!]);
  const xy=(x:number,y:number)=>`${48+420*x},${230-190*y}`;
  return <figure className="reliability-chart"><figcaption>{title}</figcaption>
    <svg viewBox="0 0 500 285" role="img" aria-label={title}>
      <title>{title}</title><desc>{zh?'灰色为原始概率，蓝色为校准后。完整数字见下载报告。':'Gray: original. Blue: calibrated. Download the report for exact values.'}</desc>
      {[0,.25,.5,.75,1].map(t=><g key={t}><path d={`M48 ${230-190*t}H468`} className="reliability-grid"/><text x="40" y={234-190*t} textAnchor="end">{Math.round(t*100)}%</text><text x={48+420*t} y="250" textAnchor="middle">{Math.round(t*100)}%</text></g>)}
      {reliability&&<path d="M48 230L468 40" className="reliability-ideal"/>}
      {([['before',before],['after',after]] as const).map(([name,m])=><g key={name} className={`reliability-series ${name}`}><polyline points={points(m).map(([x,y])=>xy(x,y)).join(' ')}/>{reliability&&m.bins.filter(b=>b.n>0).map((b,i)=><g key={i}>{b.accuracy_interval&&<path d={`M${48+420*b.mean_probability!} ${230-190*b.accuracy_interval[0]}V${230-190*b.accuracy_interval[1]}`} className="reliability-interval"/>}<circle cx={48+420*b.mean_probability!} cy={230-190*b.accuracy!} r="3"><title>{`${b.n} ${zh?'题':'questions'}; ${percent(b.mean_probability)} → ${percent(b.accuracy)}`}</title></circle></g>)}</g>)}
      {!reliability&&operating?.test.error_rate!=null&&<g className="reliability-selected"><path d={`M${48+420*operating.test.coverage} 230V${230-190*operating.test.error_rate}`}/><circle cx={48+420*operating.test.coverage} cy={230-190*operating.test.error_rate} r="5"><title>{zh?`所选规则：自动处理 ${percent(operating.test.coverage)}，错误率 ${percent(operating.test.error_rate)}`:`Selected rule: ${percent(operating.test.coverage)} coverage, ${percent(operating.test.error_rate)} error`}</title></circle></g>}
      <text x="255" y="277" textAnchor="middle">{reliability?(zh?'报出的概率':'Stated probability'):(zh?'自动处理比例':'Automated coverage')}</text>
    </svg><div className="reliability-legend"><span>{zh?'原始':'Original'}</span><span>{zh?'校准后':'Calibrated'}</span>{reliability&&<small>{zh?'虚线：理想校准':'Dashed: ideal calibration'}</small>}</div>
  </figure>;
}

function Histogram({before,after,zh}:{before:Metrics;after:Metrics;zh:boolean}) {
  const peak=Math.max(1,...before.bins.map(b=>b.n),...after.bins.map(b=>b.n));
  return <figure className="reliability-histogram"><figcaption>{zh?'概率分布：各区间有多少道题？':'Probability distribution: how many questions fall in each range?'}</figcaption>
    <svg viewBox="0 0 500 100" role="img" aria-label={zh?'原始与校准后的最大候选概率直方图':'Histogram of original and calibrated top probabilities'}>
      <title>{zh?'最大候选概率的样本分布':'Sample distribution of top candidate probabilities'}</title>
      {after.bins.map((b,i)=><g key={i}><rect x={24+i*30} y={70-before.bins[i].n/peak*55} width="11" height={before.bins[i].n/peak*55} className="before"><title>{`${zh?'原始':'Original'} ${(b.lower*100).toFixed(0)}–${(b.upper*100).toFixed(0)}%: ${before.bins[i].n}`}</title></rect><rect x={36+i*30} y={70-b.n/peak*55} width="11" height={b.n/peak*55} className="after"><title>{`${zh?'校准后':'Calibrated'} ${(b.lower*100).toFixed(0)}–${(b.upper*100).toFixed(0)}%: ${b.n}`}</title></rect></g>)}
      <text x="24" y="90">0%</text><text x="472" y="90" textAnchor="end">100%</text>
    </svg><p>{zh?`最大概率恰为 1 的题数：原始 ${before.probability_one_questions}，校准后 ${after.probability_one_questions}。`:`Top probability exactly 1: ${before.probability_one_questions} original, ${after.probability_one_questions} calibrated.`}</p></figure>;
}

export default function Reliability({full=false}:{full?:boolean}) {
  const zh=useChinese();
  const [modelIndex,setModelIndex]=useState(0);
  const [budgetIndex,setBudgetIndex]=useState(2);
  const selected=models[modelIndex];
  const Title=full?'h1':'h2';
  const ready=selected.status==='measured' && selected.before && selected.after;
  const operating=selected.operating_points?.[Math.min(budgetIndex,(selected.operating_points?.length??1)-1)];
  return <section className={`reliability-section ${full?'is-full':''}`} aria-labelledby="reliability-title">
    <div className="reliability-intro"><span className="reliability-kicker"><SlidersHorizontal size={14}/>{zh?'从概率到行动':'FROM PROBABILITY TO ACTION'}</span>
      <Title id="reliability-title">{zh?'让确定的自动处理，其他的交给人。':'Automate the clear cases. Review the rest.'}</Title>
      <p>{zh?'用工单意图分流检验 Valen：在可接受的错误率下，有多少工作可以自动完成？':'Evaluate Valen for ticket intent routing: how much work can you automate at an acceptable error rate?'}</p>
    </div>
    <div className="reliability-toolbar"><div className="reliability-models" role="group" aria-label={zh?'选择模型':'Choose a model'}>{models.map((m,i)=><button key={m.model} type="button" aria-pressed={modelIndex===i} onClick={()=>setModelIndex(i)}>{m.model.replace('Valen-','')}</button>)}</div><span>{ready?(zh?'独立测试回放':'Held-out replay'):(zh?'证据待验证':'Evidence pending')}</span></div>
    {ready ? <>
      <div className="reliability-policy"><div><label htmlFor="reliability-budget">{zh?'验证集上的目标错误率上限':'Validation error target'}</label><select id="reliability-budget" value={Math.min(budgetIndex,(selected.operating_points?.length??1)-1)} onChange={e=>setBudgetIndex(Number(e.target.value))}>{selected.operating_points?.map((p,i)=><option key={i} value={i}>{percent(p.validation_target)}</option>)}</select><p>{zh?'阈值在验证集选定；右侧显示独立测试的实际结果。':'Rules are frozen on validation data. The observed test result is shown alongside.'}</p></div>
        {operating&&<div className="reliability-outcomes" aria-live="polite"><div><strong>{percent(operating.test.coverage)}</strong><span>{zh?'自动处理':'automated'}</span></div><div><strong>{percent(operating.test.error_rate)}</strong><span>{zh?'自动处理中的实际错误率':'observed accepted error'}</span>{operating.test.error_interval&&<small>{`95% ${zh?'区间':'CI'} ${percent(operating.test.error_interval[0])}–${percent(operating.test.error_interval[1])}`}</small>}</div><div><strong>{percent(1-operating.test.coverage)}</strong><span>{zh?'交给人工复核':'sent to review'}</span></div></div>}
      </div>
      {operating&&<p className="reliability-scope">{zh?`自动处理 ${operating.test.accepted} / ${operating.test.eligible} 题，错误 ${operating.test.errors} 题。`:`Accepted ${operating.test.accepted} / ${operating.test.eligible} questions; ${operating.test.errors} ${operating.test.errors===1?'error':'errors'}.`} {operating.test.accepted===0&&(zh?'此验证目标下未找到符合条件的规则。':'No rule met this validation target.')} {zh?'验证目标不保证测试或新业务达到同样错误率。':'A validation target is not a guarantee for test or deployment.'}</p>}
      <p className="reliability-scope">{zh?`BANKING77 · 英文 · 77 个候选意图 · ${selected.questions} 道测试题 · 已有公开测试的回溯实验。`:`BANKING77 · English · 77 candidate intents · ${selected.questions} test questions · retrospective public-test replay.`}</p>
      <div className="reliability-plots"><Curve before={selected.before!} after={selected.after!} kind="risk" zh={zh} operating={operating}/><Curve before={selected.before!} after={selected.after!} kind="reliability" zh={zh}/></div>
      <details className="reliability-details" open={full}><summary>{zh?'为什么相信这些数字？查看校准前后与实验范围':'Why trust these numbers? Compare calibration and inspect the scope'}</summary>
        <Histogram before={selected.before!} after={selected.after!} zh={zh}/><div className="reliability-table-wrap"><table><caption>{zh?'同一独立测试集；数值越低越好，准确率除外。':'Same held-out test; lower is better except accuracy.'}</caption><thead><tr><th>{zh?'指标':'Metric'}</th><th>{zh?'原始':'Original'}</th><th>{zh?'校准后':'Calibrated'}</th></tr></thead><tbody>{(['ece','nll','brier','accuracy'] as const).map(key=><tr key={key}><th>{key==='accuracy'?(zh?'准确率':'Accuracy'):key==='brier'?'Brier':key.toUpperCase()}</th><td>{key==='accuracy'?percent(selected.before![key]):metric(selected.before![key])}</td><td>{key==='accuracy'?percent(selected.after![key]):metric(selected.after![key])}</td></tr>)}</tbody></table></div>
        <p>{selected.model} · {selected.revision?.slice(0,12)} · {selected.questions} {zh?'道测试题':'test questions'}</p><p>{zh?'BANKING77 · 英文 · 77 个候选意图 · 已有公开测试的回溯实验，不代表生产或视觉任务表现。':selected.scope}</p>
        {selected.after!.ece!==null&&selected.before!.ece!==null&&selected.after!.ece!>selected.before!.ece!&&<p className="reliability-regression">{zh?'这次拟合使独立测试 ECE 升高。请同时检查 NLL、Brier 和分流结果，不应只选择好看的指标。':'This fit increased held-out ECE. Inspect NLL, Brier and routing results together; the report retains this regression.'}</p>}<p>{zh?'ECE 使用 15 个等宽分箱与最大候选概率。误差线为逐箱 95% Wilson 区间；相关题目可能使区间过窄。':'ECE uses 15 equal-width bins and top candidate probability. Error bars are pointwise 95% Wilson intervals; correlated questions can make them too narrow.'}</p>
        <div className="reliability-downloads"><a href={selected.report_url} download><FileText size={15}/>{zh?'完整报告 JSON.gz':'Full report JSON.gz'}{selected.report_bytes&&<small>{` · ${Math.ceil(selected.report_bytes/1024)} KB`}</small>}</a><a href={selected.calibration_url} download>{zh?'实验温度参数':'Study temperature artifact'}</a>{selected.source_url&&<a href={selected.source_url}>{zh?'数据来源':'Dataset source'}</a>}{selected.protocol_url&&<a href={selected.protocol_url} download>{zh?'实验协议':'Study protocol'}</a>}{operating?.policy_url&&<a href={operating.policy_url} download>{zh?'当前分流规则':'Selected routing policy'}</a>}</div>
        <p>{zh?'下载参数绑定这次历史实验的模型与协议。接入自己的业务时，请按教程重新拟合和验证。':'Downloaded parameters are bound to this historical model and recipe. Refit and validate for your own workflow.'}</p>
      </details>
    </> : <div className="reliability-pending"><FileText size={26}/><div><h3>{zh?'先验证，再决定交给它多少工作。':'Measure first. Then choose what to automate.'}</h3><p>{zh?'这个模型的独立校准报告尚未就绪，因此这里不展示自动处理比例或性能数字。你现在可以用自己的标签数据拟合温度、冻结分流规则并生成报告。':'An independent calibration report for this model is not ready, so no automation or performance numbers are shown here. Use your own labeled data to fit temperatures, freeze routing rules and generate a report.'}</p></div></div>}
    <div className="reliability-actions"><Link className="reliability-primary" to="/?example=ticket">{zh?'在线体验工单分流':'Try ticket routing'}<ArrowRight size={16}/></Link><Link to="/cookbook/calibrated-routing/">{zh?'用我的数据验证':'Evaluate on my data'}<ArrowRight size={15}/></Link>{!full&&<Link to="/docs/valen/reliability/">{zh?'查看完整证据与方法':'Evidence and methodology'}<ArrowRight size={15}/></Link>}</div>
    {full&&<div className="reliability-next"><h3>{zh?'从报告到你的应用':'From a report to your application'}</h3><ol><li>{zh?'按客户、会话或媒体来源划分校准、规则验证和测试集。':'Split calibration, policy validation and test by customer, conversation or media source.'}</li><li>{zh?'离线复用原始预测，拟合温度，冻结规则，再看测试结果。':'Reuse raw predictions offline, fit temperature, freeze rules, then inspect test results.'}</li><li>{zh?'加载同一模型对应的参数；低于门槛或请求失败时转人工。':'Load parameters for the same model; route low-probability or failed requests to review.'}</li></ol><pre><code>{'python -m valen.calibrate pipeline \\\n  --calibration-cache calibration.json \\\n  --policy-cache policy.json --test-cache test.json \\\n  --output evidence'}</code></pre><p>{zh?'这条命令只处理本地缓存，不下载或调用模型。':'This command processes local caches only. It does not download or invoke a model.'}</p><p><Check size={14}/> {zh?'原始概率与集中程度 confidence 分开解释；温度校准不保证排序或自动处理能力改善。':'Probability and concentration confidence are distinct. Temperature fitting does not guarantee better ranking or automation.'}</p></div>}
  </section>;
}
