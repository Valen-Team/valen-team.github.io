import React from 'react';
import performance from '@site/static/cookbook/validation/performance.json';
import versions from '@site/static/cookbook/versions.json';
import capabilities from '@site/static/cookbook/capabilities.json';
import comparison from '@site/static/cookbook/validation/cross-backend.json';
import {useChinese} from './Content';

const number=(v:number|null|undefined)=>v===null||v===undefined?'—':v.toFixed(3);
export function PerformanceTable() {
  const zh=useChinese();
  return <div style={{overflowX:'auto'}}><table><thead><tr>
    {(zh?['后端 / 精度','输入','启动至就绪 s','冷请求 s','热 p50 s','热 p95 s','峰值 RSS GiB']:['Backend / precision','Input','Startup s','Cold s','Warm p50 s','Warm p95 s','Peak RSS GiB']).map(s=><th key={s}>{s}</th>)}
  </tr></thead><tbody>{performance.records.map(row=><tr key={row.backend+row.modality}>
    <td>{row.backend}</td><td>{row.modality}</td><td>{number(row.startup_to_ready_seconds)}</td>
    <td>{row.passed?number(row.cold_request_seconds):zh?'失败：未编译视频支持':'Failed: video not compiled'}</td>
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
  return <table><thead><tr>{(zh?['对比后端','变体数','Choice 一致率','概率 MAE','最大概率偏差','输入 token 一致']:['Compared backend','Variants','Choice agreement','Probability MAE','Max probability error','Input tokens match']).map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{comparison.records.map(r=><tr key={r.backend}><td>{r.backend}</td><td>{r.compared_variants}</td><td>{(r.choice_agreement*100).toFixed(1)}%</td><td>{r.probability_mae.toFixed(6)}</td><td>{r.probability_max_error.toFixed(6)}</td><td>{r.input_tokens_match?'✓':'×'}</td></tr>)}</tbody></table>;
}
export function VersionSummary() {
  const zh=useChinese();
  return <table><thead><tr><th>{zh?'组件':'Component'}</th><th>{zh?'固定版本 / revision':'Pinned version / revision'}</th><th>{zh?'P1 验证范围':'P1 scope'}</th></tr></thead><tbody>
    <tr><td>Native model</td><td><code>{versions.p1_model.source_revision}</code></td><td>0.8B CPU FP32</td></tr>
    <tr><td>Python SDK</td><td><code>{versions.sdk.python.name}=={versions.sdk.python.version}</code></td><td>ONNX local + HTTP</td></tr>
    <tr><td>JavaScript SDK</td><td><code>{versions.sdk.javascript.name}@{versions.sdk.javascript.version}</code></td><td>HTTP</td></tr>
    <tr><td>ONNX Runtime</td><td>{versions.measured_packages.onnx.packages.onnxruntime}</td><td>CPU FP32</td></tr>
    <tr><td>GGUF runtime</td><td>{versions.runtime.version}</td><td>{zh?'0.8B Q8_0，文本与固定图片；未编译直接视频':'0.8B Q8_0 text and fixed images; direct video not compiled'}</td></tr>
    <tr><td>GGUF source build</td><td><code>{versions.runtime.source_pins.llama_cpp_base.slice(0,12)}</code> + Valen patch</td><td>{zh?'含直接视频的独立真实回归；不混入性能表':'Separate real regression including direct video; no pooled performance rows'}</td></tr>
  </tbody></table>;
}
