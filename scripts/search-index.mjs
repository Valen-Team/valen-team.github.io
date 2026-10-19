import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const entries = [];
function walk(dir) {
  return readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : /\.mdx?$/.test(e.name) ? [join(dir,e.name)] : []);
}
function field(frontmatter, name) {
  const value = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  if (!value) return '';
  try {return JSON.parse(value);} catch {return value.replace(/^['"]|['"]$/g, '');}
}
for (const locale of ['en', 'zh-Hans']) {
  const prefix = locale === 'en' ? '' : '/zh-Hans';
  for (const type of ['docs', 'blog']) {
    const dir = join(root, locale === 'en' ? type : `i18n/zh-Hans/docusaurus-plugin-content-${type === 'docs' ? 'docs/current' : 'blog'}`);
    for (const file of walk(dir)) {
      const raw = readFileSync(file, 'utf8');
      const [, fm, body] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || ['', '', raw];
      const name = relative(dir, file).replace(/\.mdx?$/, '');
      const slug = field(fm, 'slug');
      const title = field(fm, 'title') || body.match(/^# (.+)$/m)?.[1] || name;
      const path = type === 'docs' ? `${prefix}/docs/${(slug || name).replace(/^\/|\/$/g, '')}/`.replace(/\/+/g, '/') : `${prefix}/news/${slug || name.replace(/^\d{4}-\d{2}-\d{2}-/,'')}/`;
      const section = type === 'blog' ? (locale === 'en' ? 'News' : '动态') : name.startsWith('valen/') ? 'Valen' : name.startsWith('jevalkit/') ? 'JevalKit' : (locale === 'en' ? 'Documentation' : '文档');
      const text = body.replace(/^import .*$/gm,'').replace(/<[^>]*>/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*`|]/g,' ').replace(/\s+/g,' ').trim();
      entries.push({title, path, locale, section, text});
    }
  }
  for (const [path,title,text] of locale === 'en' ? [
    ['/projects/', 'Projects', 'Valen decision models JevalKit toolkit VisualDecisionBench datasets'],
    ['/benchmarks/', 'VisualDecisionBench', 'Image video multimodal decision evaluation dataset benchmark'],
    ['/about/', 'About Valen Team', 'Fast Decisions Continuous Evolution multimodal open source research Leigh Van Valen Red Queen'],
  ] : [
    ['/projects/', '项目', 'Valen 决策模型 JevalKit 评测工具 VisualDecisionBench 数据集'],
    ['/benchmarks/', 'VisualDecisionBench', '图像 视频 多模态 决策 评测 数据集 Benchmark'],
    ['/about/', '关于万澜', '快速决策 持续进化 多模态 开源 研究 红皇后'],
  ]) entries.push({title,path:prefix+path,locale,section:locale === 'en' ? 'Explore' : '探索',text});
}
writeFileSync(join(root,'static/search-index.json'), JSON.stringify(entries));
console.log(`Generated local search index: ${entries.length} pages, 2 languages.`);
