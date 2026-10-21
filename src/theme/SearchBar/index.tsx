import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import Link from '@docusaurus/Link';
import {useChinese} from '../../components/Content';

type Entry = {title: string; path: string; locale: string; section: string; text: string};

export default function SearchBar() {
  const zh = useChinese();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {e.preventDefault(); setOpen(v => !v);}
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement as HTMLElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => {cancelAnimationFrame(frame); document.body.style.overflow = previous; returnTo.current?.focus();};
  }, [open]);

  useEffect(() => {
    if (!open || entries.length) return;
    const controller = new AbortController(); setLoading(true); setFailed(false);
    fetch('/search-index.json', {signal: controller.signal})
      .then(r => {if (!r.ok) throw new Error('Search unavailable'); return r.json();})
      .then(setEntries).catch(e => {if (e.name !== 'AbortError') setFailed(true);})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [open, entries.length]);

  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = entries.filter(e => e.locale === (zh ? 'zh-Hans' : 'en'))
    .map(e => ({...e, score: terms.reduce((total, term) => total + (e.title.toLowerCase().includes(term) ? 10 : 0) + (e.section.toLowerCase().includes(term) ? 4 : 0) + (e.text.toLowerCase().includes(term) ? 1 : 0), 0)}))
    .filter(e => !terms.length || terms.every(term => `${e.title} ${e.section} ${e.text}`.toLowerCase().includes(term)))
    .sort((a,b) => b.score - a.score).slice(0, 8);

  return <>
    <button className="search-trigger" ref={trigger} aria-label={zh ? '搜索文档' : 'Search documentation'} onClick={() => {setQuery(''); setActive(0); setOpen(true);}}><svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.4"/></svg><span>{zh ? '搜索' : 'Search'}</span><kbd>⌘ K</kbd></button>
    {open && typeof document !== 'undefined' && createPortal(<div className="search-backdrop" onMouseDown={e => {if (e.target === e.currentTarget) setOpen(false);}}><div className="search-dialog" role="dialog" aria-modal="true" aria-label={zh ? '搜索文档' : 'Search documentation'} ref={dialog} onKeyDown={e => {
      if (e.key === 'Escape') {e.preventDefault(); setOpen(false);}
      if (e.key === 'Tab') {const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('input, button, a[href]') || []); const first = elements[0], last = elements[elements.length - 1]; if (e.shiftKey && document.activeElement === first) {e.preventDefault(); last?.focus();} else if (!e.shiftKey && document.activeElement === last) {e.preventDefault(); first?.focus();}}
    }}>
      <div className="search-input-wrap"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.4"/></svg><input ref={input} type="search" value={query} aria-label={zh ? '输入搜索词' : 'Search terms'} placeholder={zh ? '搜索文档…' : 'Search documentation…'} onChange={e => {setQuery(e.target.value); setActive(0);}} onKeyDown={e => {if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {e.preventDefault(); setActive(v => (v + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(results.length,1));} if (e.key === 'Enter' && results.length) {e.preventDefault(); dialog.current?.querySelectorAll<HTMLAnchorElement>('.search-result')[active]?.click();}}} aria-controls="search-results"/><button onClick={() => setOpen(false)} aria-label={zh ? '关闭搜索' : 'Close search'}>Esc</button></div>
      <div className="search-results" id="search-results" aria-live="polite">{loading ? <p className="search-empty">{zh ? '正在加载搜索索引…' : 'Loading search index…'}</p> : failed ? <p className="search-empty">{zh ? '搜索暂时不可用。请通过 Docs 目录浏览文档。' : 'Search is unavailable. Browse the Docs navigation to find a guide.'}</p> : results.length ? results.map((r,i) => <Link key={r.path} to={r.path} className={`search-result ${i === active ? 'search-result-active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => setOpen(false)}><span className="search-result-section">{r.section}</span><strong>{r.title}</strong><span>↗</span></Link>) : <p className="search-empty">{zh ? '没有找到结果，试试 Valen、评测或 API。' : 'No results. Try Valen, evaluation, or API.'}</p>}</div>
      <div className="search-footer"><span>{zh ? '↑↓ 选择 · Enter 打开 · Esc 关闭' : '↑↓ to select · Enter to open · Esc to close'}</span><span>{zh ? '本站搜索' : 'SITE SEARCH'}</span></div>
    </div></div>, document.body)}
  </>;
}
