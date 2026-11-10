import React from 'react';
import performance from '@site/static/cookbook/validation/performance.json';
import failures from '@site/static/cookbook/validation/preserved-failures.json';
import versions from '@site/static/cookbook/versions.json';
import capabilities from '@site/static/cookbook/capabilities.json';
import comparison from '@site/static/cookbook/validation/cross-backend.json';
import {useChinese} from './Content';

const number=(v:number|null|undefined)=>v===null||v===undefined?'—':v.toFixed(3);
const small=(v:number)=>v===0?'0':v<1e-3?v.toExponential(1):v.toFixed(4);
const failureNote=(backend:string,modality:string,zh:boolean)=>{
  const note=(failures.failure_notes as Record<string,string[]>)[backend+'/'+modality];
  return note?note[zh?1:0]:(zh?'失败':'Failed');
};
export function PerformanceTable() {
  const zh=useChinese();
  return <div style={{overflowX:'auto'}}><table><thead><tr>
    {(zh?['后端 / 精度','输入','启动至就绪 s','冷请求 s','热 p50 s','热 p95 s','峰值 RSS GiB']:['Backend / precision','Input','Startup s','Cold s','Warm p50 s','Warm p95 s','Peak RSS GiB']).map(s=><th key={s}>{s}</th>)}
  </tr></thead><tbody>{performance.records.map(row=><tr key={row.backend+row.modality}>
    <td>{row.backend}</td><td>{row.modality}</td><td>{number(row.startup_to_ready_seconds)}</td>
    <td>{row.passed?number(row.cold_request_seconds):failureNote(row.backend,row.modality,zh)}</td>
    <td>{number(row.warm_p50_seconds)}</td><td>{number(row.warm_p95_seconds)}</td><td>{row.passed?number(row.peak_rss_bytes/1024**3):'—'}</td>
  </tr>)}</tbody></table></div>;
}
export function ServerTimingTable() {
  const zh=useChinese();
  return <table><thead><tr>{(zh?['后端','输入','客户端热 p50 s','服务端 predict 热 p50 s']:['Backend','Input','Client warm p50 s','Server predict warm p50 s']).map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>
    {performance.records.filter(r=>r.passed).map(r=><tr key={r.backend+r.modality}><td>{r.backend}</td><td>{r.modality}</td><td>{number(r.warm_p50_seconds)}</td><td>{number(r.server_predict_p50_seconds)}</td></tr>)}
  </tbody></table>;
}
export function BackendCapabilities() {
  const zh=useChinese(), yes=(v:boolean)=>v?(zh?'是':'Yes'):(zh?'否':'No');
  return <div style={{overflowX:'auto'}}><table><thead><tr>{(zh?['后端','Decisions','SystemOne','文本','图片','直接视频','验证范围']:['Backend','Decisions','SystemOne','Text','Image','Direct video','Evidence scope']).map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>
    {capabilities.backends.map(r=><tr key={r.id}><td>{r.label[zh?1:0]}</td><td>{yes(r.decisions)}</td><td>{yes(r.system_one)}</td><td>{yes(r.text)}</td><td>{yes(r.image)}</td><td>{yes(r.direct_video)}</td><td>{r.validation[zh?1:0]}</td></tr>)}
  </tbody></table></div>;
}
export function NumericalTable() {
  const zh=useChinese();
  return <div style={{overflowX:'auto'}}><table><thead><tr>{(zh?['对比后端','变体数','Choice 一致率','概率 MAE','最大概率偏差','输入 token 一致']:['Compared backend','Variants','Choice agreement','Probability MAE','Max probability error','Input tokens match']).map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{comparison.records.map(r=><tr key={r.backend}><td>{r.backend}</td><td>{r.compared_variants}</td><td>{(r.choice_agreement*100).toFixed(1)}%</td><td>{r.probability_mae.toFixed(6)}</td><td>{r.probability_max_error.toFixed(6)}</td><td>{r.input_tokens_match?'✓':'×'}</td></tr>)}</tbody></table></div>;
}
export function RecipeConsistencyTable() {
  const zh=useChinese();
  return <div style={{overflowX:'auto'}}><table><thead><tr>{(zh?['模型','ONNX 变体','教程数','对比数值','决策一致率','概率 MAE','最大概率偏差']:['Model','ONNX variant','Recipes','Compared numbers','Decision agreement','Probability MAE','Max probability error']).map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>
    {comparison.recipe_records.map(r=><tr key={r.model+r.backend}><td>{r.model}</td><td>{r.backend}</td><td>{r.recipes}</td><td>{r.compared_numbers}</td><td>{(r.decision_agreement*100).toFixed(1)}%</td><td>{small(r.probability_mae)}</td><td>{small(r.probability_max_error)}</td></tr>)}
  </tbody></table></div>;
}
export function GgufTable() {
  const zh=useChinese();
  return <div style={{overflowX:'auto'}}><table><thead><tr>{(zh?['GGUF 权重','请求','输入 token 一致','最大概率偏差 JPEG / PNG','最大框坐标偏差 JPEG / PNG']:['GGUF weights','Request','Input tokens match','Max probability error JPEG / PNG','Max box error JPEG / PNG']).map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>
    {comparison.gguf_records.map(r=><tr key={r.variant+r.request}><td>{r.variant}</td><td>{r.request}</td><td>{r.input_tokens_match?'✓':'×'}</td><td>{small(r.jpeg.max_probability_error)} / {small(r.png.max_probability_error)}</td><td>{r.has_boxes?`${small(r.jpeg.max_box_error)} / ${small(r.png.max_box_error)}`:'—'}</td></tr>)}
  </tbody></table></div>;
}
export function VersionSummary() {
  const zh=useChinese();
  return <table><thead><tr><th>{zh?'组件':'Component'}</th><th>{zh?'固定版本 / revision':'Pinned version / revision'}</th><th>{zh?'本页验证范围':'Scope on this page'}</th></tr></thead><tbody>
    <tr><td>{zh?'原生模型':'Native model'}</td><td><code>{versions.model.native.repo}@{versions.model.native.revision.slice(0,12)}</code></td><td>0.8B CPU FP32</td></tr>
    <tr><td>{zh?'ONNX 模型包':'ONNX bundle'}</td><td><code>{versions.model.onnx.repo}@{versions.model.onnx.revision.slice(0,12)}</code></td><td>{versions.model.onnx.variant}</td></tr>
    <tr><td>{zh?'GGUF 模型':'GGUF model'}</td><td><code>{versions.model.gguf.repo}@{versions.model.gguf.revision.slice(0,12)}</code></td><td>{versions.model.gguf.variant}</td></tr>
    <tr><td>Python SDK</td><td><code>{versions.sdk.python.name}=={versions.sdk.python.version}</code></td><td>{zh?'ONNX 本地与 HTTP':'ONNX local + HTTP'}</td></tr>
    <tr><td>JavaScript SDK</td><td><code>{versions.sdk.javascript.name}@{versions.sdk.javascript.version}</code></td><td>HTTP</td></tr>
    <tr><td>ONNX Runtime</td><td>{versions.measured_packages.onnx.packages.onnxruntime}</td><td>CPU FP32</td></tr>
    <tr><td>{zh?'GGUF 运行时':'GGUF runtime'}</td><td><a href={versions.runtime.url}>{versions.runtime.version}</a></td><td>{zh?'0.8B Q8_0，文本与固定图片；不支持直接视频':'0.8B Q8_0 text and fixed images; no direct video'}</td></tr>
  </tbody></table>;
}
