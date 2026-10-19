import React, {useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';
import useBaseUrl from '@docusaurus/useBaseUrl';
import ProjectCards from '../components/ProjectCards';
import DecisionArt from '../components/DecisionArt';
import {Arrow} from '../components/Icons';
import {updates, useChinese} from '../components/Content';

const apiCode = `# python -m pip install requests
import requests

response = requests.post(
    "https://llm-proxy.openxxlab.com/v1/decisions",
    json={
        "model": "valen-2b",
        "input": "A cat is sitting on the sofa.",
        "questions": [{
            "name": "animal",
            "type": "choice",
            "instructions": "Which animal is present?",
            "choices": [
                {"value": "cat", "description": "A cat"},
                {"value": "dog", "description": "A dog"},
            ],
        }],
        "temperature": 1.0,
    },
    timeout=120,
)
response.raise_for_status()
print(response.json()["answers"][0])`;

const localCode = `from transformers import AutoModel

model = AutoModel.from_pretrained(
    "Valen-Team/Valen-0.8B",
    trust_remote_code=True, dtype="auto",
    attn_implementation="sdpa",
).to("cuda").eval()

answer = model.predict({
    "state": "A cat is sitting on the sofa.",
    "questions": {"animal": {
        "type": "choice",
        "instructions": "Which animal is present?",
        "criteria": {"cat": "A cat", "dog": "A dog"},
    }},
}, execution="shared_state")
print(answer)`;

const evalCode = `# From the JevalKit repository
python -m pip install -e '.[hf,data]'
export JEVALKIT_DATA_ROOT="$PWD/data"

# Download a model and a ready-to-use benchmark
hf download Valen-Team/Valen-0.8B \\
  --local-dir "$JEVALKIT_DATA_ROOT/models/Valen-0.8B"
hf download Valen-Team/JevalKit_Datasets --repo-type dataset \\
  --include "datasets/JevBench.tsv" --local-dir "$JEVALKIT_DATA_ROOT"

python -m jevalkit run --model Valen-0.8B --data JevBench \\
  --option model="$JEVALKIT_DATA_ROOT/models/Valen-0.8B" \\
  --output "$JEVALKIT_DATA_ROOT/results"`;

const quickstarts = [
  {label: 'Valen API', code: apiCode, language: 'python', badge: 'PYTHON', guide: '/docs/valen/api/', action: ['Read the API guide', '查看 API 指南'], note: ['Install requests to call the API. No model download or local GPU required.', '安装 requests 即可调用，无需下载模型或准备本地 GPU。']},
  {label: 'Transformers', code: localCode, language: 'python', badge: 'PYTHON', guide: '/docs/valen/quickstart/', action: ['Run Valen locally', '在本地运行 Valen'], note: ['Local inference requires a CUDA GPU and model dependencies. See the setup guide.', '本地推理需要 CUDA GPU 与模型依赖，环境配置见入门指南。']},
  {label: 'JevalKit', code: evalCode, language: 'bash', badge: 'SHELL', guide: '/docs/jevalkit/quickstart/', action: ['Run an evaluation', '开始运行评测'], note: ['The JevalKit example requires model weights and data. See the setup guide.', 'JevalKit 示例需准备模型与数据，环境要求见入门指南。']},
];

export default function Home() {
  const zh = useChinese(); const l = zh ? 1 : 0; const [tab, setTab] = useState(0);
  const example = quickstarts[tab];
  return <Layout title={zh ? '快速决策，持续进化' : 'Fast Decisions. Continuous Evolution.'} description={zh ? '万澜团队：开放多模态决策模型、评测工具与数据集。探索 Valen、JevalKit 和 VisualDecisionBench。' : 'Open models, benchmarks, and tools for fast multimodal decision-making. Explore Valen, JevalKit, and VisualDecisionBench.'}>
    <main className="home">
      <section className="hero-section">
        <div className="site-container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow"><span className="status-dot"/>{zh ? '万澜团队 · 开放研究，开放源码' : 'VALEN TEAM · OPEN RESEARCH, OPEN SOURCE'}</p>
            <h1>{zh ? <>快速决策。<br/><span>持续进化。</span></> : <>Fast decisions.<br/><span>Continuous<br className="desktop-break"/> evolution.</span></>}</h1>
            <p className="hero-description">{zh ? '我们构建开放的多模态决策模型与工具，让智能体理解环境、选择行动，并在反馈中持续进化。' : 'We build open models and tools for fast multimodal decision-making. Helping agents perceive, choose, and evolve.'}</p>
            <div className="hero-actions"><Link className="v-button primary-button" to="/docs/">{zh ? '阅读文档' : 'Read the docs'}<Arrow/></Link><Link className="v-link text-button" to="/projects/">{zh ? '探索项目' : 'Explore projects'}<Arrow diagonal/></Link></div>
            <div className="hero-note"><span className="tiny-cross">+</span>{zh ? '开放模型 · 开放工具 · 共同构建' : 'Open models. Open tools. Built to be shared.'}</div>
          </div>
          <DecisionArt/>
        </div>
        <div className="site-container hero-bottom"><span>01 / {zh ? '感知' : 'PERCEIVE'}</span><span>02 / {zh ? '决策' : 'DECIDE'}</span><span>03 / {zh ? '进化' : 'EVOLVE'}</span><a href="#projects" aria-label={zh ? '滚动到项目' : 'Scroll to projects'}>↓</a></div>
      </section>

      <section id="projects" className="section site-container">
        <div className="section-heading"><div><p className="eyebrow">{zh ? '01 / 开放生态' : '01 / THE OPEN ECOSYSTEM'}</p><h2>{zh ? '从模型，到实践。' : 'From models to meaningful action.'}</h2></div><Link className="v-link text-button" to="/projects/">{zh ? '全部项目' : 'All projects'}<Arrow/></Link></div>
        <ProjectCards/>
        <div className="dataset-strip"><span className="dataset-icon">▤</span><div><strong>VisualDecisionBench</strong><span>{zh ? '图像与视频决策评测，为多模态能力提供共同参照。' : 'A shared reference for decisions grounded in images and video.'}</span></div><Link to="/benchmarks/">{zh ? '探索 Benchmark' : 'Explore the benchmark'}<Arrow diagonal/></Link></div>
      </section>

      <section className="demo-section">
        <div className="site-container demo-grid"><div className="demo-visual"><img src={useBaseUrl('/demos/sokoban.gif')} alt={zh ? 'Valen 在 Sokoban 中逐步推箱子完成关卡的真实演示' : 'Recorded Valen rollout solving a Sokoban puzzle'} loading="lazy" width="560" height="440"/><div className="demo-visual-caption"><span className="status-dot"/>{zh ? '真实模型演示' : 'RECORDED MODEL ROLLOUT'}<span>SOKOBAN ↗</span></div></div><div className="demo-copy"><p className="eyebrow">{zh ? '02 / 看见，然后行动' : '02 / PERCEPTION MEETS ACTION'}</p><h2>{zh ? <>理解当前。<br/>决定下一步。</> : <>Understand the state.<br/>Choose the next step.</>}</h2><p>{zh ? '把任务、环境和候选行动交给模型。Valen 读取视觉状态，对候选动作评分，将概率交给你的应用。' : 'Give the model a task, an environment, and possible actions. Valen reads the visual state and returns probabilities over the next move.'}</p><ol className="decision-steps"><li><span>01</span><div><strong>{zh ? '观察' : 'Observe'}</strong><p>{zh ? '读取文本、图片或视频中的共享状态。' : 'Read a shared state from text, images, or video.'}</p></div></li><li><span>02</span><div><strong>{zh ? '决策' : 'Decide'}</strong><p>{zh ? '依据任务要求，对候选项输出概率。' : 'Score candidates against the task instructions.'}</p></div></li><li><span>03</span><div><strong>{zh ? '行动' : 'Act'}</strong><p>{zh ? '将结构化结果接入智能体工作流。' : 'Use structured results in your agent workflow.'}</p></div></li></ol><a className="v-link text-button" href="https://huggingface.co/spaces/yuhangzang/Valen-Preview-0923">{zh ? '体验在线 Demo' : 'Try the live demo'}<Arrow diagonal/></a></div></div>
      </section>

      <section className="section site-container news-section"><div className="section-heading"><div><p className="eyebrow">{zh ? '03 / 最新进展' : '03 / LATEST UPDATES'}</p><h2>{zh ? '持续向前。' : 'Always moving forward.'}</h2></div><Link className="v-link text-button" to="/news/">{zh ? '全部动态' : 'All news'}<Arrow/></Link></div><div className="news-list">{updates.map(n => <Link className="news-row" to={n.slug} key={n.slug}><time dateTime={n.date}>{n.date}</time><div><span className="eyebrow news-type">{n.type[l]}</span><h3>{n.title[l]}</h3><p>{n.description[l]}</p></div><Arrow diagonal/></Link>)}</div></section>

      <section id="quickstart" className="quickstart-section">
        <div className="site-container quickstart-grid">
          <div>
            <p className="eyebrow">{zh ? '04 / 开始构建' : '04 / START BUILDING'}</p>
            <h2>{zh ? <>下一步，<br/>由你决定。</> : <>Your next decision<br/>starts here.</>}</h2>
            <p>{zh ? '通过 API 调用 Valen，使用 Transformers 在本地运行，或通过 JevalKit 进行评测。选择适合你的方式开始。' : 'Call Valen through the API, run it locally with Transformers, or evaluate models with JevalKit. Choose where to start.'}</p>
            <Link className="v-button primary-button" to={example.guide}>{example.action[l]}<Arrow/></Link>
            <p className="runtime-note">{example.note[l]}</p>
          </div>
          <div className="code-panel">
            <div className="code-tabs" role="tablist" aria-label={zh ? '选择入门示例' : 'Choose a quickstart example'}>
              {quickstarts.map((item, i) => <button key={item.label} id={`quickstart-tab-${i}`} role="tab" aria-selected={tab === i} aria-controls="quickstart-code" tabIndex={tab === i ? 0 : -1} onClick={() => setTab(i)} onKeyDown={e => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                  e.preventDefault();
                  const next = e.key === 'Home' ? 0 : e.key === 'End' ? quickstarts.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + quickstarts.length) % quickstarts.length;
                  setTab(next);
                  document.getElementById(`quickstart-tab-${next}`)?.focus();
                }
              }}>{item.label}</button>)}
              <span>{example.badge}</span>
            </div>
            <div id="quickstart-code" role="tabpanel" aria-labelledby={`quickstart-tab-${tab}`} tabIndex={0}>
              <CodeBlock key={example.label} language={example.language}>{example.code}</CodeBlock>
            </div>
          </div>
        </div>
      </section>

      <section className="community-section site-container"><div><p className="eyebrow">{zh ? '共同构建' : 'BUILT IN THE OPEN'}</p><h2>{zh ? '让下一个想法，成为可能。' : 'Make the next idea possible.'}</h2><p>{zh ? '欢迎贡献模型、数据、评测任务与应用，和我们一起探索决策的未来。' : 'Contribute a model, a dataset, a benchmark, or an idea. Help shape what comes next.'}</p></div><a className="v-button primary-button" href="https://github.com/Valen-Team">{zh ? '在 GitHub 上加入我们' : 'Build with us on GitHub'}<Arrow diagonal/></a></section>
    </main>
  </Layout>;
}
