import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';
const sidebars: SidebarsConfig = {main: [
 'intro',
 {type:'category',label:'Getting started',collapsed:false,items:['valen/overview','valen/getting-started','valen/choosing']},
 {type:'category',label:'Integrations',items:[{type:'category',label:'API calls',collapsed:false,link:{type:'doc',id:'valen/api'},items:['valen/api/systemone','valen/api/decisions','valen/api/list-models']},{type:'category',label:'SGLang deployment',link:{type:'doc',id:'valen/sglang'},items:['valen/sglang-plugin','valen/sglang-image']},{type:'category',label:'vLLM deployment',link:{type:'doc',id:'valen/vllm'},items:['valen/vllm-plugin','valen/vllm-image']},'valen/quickstart','valen/onnx','valen/gguf']},
 {type:'category',label:'Model concepts',items:['valen/architecture','valen/qwen-shared-state','valen/probabilities']},
 {type:'category',label:'Training and fine-tuning',items:['valen/training','valen/data-format','valen/configuration','valen/checkpoints']},
 {type:'category',label:'Evaluation',items:['valen/decision-index',{type:'category',label:'JevalKit',link:{type:'doc',id:'jevalkit/overview'},items:['jevalkit/quickstart','jevalkit/models','jevalkit/benchmarks']}]},
 'resources','contributing'
]};
export default sidebars;
