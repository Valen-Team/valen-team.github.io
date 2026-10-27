import React from 'react';
import {useChinese} from './Content';
import evidence from '@site/static/cookbook/validation/unknown-categories/summary.json';

type Rate = {value:number|null; ci95:number[]|null};
const names = ['A_threshold', 'B_none', 'C_none_threshold'] as const;
const titles = {A_threshold:['A: thresholds','A：阈值'], B_none:['B: none','B：none'], C_none_threshold:['C: none + thresholds','C：none＋阈值']};
function percent(value:number|null) {return value===null?'—':`${(value*100).toFixed(1)}%`;}
function rate(value:Rate) {return <>{percent(value.value)}{value.ci95&&<small style={{display:'block',fontSize:12,whiteSpace:'nowrap'}}>95% CI {percent(value.ci95[0])}–{percent(value.ci95[1])}</small>}</>;}
function policy(value:{reject_all:boolean;threshold:number|null;margin:number|null}|null,zh:boolean) {
  return value===null?(zh?'仅按 none 判断':'none only'):value.reject_all?(zh?'无可行规则；全部转人工':'No feasible rule; review all'):`p ≥ ${value.threshold}; gap ≥ ${value.margin}`;
}
export default function UnknownCategoryResults({section}:{section:'example'|'takeaway'|'metrics'|'cases'}) {
  const zh=useChinese();
  if(section==='example') {
    const before=evidence.cases.find(r=>r.strategy==='A_threshold'&&r.kind==='outside'&&r.route==='automatic');
    const after=evidence.cases.find(r=>r.strategy==='C_none_threshold'&&r.id===before?.id);
    if(!before||!after) return <p>{zh?'请查看下方完整实测记录。':'See the complete recorded cases below.'}</p>;
    return <div>
      <blockquote>{before.text}</blockquote>
      <table><thead><tr><th>{zh?'同一条请求':'Same request'}</th><th>{zh?'Valen 的选择':'Valen choice'}</th><th>{zh?'应用处理':'Application outcome'}</th></tr></thead><tbody>
        {[before,after].map((r,i)=><tr key={r.strategy}><td>{i===0?(zh?'原候选＋阈值':'Original options + gate'):(zh?'增加 none':'With none')}</td><td><code>{r.selected}</code><br/><small>{percent(r.probability)}</small></td><td>{r.route==='automatic'?(zh?'自动接收，分错队列':'Accepted into the wrong queue'):(zh?'交给人工':'Human review')}</td></tr>)}
      </tbody></table>
      <small>{zh?'记录中的 Valen-0.8B 测试案例；概率对应各自的候选集合。':'Recorded Valen-0.8B test case; probabilities belong to their respective candidate sets.'}</small>
    </div>;
  }
  if(section==='takeaway') {
    const a=evidence.results.A_threshold.test, b=evidence.results.B_none.test;
    return <table><thead><tr><th>{zh?'你需要关心的结果':'What matters'}</th><th>{zh?'原候选＋阈值':'Original options + gates'}</th><th>{zh?'增加 none':'With none'}</th></tr></thead><tbody>
      <tr><th>{zh?'未知请求被错误接收':'Outside requests accepted'}</th><td>{a.counts.outside_accepted} / {a.counts.outside}<br/>{percent(a.outside_miss_rate.value)}</td><td>{b.counts.outside_accepted} / {b.counts.outside}<br/>{percent(b.outside_miss_rate.value)}</td></tr>
      <tr><th>{zh?'正常请求转人工':'Normal requests reviewed'}</th><td>{a.counts.in_scope_review} / {a.counts.in_scope}<br/>{percent(a.in_scope_review_rate.value)}</td><td>{b.counts.in_scope_review} / {b.counts.in_scope}<br/>{percent(b.in_scope_review_rate.value)}</td></tr>
      <tr><th>{zh?'自动处理中的错误':'Errors among acceptances'}</th><td>{a.counts.accepted_errors} / {a.counts.accepted}<br/>{percent(a.accepted_error_rate.value)}</td><td>{b.counts.accepted_errors} / {b.counts.accepted}<br/>{percent(b.accepted_error_rate.value)}</td></tr>
      <tr><th>{zh?'自动处理量':'Automatic volume'}</th><td>{a.counts.accepted} / {a.counts.requests}<br/>{percent(a.coverage.value)}</td><td>{b.counts.accepted} / {b.counts.requests}<br/>{percent(b.coverage.value)}</td></tr>
    </tbody></table>;
  }
  if(section==='metrics') return <div>
    <p><strong>{zh?'记录范围':'Recorded scope'}</strong>: {evidence.model_label} · {evidence.runtime_label} · {zh?'600 次文本请求；仅测试划分结果如下':'600 text requests; test-split results below'}</p>
    <p>{zh?'测试集：100 条候选内、70 条候选外、30 条信息不足，来自 40 个来源场景。区间为来源组 bootstrap 的经验 95% CI；零事件或全成功时，经验区间可能退化为单点。表格可横向滚动。':'Test: 100 in-scope, 70 outside and 30 insufficient-information requests from 40 source scenarios. Intervals are empirical source-group bootstrap 95% CIs. With zero events or all successes they can collapse to a point. Scroll the table horizontally if needed.'}</p>
    <div className="table-responsive"><table><thead><tr><th>{zh?'指标':'Metric'}</th>{names.map(s=><th key={s}>{titles[s][zh?1:0]}</th>)}</tr></thead><tbody>
      <tr><th>{zh?'验证集选定规则':'Validation-selected rule'}</th>{names.map(s=><td key={s}>{policy(evidence.policies[s],zh)}</td>)}</tr>
      {([
        ['outside_miss_rate','Outside miss rate ↓','候选外漏检率 ↓'],
        ['in_scope_review_rate','In-scope review / false alarm ↓','候选内误转人工率 ↓'],
        ['coverage','Automatic coverage','自动处理覆盖率'],
        ['accepted_error_rate','Accepted error rate ↓','自动处理错误率 ↓'],
        ['outside_detection_rate','Outside detection (no request errors)','候选外检测率（不计请求失败）'],
        ['insufficient_review_rate','Insufficient-information review','信息不足转人工率'],
      ] as const).map(([key,en,cn])=><tr key={key}><th>{zh?cn:en}</th>{names.map(s=><td key={s}>{rate(evidence.results[s].test[key])}</td>)}</tr>)}
      <tr><th>{zh?'自动处理数量 / 错误数量':'Accepted / errors'}</th>{names.map(s=><td key={s}>{evidence.results[s].test.counts.accepted} / {evidence.results[s].test.counts.accepted_errors}</td>)}</tr>
      <tr><th>{zh?'请求错误':'Request errors'}</th>{names.map(s=><td key={s}>{evidence.results[s].test.counts.request_errors}</td>)}</tr>
    </tbody></table></div>
  </div>;
  return <div className="table-responsive"><table><thead><tr><th>{zh?'案例类型':'Case type'}</th><th>{zh?'原始输入 / 真值':'Input / truth'}</th><th>{zh?'策略与实际结果':'Strategy and outcome'}</th></tr></thead><tbody>
    {evidence.cases.map((r,i)=><tr key={i}><td>{zh?r.caption.zh:r.caption.en}</td><td>{r.text}<br/><small>{r.kind}; {zh?'业务类别真值':'Business label'}: {r.gold??(zh?'不适用':'not applicable')}</small></td><td>{titles[r.strategy as keyof typeof titles][zh?1:0]}<br/><code>{r.selected??'request_error'}</code> → <code>{r.route}</code><br/><small>{r.reason}; p={percent(r.probability??null)}</small></td></tr>)}
  </tbody></table></div>;
}
