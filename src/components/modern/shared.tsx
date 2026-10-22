import React,{useEffect,useRef,useId} from 'react';
import {useLocation} from '@docusaurus/router';
import Link from '@docusaurus/Link';
import {useChinese} from '../Content';
import {ArrowUpRight, GitBranch} from 'lucide-react';
export const isModern = (path: string) => /^\/(?:zh-Hans\/?)?$/.test(path) || /\/(?:minimal|docs)(?:\/|$)/.test(path);
export const isModernDoc = (path: string) => path.includes('/docs');
// The supplied Valen mark, rendered as a monochrome SVG mask; source image is unchanged.
export function ModernMark(){const id=useId().replaceAll(':','');return <svg width="30" height="26" viewBox="140 210 740 580" fill="none" aria-hidden="true"><defs><filter id={`mark-filter-${id}`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -.2126 -.7152 -.0722 1 0"/><feComponentTransfer><feFuncA type="table" tableValues="0 1 1"/></feComponentTransfer></filter><mask id={`mark-mask-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><image href="/img/valen-mark.png" width="1000" height="1000" filter={`url(#mark-filter-${id})`}/></mask></defs><path fill="currentColor" mask={`url(#mark-mask-${id})`} d="M0 0h1000v1000H0z"/></svg>;}
export function ModernBrand(){return <Link className="modern-brand" to="/"><ModernMark/><span>valen</span></Link>;}
export function ModernFooter(){const zh=useChinese();const footer=useRef<HTMLElement>(null);useEffect(()=>{const el=footer.current;if(!el||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;el.classList.add('will-reveal');const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){el.classList.add('in-view');observer.disconnect();}},{threshold:.08});observer.observe(el);return()=>observer.disconnect();},[]);return <footer className="modern-footer" ref={footer}><div className="modern-footer-brand"><ModernBrand/><p>© 2026 Valen Team / 万澜</p><p>{zh?'快速决策，持续进化。':'Fast decisions. Continuous evolution.'}</p><div className="modern-social"><a aria-label="GitHub" href="https://github.com/Valen-Team"><GitBranch size={17}/></a><a aria-label="Hugging Face" href="https://huggingface.co/Valen-Team"><ArrowUpRight size={18}/></a></div></div>{[[zh?'构建':'Build',[[zh?'文档':'Documentation','/docs/'],['Valen API','/docs/valen/api/'],[zh?'本地推理':'Local inference','/docs/valen/quickstart/']]],[zh?'探索':'Explore',[['JevalKit','/docs/jevalkit/'],[zh?'模型与数据':'Models & datasets','https://huggingface.co/Valen-Team'],[zh?'排行榜':'Leaderboard','https://huggingface.co/spaces/Valen-Team/JevalKit-Leaderboard']]]].map(([title,items])=><div className="modern-footer-column" key={title as string}><h2>{title as string}</h2>{(items as string[][]).map(([label,to])=><Link key={label} to={to}>{label}</Link>)}</div>)}</footer>;}
export const docGroups = [
 {title:['GET STARTED','开始使用'],items:[['','Project introduction','项目介绍'],['valen','Model overview','模型介绍']]},
 {title:['INTEGRATION','接入方式'],items:[['valen/api','API calls','API 调用','POST'],['valen/sglang','SGLang deployment','SGLang 部署'],['valen/quickstart','Transformers inference','Transformers 推理']]},
 {title:['REFERENCE','参考'],items:[['valen/data-format','Data format','数据格式'],['valen/architecture','Architecture','模型架构'],['valen/qwen-shared-state','Shared state','共享状态'],['valen/configuration','Configuration','配置参数'],['valen/evaluation','Evaluation','模型评测']]},
 {title:['JEVALKIT','JEVALKIT'],items:[['jevalkit','Overview','概览'],['jevalkit/quickstart','Quickstart','快速开始'],['jevalkit/models','Model interfaces','模型接口'],['jevalkit/benchmarks','Benchmarks','评测任务']]},
 {title:['RESOURCES','资源'],items:[['resources','Links & resources','链接与资源'],['contributing','Contributing','参与贡献']]},
];
const sglangChildren = [
  ['valen/sglang-plugin', 'Plugin', '插件部署'],
  ['valen/sglang-image', 'Image', '镜像部署'],
];

export function ModernSidebar({onNavigate}: {onNavigate?:()=>void}) {
  const zh = useChinese();
  const {pathname} = useLocation();
  const currentPath = pathname.replace(/^\/zh-Hans/, '');
  const renderLink = ([id, en, cn, badge]: string[]) => {
    const path = `/docs/${id ? `${id}/` : ''}`;
    return <Link to={path} className={currentPath === path ? 'active' : ''}
      aria-current={currentPath === path ? 'page' : undefined} onClick={onNavigate}>
      {badge && <span className="modern-badge green">{badge}</span>}<span>{zh ? cn : en}</span>
    </Link>;
  };
  return <nav aria-label={zh ? '文档导航' : 'Documentation navigation'} className="modern-sidebar-nav">
    {docGroups.map(group => <section key={group.title[0]}>
      <h2>{group.title[zh ? 1 : 0]}</h2>
      <ul className="modern-doc-list">{group.items.map(item => <li key={item[0]}>
        {renderLink(item)}
        {item[0] === 'valen/sglang' && <ul className="modern-doc-children">
          {sglangChildren.map(child => <li key={child[0]}>{renderLink(child)}</li>)}
        </ul>}
      </li>)}</ul>
    </section>)}
  </nav>;
}
