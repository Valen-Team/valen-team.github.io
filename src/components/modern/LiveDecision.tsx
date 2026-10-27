import React, {useEffect, useRef, useState} from 'react';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {ArrowUp, ArrowUpRight, ChevronDown, CircleHelp, Image as ImageIcon, LoaderCircle, MessageSquarePlus, Paperclip, Play, Plus, Settings2, Square, Type, Video, X} from 'lucide-react';
import {useChinese} from '../Content';
import {getCookbook} from './cookbook';
import {booleanCandidates, buildPayload, Candidate, DecisionAnswer, modelOptions, OutputMode, parseAnswer, scoreCandidates, weightedScore} from './decision';
import {Attachment, fileKind, imageAccept, MediaError, readAttachment, videoAccept} from './media';
import './live-decision.css';

type InputMode = 'text' | 'image' | 'video';
type Turn = {id: number; question: string; answer: DecisionAnswer; candidates: Candidate[]; mode: OutputMode; media?: {preview: string; kind: string; name: string}; model: string};
const blankChoices = (): Candidate[] => [{value: 'option_1', description: ''}, {value: 'option_2', description: ''}];
const outputLabel = (mode: OutputMode, zh: boolean) => ({choice: zh ? '选择答案' : 'Choices', boolean: zh ? '是 / 否' : 'Yes / No', score: zh ? '评分' : 'Rating'}[mode]);
const numberLabel = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function LiveDecision() {
  const zh = useChinese();
  const {search} = useLocation();
  const {siteConfig} = useDocusaurusContext();
  const proxy = String(siteConfig.customFields?.decisionProxyUrl || '');
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [outputMode, setOutputMode] = useState<OutputMode>('boolean');
  const [choices, setChoices] = useState<Candidate[]>(blankChoices);
  const [grades, setGrades] = useState<Candidate[]>(() => scoreCandidates(zh));
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [selected, setSelected] = useState('');
  const [settings, setSettings] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [model, setModel] = useState('valen-2b');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const panel = useRef<HTMLFormElement>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLDialogElement>(null);
  const lastAnswer = useRef<HTMLElement>(null);
  const request = useRef<AbortController | null>(null);
  const mediaTask = useRef<AbortController | null>(null);
  const choiceId = useRef(2);
  const turnId = useRef(0);
  const previousLocale = useRef(zh);
  const objectUrl = useRef<string | undefined>(undefined);
  const cookbook = getCookbook(zh);
  const candidates = outputMode === 'boolean' ? booleanCandidates(zh) : outputMode === 'score' ? grades : choices;
  const locked = busy || reading;

  function replaceAttachment(next: Attachment | null) {
    if (objectUrl.current && objectUrl.current !== next?.objectUrl) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = next?.objectUrl;
    setAttachment(next);
  }
  useEffect(() => () => {request.current?.abort(); mediaTask.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);}, []);
  useEffect(() => {if (turns.length) lastAnswer.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'});}, [turns]);
  useEffect(() => {
    if (previousLocale.current === zh) return;
    previousLocale.current = zh;
    request.current?.abort(); mediaTask.current?.abort();
    setTurns([]); setError(''); setGrades(scoreCandidates(zh));
    const example = getCookbook(zh).find(e => e.id === selected);
    if (example) loadExample(example.id, false);
  }, [zh]);

  useEffect(() => {
    if (new URLSearchParams(search).get('example') === 'ticket') loadExample('text', false);
  }, [search]);

  function loadExample(id: string, scroll = true) {
    const example = getCookbook(zh).find(e => e.id === id);
    if (!example) return;
    setSelected(id); setQuestion(example.question.instructions);
    setContext(id === 'text' ? example.input : ''); setContextOpen(id === 'text');
    setChoices(example.question.choices.map(c => ({...c}))); setOutputMode('choice');
    setInputMode(id as InputMode); setSettings(false); setTurns([]); setError('');
    replaceAttachment(example.asset ? {kind: id === 'video' ? 'video' : 'image', name: id === 'video' ? 'momos.mp4' : 'sheep.jpg', preview: example.asset, image: example.asset, ...(id === 'video' ? {video: '/cookbook/momos.mp4'} : {})} : null);
    if (scroll) {panel.current?.scrollIntoView({behavior: 'smooth', block: 'center'}); text.current?.focus({preventScroll: true});}
  }
  function newConversation() {
    request.current?.abort(); mediaTask.current?.abort(); replaceAttachment(null);
    setQuestion(''); setContext(''); setContextOpen(false); setInputMode('text'); setOutputMode('boolean');
    setChoices(blankChoices()); setGrades(scoreCandidates(zh)); setSelected(''); setSettings(false); setTurns([]); setError('');
    text.current?.focus();
  }
  function switchInput(mode: InputMode) {
    setInputMode(mode); setError(''); setSelected('');
    if (attachment && attachment.kind !== mode) replaceAttachment(null);
  }
  async function upload(value: File) {
    mediaTask.current?.abort();
    const controller = new AbortController(); mediaTask.current = controller;
    setError('');
    try {
      const kind = fileKind(value); setReading(true);
      const next = await readAttachment(value, controller.signal);
      if (controller.signal.aborted) {if (next.objectUrl) URL.revokeObjectURL(next.objectUrl); return;}
      replaceAttachment(next); setInputMode(kind); setSelected('');
    } catch (e) {
      if (controller.signal.aborted) return;
      const code = e instanceof MediaError ? e.code : 'decode';
      setError(code === 'format' ? (zh ? '请选择 JPG、PNG、WebP 图片，或 MP4、WebM 视频。' : 'Choose a JPG, PNG, or WebP image, or an MP4 or WebM video.') : code === 'size' ? (zh ? '图片最大 3 MB，视频最大 20 MB。' : 'Images can be up to 3 MB; videos up to 20 MB.') : (zh ? '无法读取这个文件，请尝试其他文件或浏览器可播放的 MP4 / WebM 视频。' : 'Could not read this file. Try another file or a browser-playable MP4 / WebM video.'));
    } finally {if (mediaTask.current === controller) {mediaTask.current = null; setReading(false);} if (file.current) file.current.value = '';}
  }
  function resultTitle(turn: Turn): string {
    if (turn.mode === 'score') return `${weightedScore(turn.answer, turn.candidates).toFixed(2)} / ${turn.candidates.length - 1}`;
    if (turn.mode === 'boolean') return turn.answer.choice === 'true' ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No');
    return turn.candidates.find(c => c.value === turn.answer.choice)?.description || turn.answer.choice;
  }
  async function run(event: React.FormEvent) {
    event.preventDefault(); if (locked) return;
    setError('');
    if (!question.trim()) {setError(zh ? '先写下你想让 Valen 判断的问题。' : 'Write the question you want Valen to decide.'); text.current?.focus(); return;}
    if (inputMode !== 'text' && !attachment) {setError(zh ? `请先添加${inputMode === 'video' ? '视频' : '图片'}。` : `Attach ${inputMode === 'video' ? 'a video' : 'an image'} first.`); return;}
    if (candidates.some(c => !c.description.trim())) {setError(zh ? '请填好每个候选项或评分档位。' : 'Fill in every choice or rating level.'); return;}
    if (!proxy) {setError(zh ? '服务暂时未配置，请稍后重试。' : 'The service is not configured yet. Please retry later.'); return;}
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort('timeout'), 120000);
    setBusy(true);
    try {
      let image = attachment?.image;
      if (image?.startsWith('/')) {
        const response = await fetch(image, {signal: controller.signal});
        if (!response.ok) throw new Error(zh ? '示例画面加载失败，请重试。' : 'Could not load the example image. Please retry.');
        const blob = await response.blob();
        image = await new Promise<string>((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read the example image.')); reader.readAsDataURL(blob);});
      }
      const recent = turns.slice(-2).map(t => `${t.question}\n${resultTitle(t)}`).join('\n\n');
      const payload = buildPayload({model, question, context, image, mode: outputMode, candidates, history: recent});
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
      const response = await fetch(local ? '/api/decisions' : proxy, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload), signal: controller.signal});
      if (!response.ok) {
        if (response.status === 429) throw new Error(zh ? '当前请求较多，请稍等片刻再试。' : 'Too many requests right now. Please wait a moment and retry.');
        if (response.status === 401 || response.status === 403) throw new Error(zh ? '服务暂时无法接受请求，请稍后重试。' : 'The service cannot accept this request right now. Please retry later.');
        if (response.status === 413) throw new Error(zh ? '文件处理后的大小超出限制，请换一张较小的图片。' : 'The processed image is too large. Try a smaller image.');
        throw new Error(zh ? '暂时没有收到决策结果，请重试。' : 'Could not get a decision just now. Please retry.');
      }
      const answer = parseAnswer(await response.json(), candidates, outputMode);
      if (controller.signal.aborted) return;
      const turn: Turn = {id: ++turnId.current, question: question.trim(), answer, candidates: candidates.map(c => ({...c})), mode: outputMode, model, ...(attachment ? {media: {preview: attachment.image, kind: attachment.kind, name: attachment.name}} : {})};
      setTurns(previous => [...previous.slice(-7), turn]); setQuestion('');
    } catch (e) {
      if (controller.signal.aborted) {if (controller.signal.reason === 'timeout') setError(zh ? '等待时间有些长，请再试一次。' : 'That took too long. Please try again.');}
      else if (e instanceof TypeError) setError(zh ? '无法连接服务，请检查网络后重试。' : 'Could not reach Valen. Check your connection and retry.');
      else if (e instanceof Error && ['model', 'question', 'context', 'candidates', 'image', 'response'].includes(e.message)) setError(zh ? '请检查问题与选项，或稍后重试。' : 'Check your question and choices, or try again shortly.');
      else setError(e instanceof Error ? e.message : (zh ? '请求失败，请重试。' : 'Request failed. Please retry.'));
    } finally {window.clearTimeout(timeout); if (request.current === controller) {request.current = null; setBusy(false);}}
  }

  return <div className="ask-interface">
    {turns.length > 0 && <section className="ask-thread" aria-label={zh ? '与 Valen 的对话' : 'Conversation with Valen'}>
      <div className="ask-thread-actions"><button type="button" disabled={locked} onClick={newConversation}><MessageSquarePlus size={15}/>{zh ? '新对话' : 'New conversation'}</button></div>
      {turns.map((turn, index) => <article key={turn.id} className="ask-turn" ref={index === turns.length - 1 ? lastAnswer : undefined}>
        <div className="ask-user-message">{turn.media && <img src={turn.media.preview} alt={turn.media.name}/>}<p>{turn.question}</p></div>
        <div className="ask-answer"><div className="ask-answer-heading"><span className="ask-valen-avatar">V</span><strong>Valen</strong><span>{outputLabel(turn.mode, zh)}</span></div>
          <h2>{resultTitle(turn)}</h2>{turn.mode === 'score' && <p className="ask-rating-note">{zh ? '原生评分 · 档位从 0 开始，按概率加权' : 'Native score · probability-weighted levels starting at 0'}</p>}
          {turn.answer.probability !== undefined && <p className="ask-rating-note">{zh ? '条件成立的概率' : 'Probability the condition is true'}: <strong>{numberLabel(turn.answer.probability)}</strong></p>}
          <div className="ask-probabilities">{turn.answer.probabilities.map(p => {const candidate = turn.candidates.find(c => c.value === p.value)!; return <div key={p.value} className={p.value === turn.answer.choice ? 'is-chosen' : ''}><div><span>{turn.mode === 'boolean' ? (p.value === 'true' ? zh ? '是' : 'Yes' : zh ? '否' : 'No') : `${turn.mode === 'score' ? `${candidate.score} · ` : ''}${candidate.description}`}</span><strong>{numberLabel(p.probability)}</strong></div><progress value={p.probability} max={1} aria-label={candidate.description}/></div>;})}</div>
          <details className="ask-answer-details"><summary>{zh ? '查看详情' : 'View details'}</summary>{turn.answer.confidence !== undefined && <p>{zh ? '置信度' : 'Confidence'}: {numberLabel(turn.answer.confidence)}</p>}<pre>{JSON.stringify(turn.answer.raw, null, 2)}</pre></details>
        </div>
      </article>)}
    </section>}

    <form ref={panel} className="ask-composer" onSubmit={run} aria-busy={locked} onDragOver={e => {e.preventDefault();}} onDrop={e => {e.preventDefault(); if (!locked && e.dataTransfer.files[0]) void upload(e.dataTransfer.files[0]);}}>
      <fieldset disabled={locked}>
        <label htmlFor="ask-question" className="sr-only">{zh ? '向 Valen 提问' : 'Ask Valen'}</label>
        <textarea id="ask-question" ref={text} rows={2} maxLength={1000} value={question} placeholder={turns.length ? (zh ? '继续提问…' : 'Ask a follow-up…') : (zh ? '想让 Valen 判断什么？' : 'What would you like Valen to decide?')} onChange={e => {setQuestion(e.target.value); setError('');}} onKeyDown={e => {if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {e.preventDefault(); panel.current?.requestSubmit();}}}/>

        {attachment && <div className="ask-attachment"><button type="button" className="ask-media-thumbnail" onClick={() => preview.current?.showModal()} aria-label={zh ? `预览${attachment.kind === 'video' ? '视频' : '图片'}` : `Preview ${attachment.kind}`}><img src={attachment.preview} alt=""/>{attachment.kind === 'video' && <span><Play size={17} fill="currentColor"/></span>}</button><div><strong>{attachment.name}</strong><span>{attachment.kind === 'video' ? (zh ? '视频 · 根据中间画面判断' : 'Video · Decides from the middle frame') : (zh ? '图片已添加' : 'Image attached')}</span><button type="button" onClick={() => preview.current?.showModal()}>{zh ? '查看预览' : 'Preview'}</button></div><button type="button" className="ask-remove-media" aria-label={zh ? '移除附件' : 'Remove attachment'} onClick={() => {replaceAttachment(null); setInputMode('text'); setSelected('');}}><X size={17}/></button></div>}
        {!attachment && inputMode !== 'text' && <button type="button" className="ask-upload-target" onClick={() => file.current?.click()}>{inputMode === 'video' ? <Video size={19}/> : <ImageIcon size={19}/>}<span><strong>{inputMode === 'video' ? (zh ? '添加视频' : 'Add a video') : (zh ? '添加图片' : 'Add an image')}</strong><small>{inputMode === 'video' ? (zh ? 'MP4、WebM · 最大 20 MB · 需浏览器可播放' : 'MP4, WebM · Up to 20 MB · Browser-playable') : (zh ? 'JPG、PNG、WebP · 最大 3 MB' : 'JPG, PNG, WebP · Up to 3 MB')}</small></span><Plus size={18}/></button>}

        {(contextOpen || context) && <div className="ask-context"><div><label htmlFor="ask-context">{zh ? '补充背景' : 'Context'}</label><button type="button" aria-label={zh ? '移除背景' : 'Remove context'} onClick={() => {setContext(''); setContextOpen(false);}}><X size={14}/></button></div><textarea id="ask-context" rows={2} maxLength={3000} value={context} onChange={e => setContext(e.target.value)} placeholder={zh ? '粘贴需要判断的文字，或补充相关信息…' : 'Paste the text to assess, or add relevant context…'}/></div>}

        {outputMode !== 'boolean' && <div className="ask-options-panel"><div className="ask-options-heading"><span>{outputMode === 'score' ? (zh ? '评分标准 · 从低到高' : 'Rating levels · Low to high') : (zh ? '让 Valen 从中选择' : 'Let Valen choose between these')}</span>{outputMode === 'choice' && <span>{choices.length} / 8</span>}</div>
          <div className={`ask-options ${outputMode === 'score' ? 'ask-options--rating' : ''}`} data-odd={candidates.length % 2 !== 0}>{candidates.map((candidate, index) => <div className="ask-option" key={candidate.value}><span>{outputMode === 'score' ? candidate.score : String.fromCharCode(65 + index)}</span><input aria-label={`${outputMode === 'score' ? (zh ? '评分档位' : 'Rating level') : (zh ? '候选项' : 'Choice')} ${index + 1}`} maxLength={280} placeholder={zh ? `选项 ${index + 1}` : `Choice ${index + 1}`} value={candidate.description} onChange={e => {const update = (items: Candidate[]) => items.map(c => c.value === candidate.value ? {...c, description: e.target.value} : c); outputMode === 'score' ? setGrades(update) : setChoices(update);}}/>{outputMode === 'choice' && <button type="button" disabled={choices.length <= 2} onClick={() => setChoices(items => items.filter(c => c.value !== candidate.value))} aria-label={`${zh ? '删除候选项' : 'Remove choice'} ${index + 1}`}><X size={14}/></button>}</div>)}</div>
          {outputMode === 'choice' && <button type="button" className="ask-add-choice" disabled={choices.length >= 8} onClick={() => setChoices(items => [...items, {value: `option_${++choiceId.current}`, description: ''}])}><Plus size={14}/>{zh ? '添加选项' : 'Add choice'}</button>}
        </div>}

        {settings && <div className="ask-settings"><label htmlFor="ask-model">{zh ? '模型' : 'Model'}</label><select id="ask-model" value={model} onChange={e => setModel(e.target.value)}>{modelOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{!contextOpen && !context && <button type="button" onClick={() => setContextOpen(true)}><Plus size={14}/>{zh ? '补充背景' : 'Add context'}</button>}<p>{zh ? '选择答案：自定义候选项；是/否：判断条件是否成立；评分：按五个档位返回加权评分。' : 'Choices: custom alternatives. Yes/No: whether a condition holds. Rating: a weighted score across five levels.'}</p></div>}

        <div className="ask-toolbar"><div className="ask-input-tools"><button className="ask-attach-button" type="button" aria-label={zh ? '添加图片或视频' : 'Attach an image or video'} title={zh ? '图片：JPG / PNG / WebP，3 MB；视频：MP4 / WebM，20 MB' : 'Images: JPG / PNG / WebP, 3 MB. Videos: MP4 / WebM, 20 MB.'} onClick={() => file.current?.click()}><Paperclip size={19}/></button><div className="ask-input-modes" role="group" aria-label={zh ? '输入类型' : 'Input type'}>{([['text', Type, zh ? '文本' : 'Text'], ['image', ImageIcon, zh ? '图片' : 'Image'], ['video', Video, zh ? '视频' : 'Video']] as const).map(([value, Icon, label]) => <button type="button" key={value} aria-pressed={inputMode === value} onClick={() => switchInput(value)}><Icon size={15}/><span>{label}</span></button>)}</div></div><div className="ask-send-tools"><div className="ask-output-select"><label className="ask-output-caption" htmlFor="ask-output">{zh ? '输出' : 'Output'}</label><select aria-label={zh ? '输出类型' : 'Output type'} id="ask-output" value={outputMode} onChange={e => {setOutputMode(e.target.value as OutputMode); setError('');}}>{(['boolean', 'choice', 'score'] as const).map(value => <option value={value} key={value}>{outputLabel(value, zh)}</option>)}</select><ChevronDown size={13}/></div><button className="ask-settings-toggle" type="button" aria-label={zh ? '背景与设置' : 'Context and settings'} aria-expanded={settings} onClick={() => setSettings(value => !value)}><Settings2 size={17}/></button><button className="ask-send" type="submit" aria-label={zh ? '向 Valen 发送问题' : 'Send question to Valen'}><ArrowUp size={21}/><span>{zh ? '发送' : 'Ask Valen'}</span></button></div></div>
        <input className="sr-only" ref={file} type="file" accept={inputMode === 'image' ? imageAccept : inputMode === 'video' ? videoAccept : `${imageAccept},${videoAccept}`} aria-label={zh ? '选择图片或视频文件' : 'Choose an image or video file'} onChange={e => {const value = e.target.files?.[0]; if (value) void upload(value);}}/>
      </fieldset>
      {locked && <div className="ask-working" role="status"><LoaderCircle className="ask-spinner" size={16}/>{reading ? (zh ? '正在读取附件…' : 'Reading your attachment…') : (zh ? 'Valen 正在判断…' : 'Valen is deciding…')}{busy && <button type="button" onClick={() => request.current?.abort('cancelled')}><Square size={12}/>{zh ? '停止' : 'Stop'}</button>}</div>}
    </form>
    {error && <p className="ask-error" role="alert"><CircleHelp size={16}/>{error}</p>}
    <p className="ask-footnote">{zh ? '文字、图片、视频，都可以问 · 内容将发送至 Valen 服务' : 'Text, images, or video. Ask away. · Inputs are sent to Valen'}</p>

    <section className="ask-examples" aria-labelledby="ask-examples-title"><div className="ask-examples-heading"><h2 id="ask-examples-title">{zh ? '不知道从哪里开始？' : 'A few things you can ask'}</h2><span>{zh ? '选一个问题试试' : 'Pick a question to get started'}</span></div><div className="ask-example-grid">{cookbook.map((example, index) => <button type="button" className={selected === example.id ? 'is-selected' : ''} key={example.id} disabled={locked} onClick={() => loadExample(example.id)}><div className="ask-example-top"><span>{index === 0 ? <Type size={16}/> : index === 1 ? <ImageIcon size={16}/> : <Video size={16}/>} {index === 0 ? (zh ? '读一段文字' : 'Read a message') : index === 1 ? (zh ? '看一张图片' : 'Look at an image') : (zh ? '看一段视频' : 'Look at a video')}</span><ArrowUpRight size={15}/></div><div className="ask-example-body">{example.asset && <img src={example.asset} alt="" loading="lazy"/>}<p>{index === 0 ? (zh ? '这位客户想做什么？' : 'What does this customer need?') : index === 1 ? (zh ? '这群动物应该怎样称呼？' : 'What is this group of animals called?') : (zh ? '左边的酱料是什么颜色？' : 'What color is the sauce on the left?')}</p></div></button>)}</div></section>

    <dialog aria-label={zh ? '附件预览' : 'Attachment preview'} className="ask-preview" ref={preview} onClick={e => {if (e.target === e.currentTarget) preview.current?.close();}} onClose={() => {const video = preview.current?.querySelector('video'); video?.pause();}}><div className="ask-preview-header"><strong>{attachment?.name}</strong><button type="button" aria-label={zh ? '关闭预览' : 'Close preview'} onClick={() => preview.current?.close()}><X size={20}/></button></div>{attachment?.kind === 'video' ? <video controls playsInline preload="none" poster={attachment.preview} src={attachment.video}/> : attachment && <img src={attachment.preview} alt={attachment.name}/>}</dialog>
  </div>;
}
