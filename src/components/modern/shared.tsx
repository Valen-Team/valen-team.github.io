import React,{useEffect,useRef,useId} from 'react';
import {useLocation} from '@docusaurus/router';
import Link from '@docusaurus/Link';
import {useChinese} from '../Content';
import {ArrowUpRight, GitBranch} from 'lucide-react';
export const isModern = (path: string) => /^\/(?:zh-Hans\/?)?$/.test(path) || /\/(?:minimal|docs|cookbook)(?:\/|$)/.test(path);
export const isCookbook = (path: string) => /^\/(?:zh-Hans\/)?cookbook(?:\/|$)/.test(path);
export const isModernDoc = (path: string) => /^\/(?:zh-Hans\/)?(?:docs|cookbook)(?:\/|$)/.test(path);
// The supplied Valen mark, rendered as a monochrome SVG mask; source image is unchanged.
export function ModernMark(){const id=useId().replaceAll(':','');return <svg width="30" height="26" viewBox="140 210 740 580" fill="none" aria-hidden="true"><defs><filter id={`mark-filter-${id}`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -.2126 -.7152 -.0722 1 0"/><feComponentTransfer><feFuncA type="table" tableValues="0 1 1"/></feComponentTransfer></filter><mask id={`mark-mask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><image href="/img/valen-mark.png" width="1000" height="1000" filter={`url(#mark-filter-${id})`}/></mask></defs><path fill="currentColor" mask={`url(#mark-mask-${id})`} d="M0 0h1000v1000H0z"/></svg>;}
export function ModernBrand(){return <Link className="modern-brand" to="/"><ModernMark/><span>valen</span></Link>;}
export function ModernFooter(){const zh=useChinese();const footer=useRef<HTMLElement>(null);useEffect(()=>{const el=footer.current;if(!el||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;el.classList.add('will-reveal');const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){el.classList.add('in-view');observer.disconnect();}},{threshold:.08});observer.observe(el);return()=>observer.disconnect();},[]);return <footer className="modern-footer" ref={footer}><div className="modern-footer-brand"><ModernBrand/><p>© 2026 Valen Team / 万澜</p><p>{zh?'快速决策，持续进化。':'Fast decisions. Continuous evolution.'}</p><div className="modern-social"><a aria-label="GitHub" href="https://github.com/Valen-Team"><GitBranch size={17}/></a><a aria-label="Hugging Face" href="https://huggingface.co/Valen-Team"><ArrowUpRight size={18}/></a></div></div>{[[zh?'构建':'Build',[[zh?'文档':'Documentation','/docs/'],['Cookbook','/cookbook/'],['Valen API','/docs/valen/api/'],[zh?'API 数据处理':'API data handling','/docs/valen/api/data-handling/'],[zh?'Transformers 推理':'Transformers inference','/docs/valen/quickstart/'],[zh?'ONNX 与 SDK':'ONNX & SDKs','/docs/valen/onnx/']]],[zh?'探索':'Explore',[['JevalKit','/docs/jevalkit/'],[zh?'模型与数据':'Models & datasets','https://huggingface.co/Valen-Team'],[zh?'排行榜':'Leaderboard','https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard']]]].map(([title,items])=><div className="modern-footer-column" key={title as string}><h2>{title as string}</h2>{(items as string[][]).map(([label,to])=><Link key={label} to={to}>{label}</Link>)}</div>)}</footer>;}
export const docGroups = [
 {title:['Getting started','开始使用'],items:[['valen','What is Valen?','Valen 是什么'],['valen/getting-started','First call','第一次调用'],['valen/choosing','Choose a version','版本选择']]},
 {title:['Integrations','接入方式'],items:[['valen/api','API calls','API 调用','','Free'],['valen/sglang','SGLang deployment','SGLang 部署'],['valen/vllm','vLLM deployment','vLLM 部署'],['valen/quickstart','Transformers inference','Transformers 推理'],['valen/onnx','ONNX & SDKs','ONNX 与 SDK'],['valen/gguf','GGUF local service','GGUF 本地服务']]},
 {title:['Model concepts','模型介绍'],items:[['valen/architecture','Released architecture','发布模型架构'],['valen/qwen-shared-state','Multi-question inference','多问题共享计算'],['valen/probabilities','Using probabilities','如何使用概率']]},
 {title:['Training and fine-tuning','训练与微调'],items:[['valen/training','Fine-tuning','模型微调'],['valen/data-format','Data preparation and format','数据准备与格式'],['valen/configuration','Training configuration','训练配置'],['valen/checkpoints','Save, resume and export','保存、恢复与导出']]},
 {title:['Probability reliability','概率可靠性'],items:[['valen/reliability','Released-model evidence','发布模型实测'],['valen/calibration','Calibrate and automate','校准与自动处理']]},
 {title:['Evaluation','评测'],items:[['valen/decision-index','Jev Decision Index','Jev Decision Index'],['jevalkit','JevalKit toolkit','JevalKit 工具']]},
 {title:['Resources','资源'],items:[['resources','Links and resources','链接与资源'],['contributing','Contributing','参与贡献']]},
];
export const cookbookGroups = [
 {title:['GET STARTED','开始使用'],items:[['','Cookbook overview','教程概览'],['api-quickstart','API basics','API 入门'],['local-inference','Local inference','本地推理']]},
 {title:['APPLICATIONS','应用教程'],items:[['ticket-routing','Route support tickets','工单分流'],['calibrated-routing','Calibrate ticket routing','校准工单分流'],['product-screening','Screen product images','商品图片筛选'],['video-tagging','Tag short videos','短视频标注'],['domain-finetuning','Domain LoRA fine-tuning','领域 LoRA 微调']]},
 {title:['REFERENCE','参考'],items:[['/docs/valen/reliability/','Probability reliability','概率可靠性'],['validation','Validation & performance','验证、性能与版本'],['migration','Migration map','旧内容迁移表']]},
];
const deploymentChildren: Record<string, string[][]> = {
 'jevalkit': [['jevalkit/quickstart','Quickstart','快速开始'],['jevalkit/models','Model interfaces','模型接入'],['jevalkit/benchmarks','Benchmarks and scoring','基准与评分']],
 'valen/api': [['valen/api/systemone', 'System One', 'System One', 'POST'], ['valen/api/decisions', 'Decisions', 'Decisions', 'POST'], ['valen/api/list-models', 'List Models', 'List Models', 'GET'], ['valen/api/data-handling', 'Data handling and retention', '数据处理与保留']],
 'valen/sglang': [
  ['valen/sglang-plugin', 'Plugin', '插件部署'],
  ['valen/sglang-image', 'Image', '镜像部署'],
 ],
 'valen/vllm': [['valen/vllm-plugin', 'Plugin', '插件部署'], ['valen/vllm-image', 'Image', '镜像部署']],
};

