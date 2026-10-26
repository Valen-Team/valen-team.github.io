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
  for (const type of ['docs', 'cookbook']) {
    const translated = type === 'cookbook' ? 'docusaurus-plugin-content-docs-cookbook/current' : 'docusaurus-plugin-content-docs/current';
    const dir = join(root, locale === 'en' ? type : `i18n/zh-Hans/${translated}`);
    for (const file of walk(dir)) {
      const raw = readFileSync(file, 'utf8');
      const [, fm, body] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || ['', '', raw];
      const name = relative(dir, file).replace(/\.mdx?$/, '');
      const slug = field(fm, 'slug');
      const title = field(fm, 'title') || body.match(/^# (.+)$/m)?.[1] || name;
      const path = `${prefix}/${type}/${(slug || name).replace(/^\/|\/$/g, '')}/`.replace(/\/+/g, '/');
      const section = type === 'cookbook' ? 'Cookbook' : name.startsWith('valen/') ? 'Valen' : name.startsWith('jevalkit/') ? 'JevalKit' : (locale === 'en' ? 'Documentation' : '文档');
      const text = body.replace(/^import .*$/gm,'').replace(/<[^>]*>/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*`|]/g,' ').replace(/\s+/g,' ').trim();
      entries.push({title, path, locale, section, text});
    }
  }

}
writeFileSync(join(root,'static/search-index.json'), JSON.stringify(entries));
console.log(`Generated local search index: ${entries.length} pages, 2 languages.`);
