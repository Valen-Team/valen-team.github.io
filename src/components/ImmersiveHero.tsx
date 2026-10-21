import React, {useRef} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useChinese} from './Content';
import {Arrow} from './Icons';

export default function ImmersiveHero({onSelectQuickstart}: {onSelectQuickstart: (index: number) => void}) {
  const zh = useChinese();
  const stage = useRef<HTMLDivElement>(null);
  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    stage.current?.style.setProperty('--scene-x', `${((event.clientX - rect.left) / rect.width - .5) * 12}px`);
    stage.current?.style.setProperty('--scene-y', `${((event.clientY - rect.top) / rect.height - .5) * 8}px`);
  }
  function reset() {stage.current?.style.setProperty('--scene-x', '0px'); stage.current?.style.setProperty('--scene-y', '0px');}
  return <>
    <header className="immersive-intro site-container">
      <p className="eyebrow">VALEN TEAM / {zh ? '开放研究，持续向前' : 'OPEN RESEARCH. ALWAYS FORWARD.'}</p>
      <h1>{zh ? <>快速决策。<em>持续进化。</em></> : <>Fast decisions. <em>Continuous evolution.</em></>}</h1>
    </header>
    <section className="immersive-feature site-container" aria-labelledby="featured-valen-title">
      <div className="immersive-stage" ref={stage} onPointerMove={move} onPointerLeave={reset}>
        <img className="immersive-scene" src={useBaseUrl('/img/valen-glass-scene.webp')} alt={zh ? '蓝色 V 波浪的玻璃材质品牌概念雕塑，具有光照、折射与空间层次' : 'Brand concept: the blue Valen wave as a dimensional glass sculpture with light and refraction'} width="1774" height="887" fetchPriority="high"/>
        <div className="immersive-shade"/>
        <div className="immersive-product-copy">
          <p className="immersive-overline">{zh ? '多模态 SYSTEM ONE 模型' : 'MULTIMODAL SYSTEM ONE MODEL'}</p>
          <h2 id="featured-valen-title">Valen</h2>
          <p>{zh ? '理解文本、图像与视频，\n输出候选项的决策概率。' : 'Text, images, and video in.\nStructured decisions out.'}</p>
          <div className="immersive-actions"><Link to="/docs/valen/api/">{zh ? '从 API 开始' : 'Start with the API'}<Arrow/></Link><a href="https://huggingface.co/Valen-Team">{zh ? '探索模型' : 'Explore models'}<Arrow diagonal/></a></div>
        </div>
        <div className="immersive-stage-meta"><span>{zh ? '开放权重' : 'OPEN WEIGHTS'} <strong>0.8B / 2B / 4B</strong></span><span>TEXT · IMAGE · VIDEO</span></div>
      </div>
      <nav className="immersive-entry-rail" aria-label={zh ? '选择开始方式' : 'Choose how to start'}>
        {[['Valen API', zh ? '一次请求，开始决策' : 'Your first decision, one request away'], ['Transformers', zh ? '下载权重，在本地运行' : 'Open weights, on your own machine'], ['JevalKit', zh ? '评测、比较、复现' : 'Evaluate. Compare. Reproduce.']].map(([label,description],i)=><a key={label} href="#quickstart" onClick={()=>onSelectQuickstart(i)}><span><strong>{label}</strong><small>{description}</small></span><Arrow/></a>)}
      </nav>
    </section>
  </>;
}
