import React, {useEffect, useState} from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import {useLocation} from '@docusaurus/router';
import CodeBlock from '@theme/CodeBlock';
import Link from '@docusaurus/Link';
import {Code2, Terminal, ArrowUpRight} from 'lucide-react';
import {useChinese} from '../Content';
import {decisionPayload, requestCode, localExample, evalExample, sglangStartExample, sglangRequestExample, vllmStartExample, vllmRequestExample, vllmImageStartExample} from './examples';

export default function DocExample() {
  const zh = useChinese();
  const {metadata} = useDoc();
  const {search} = useLocation();
  const api = metadata.id === 'valen/api' || metadata.id === 'intro';
  const plugin = metadata.id === 'valen/sglang-plugin';
  const sglang = plugin || metadata.id === 'valen/sglang-image';
  const vllmPlugin = metadata.id === 'valen/vllm-plugin';
  const vllm = vllmPlugin || metadata.id === 'valen/vllm-image';
  const deployment = sglang || vllm;
  const jev = metadata.id.startsWith('jevalkit/');
  const [language, setLanguage] = useState('python');
  const [deploymentStep, setDeploymentStep] = useState('start');
  const [draft, setDraft] = useState<ReturnType<typeof decisionPayload> | null>(null);
  const [filename, setFilename] = useState('image.jpg');

  useEffect(() => {
    if (!api || !search.includes('playground=1')) { setDraft(null); return; }
    try {
      const value = sessionStorage.getItem('valen-modern-draft');
      if (value) {
        const parsed = JSON.parse(value);
        setDraft(parsed.payload || parsed);
        setFilename(parsed.filename || 'image.jpg');
      }
    } catch { setDraft(null); }
  }, [api, search]);

  const lang = api ? language : deployment || jev ? 'bash' : 'python';
  const code = api ? requestCode(draft || undefined, language, filename)
    : vllm ? (deploymentStep === 'start' ? (vllmPlugin ? vllmStartExample : vllmImageStartExample) : vllmRequestExample)
    : sglang ? (deploymentStep === 'start' ? (plugin ? 'bash /absolute/path/to/serving-kit/sglang/install.sh\nMODEL=/absolute/path/to/Valen-2B CUDA_VISIBLE_DEVICES=0 bash /absolute/path/to/serving-kit/sglang/serve.sh' : sglangStartExample) : sglangRequestExample)
    : jev ? evalExample : localExample;
  const tabs = api ? [{id: 'python', label: 'PYTHON'}, {id: 'bash', label: 'cURL'}]
    : deployment ? [{id: 'start', label: zh ? '启动服务' : 'START SERVER'}, {id: 'request', label: zh ? '发送请求' : 'SEND REQUEST'}]
    : [{id: lang, label: jev ? 'SHELL' : 'PYTHON'}];
  const selected = deployment ? deploymentStep : lang;
  const selectTab = (id: string) => deployment ? setDeploymentStep(id) : setLanguage(id);
  const selectedIndex = tabs.findIndex(tab => tab.id === selected);
  const guide = api ? 'https://github.com/Valen-Team/Valen/blob/main/cookbook/api_quickstart.ipynb'
    : vllm ? `/docs/valen/${vllmPlugin ? 'vllm-plugin' : 'vllm-image'}/#${zh ? '发送图片请求' : 'send-an-image-request'}`
    : sglang ? `/docs/valen/${plugin ? 'sglang-plugin' : 'sglang-image'}/#${zh ? '发送图片请求' : 'send-an-image-request'}`
    : jev ? '/docs/jevalkit/quickstart/' : '/docs/valen/quickstart/';
  const note = api && draft
    ? Array.isArray(draft.input)
      ? (zh ? '已带入你的输入。请在所选图片的目录中运行示例；尚未发送到模型。' : 'Your input is included. Run this example beside the selected file. No model request has been sent.')
      : (zh ? '已带入你的输入。这是请求预览，尚未发送到模型。' : 'Your input is included. This request preview has not been sent to a model.')
    : api ? (zh ? '免费示例无需 Key。安装 requests 后即可运行；更高额度请邮件申请。' : 'The free example needs no key. Install requests to run it; request higher quotas by email.')
    : deployment ? (deploymentStep === 'start'
      ? (plugin || vllmPlugin) ? (zh ? `在指定版本的 ${vllm ? 'vLLM' : 'SGLang'} 环境中安装插件并启动服务。` : `Install the plugin in the required ${vllm ? 'vLLM' : 'SGLang'} environment and start the server.`) : (zh ? '先在终端启动容器，等待模型加载完成，再切换到「发送请求」。' : 'Start the container in a terminal. Once the model is ready, switch to SEND REQUEST.')
      : (zh ? '在另一个终端发送请求。model 名称与启动参数保持一致，结果在 answers 中按问题 ID 返回。' : 'Send this from another terminal. The model name matches the server; answers are keyed by question ID.'))
    : jev ? (zh ? '安装后先准备评测数据与模型，完整步骤见指南。' : 'Prepare the model and benchmark data after installation.')
    : (zh ? '在 Python 环境中加载模型。需要兼容的 CUDA GPU 和 Transformers 依赖。' : 'Load the model in Python with a compatible CUDA GPU and Transformers dependencies.');

  if (metadata.id === 'valen/sglang' || metadata.id === 'valen/vllm') return null;

  return <aside className="modern-example">
    <div className="modern-example-label"><span>{vllm ? (vllmPlugin ? 'VLLM · PLUGIN / HTTP' : 'VLLM · DOCKER / HTTP') : sglang ? (plugin ? 'SGLANG · PLUGIN / HTTP' : 'SGLANG · DOCKER / HTTP') : zh ? '代码示例' : 'CODE EXAMPLE'}</span><span>01</span></div>
    <div className="modern-code-panel">
      <div className="modern-code-tabs" role="tablist" aria-label={deployment ? (zh ? '部署步骤' : 'Deployment steps') : (zh ? '示例语言' : 'Example language')}>
        {tabs.map((tab, index) => <button key={tab.id} role="tab" id={`modern-code-tab-${index}`} aria-selected={selected === tab.id} aria-controls="modern-code-example" tabIndex={selected === tab.id ? 0 : -1}
          onKeyDown={event => {
            if (tabs.length < 2 || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
            selectTab(tabs[next].id);
            document.getElementById(`modern-code-tab-${next}`)?.focus();
          }} onClick={() => selectTab(tab.id)}>
          {tab.id === 'python' ? <Code2 size={13}/> : <Terminal size={13}/>}<span>{tab.label}</span>
        </button>)}
      </div>
      <div role="tabpanel" id="modern-code-example" aria-labelledby={`modern-code-tab-${selectedIndex}`}><CodeBlock language={lang} showLineNumbers>{code}</CodeBlock></div>
    </div>
    <p className="modern-example-note">{note}</p>
    <Link className="modern-example-link" to={guide}>{deployment ? (zh ? '查看图片请求示例' : 'See the image request example') : (zh ? '查看完整示例' : 'Open the full guide')}<ArrowUpRight size={14}/></Link>
  </aside>;
}
