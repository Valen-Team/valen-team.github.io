import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import {Sparkles,ArrowRight} from 'lucide-react';
import {useChinese} from '../components/Content';
import LiveDecision from '../components/modern/LiveDecision';
export default function MinimalHome(){const zh=useChinese();
return <Layout title={zh?'快速决策，持续进化。':'Fast Decisions. Continuous Evolution.'} description={zh?'Valen 多模态决策模型，理解上下文，连接下一步行动。':'Multimodal decision models. Understand the context. Choose what comes next.'}><Head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Inter:wght@400;600&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet"/></Head><main className="modern-landing ask-landing"><div className="modern-atmosphere" aria-hidden="true"><div className="modern-glow glow-one"/><div className="modern-glow glow-two"/><div className="modern-glow glow-three"/><div className="modern-grid"/></div><div className="modern-hero"><Link className="modern-announcement" to="/docs/valen/"><Sparkles size={15}/><span>{zh?'快速决策，持续进化。':'Fast Decisions. Continuous Evolution.'}</span><ArrowRight size={15}/></Link><h1>{zh?'问问 Valen':'Ask Valen'}</h1><LiveDecision/></div><div className="modern-bottom-note"><span/>{zh?'开放模型。清晰决策。':'Open models. Clear decisions.'}<span/></div></main></Layout>;}
