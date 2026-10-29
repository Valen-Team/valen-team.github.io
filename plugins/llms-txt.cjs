// Markdown copies of every docs and cookbook page, plus llms.txt indexes, for coding agents.
const {mkdirSync, readFileSync, writeFileSync} = require('node:fs');
const {dirname, extname, join} = require('node:path');

const LANGUAGES = {'.py': 'python', '.js': 'javascript', '.mjs': 'javascript', '.ts': 'typescript', '.json': 'json', '.sh': 'bash'};

function toMarkdown(raw, {title, url, siteDir}) {
  let body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
  const sources = {};
  body = body.replace(/^import\s+(\w+)\s+from\s+'@site\/([^'?]+)\?cookbook-source';\n/gm, (_, name, path) => {
    sources[name] = {code: readFileSync(join(siteDir, path), 'utf8').trimEnd(), language: LANGUAGES[extname(path)] || ''};
    return '';
  });
  body = body.replace(/^import\s[^\n]*\n/gm, '');
  body = body.replace(/<CodeBlock\b([^>]*)>\{(\w+)\}<\/CodeBlock>/g, (match, attrs, name) => {
    const source = sources[name];
    if (!source) return match;
    const titleAttr = /title="([^"]+)"/.exec(attrs);
    return `${titleAttr ? `\`${titleAttr[1]}\`:\n\n` : ''}\`\`\`${source.language}\n${source.code}\n\`\`\``;
  });
  body = body.replace(/^[ \t]*<TabItem\b[^>]*label="([^"]+)"[^>]*>[ \t]*$/gm, '\n**$1**\n');
  body = body.replace(/^[ \t]*<\/?(Tabs|TabItem)\b[^>]*>[ \t]*$/gm, '');
  body = body.replace(/^[ \t]*<[A-Z]\w*\b[^>]*\/>[ \t]*$/gm, `\nInteractive content: [open the web page](${url}).`);
  body = body.replace(/\]\((\/(?:zh-Hans\/)?(?:docs|cookbook)\/[^)#\s]*?)\/(#[^)\s]*)?\)/g, (_, path, hash = '') => `](${path}.md${hash})`);
  body = body.replace(/\]\(\.\.\/([\w-]+)\/(#[^)\s]*)?\)/g, (_, slug, hash = '') => `](./${slug}.md${hash})`);
  body = body.replace(/\]\(pathname:\/\//g, '](');
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  if (!/^# /m.test(body.split('\n').find(line => line.trim()) || '')) body = `# ${title}\n\n${body}`;
  return `${body}\n`;
}

module.exports = function llmsTxt(context) {
  const {siteDir, baseUrl, siteConfig, i18n} = context;
  const site = siteConfig.url.replace(/\/$/, '');
  const zh = i18n.currentLocale === 'zh-Hans';
  let pages = [];
  return {
    name: 'llms-txt',
    async allContentLoaded({allContent}) {
      pages = [];
      for (const [pluginId, content] of Object.entries(allContent['docusaurus-plugin-content-docs'] || {})) {
        for (const doc of content.loadedVersions.flatMap(version => version.docs)) {
          const route = doc.permalink.slice(baseUrl.length).replace(/\/$/, '');
          pages.push({section: pluginId === 'cookbook' ? 'cookbook' : 'docs', title: doc.title, description: doc.description,
            source: doc.source.replace(/^@site/, siteDir), url: `${site}${doc.permalink.replace(/\/?$/, '/')}`, mdPath: `${route}.md`});
        }
      }
      pages.sort((a, b) => a.mdPath.localeCompare(b.mdPath));
    },
    async postBuild({outDir}) {
      const full = [];
      for (const page of pages) {
        const markdown = toMarkdown(readFileSync(page.source, 'utf8'), {title: page.title, url: page.url, siteDir});
        const file = join(outDir, page.mdPath);
        mkdirSync(dirname(file), {recursive: true});
        writeFileSync(file, markdown);
        full.push(`<!-- ${site}${baseUrl}${page.mdPath} -->\n${markdown}`);
      }
      const entry = page => `- [${page.title}](${site}${baseUrl}${page.mdPath})${page.description ? `: ${page.description}` : ''}`;
      const index = zh ? [
        '# Valen', '',
        '> Valen（万澜）是多模态 System One 决策模型：输入文本、图像和视频，对你提供的候选项返回结构化概率。', '',
        '每个页面都有 Markdown 版本：在文档或 Cookbook 路径后加 `.md`。', '',
        '## API', '',
        `- [OpenAPI 规格](${site}/openapi.json)：System One、Decisions 和 List Models 的请求与响应结构`,
        `- [Agent skill](https://github.com/Valen-Team/skills)：给编程 agent 用的 Valen 集成方法`, '',
        '## 文档', '', ...pages.filter(page => page.section === 'docs').map(entry), '',
        '## Cookbook', '', ...pages.filter(page => page.section === 'cookbook').map(entry), '',
        '## 可选', '', `- [全部页面合集](${site}${baseUrl}llms-full.txt)`, '',
      ] : [
        '# Valen', '',
        '> Valen is a multimodal System One decision model. Text, images and video in; structured probabilities over the candidates you supply out.', '',
        'Every page has a Markdown version: append `.md` to a docs or cookbook path.', '',
        '## API', '',
        `- [OpenAPI spec](${site}/openapi.json): request and response schemas for System One, Decisions and List Models`,
        `- [Agent skill](https://github.com/Valen-Team/skills): integration craft for coding agents`, '',
        '## Docs', '', ...pages.filter(page => page.section === 'docs').map(entry), '',
        '## Cookbook', '', ...pages.filter(page => page.section === 'cookbook').map(entry), '',
        '## Optional', '', `- [All pages in one file](${site}${baseUrl}llms-full.txt)`, '',
        '简体中文版本：https://valen-team.github.io/zh-Hans/llms.txt', '',
      ];
      writeFileSync(join(outDir, 'llms.txt'), index.join('\n'));
      writeFileSync(join(outDir, 'llms-full.txt'), full.join('\n'));
    },
  };
};