export function ModernSidebar({onNavigate}: {onNavigate?:()=>void}) {
  const zh = useChinese();
  const {pathname} = useLocation();
  const currentPath = pathname.replace(/^\/zh-Hans/, '');
  const cookbook = isCookbook(pathname);
  const groups = cookbook ? cookbookGroups : docGroups;
  const renderLink = ([id, en, cn, badge, trailingBadge]: string[]) => {
    const path = id.startsWith('/') ? id : `/${cookbook ? 'cookbook' : 'docs'}/${id ? `${id}/` : ''}`;
    return <Link to={path} className={currentPath === path ? 'active' : ''}
      aria-current={currentPath === path ? 'page' : undefined} onClick={onNavigate}>
      {badge && <span className={`modern-badge ${badge === 'POST' ? 'blue' : 'green'}`}>{badge}</span>}<span>{zh ? cn : en}</span>
      {trailingBadge && <span className="modern-sidebar-free">{zh && trailingBadge === 'Free' ? '免费' : trailingBadge}</span>}
    </Link>;
  };
  const renderGroup = (group: typeof docGroups[number]) => <section key={group.title[0]}>
    <h2>{group.title[zh ? 1 : 0]}</h2>
    <ul className="modern-doc-list">{group.items.map(item => <li key={item[0]}>
      {renderLink(item)}
      {deploymentChildren[item[0]] && <ul className="modern-doc-children">
        {deploymentChildren[item[0]].map(child => <li key={child[0]}>{renderLink(child)}</li>)}
      </ul>}
    </li>)}</ul>
  </section>;
  return <nav aria-label={zh ? '文档导航' : 'Documentation navigation'} className="modern-sidebar-nav">
    {groups.map(renderGroup)}
  </nav>;
}
