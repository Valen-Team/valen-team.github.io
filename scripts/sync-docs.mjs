import {readFileSync, writeFileSync} from 'node:fs';
import {resolve, posix} from 'node:path';
import {createHash} from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'content-sources.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const diagramSources = JSON.parse(readFileSync(resolve(root, 'scripts/diagram-sources.json'), 'utf8'));
const update = process.argv.includes('--update');
if (process.argv.slice(2).some(arg => arg !== '--update')) throw new Error('Usage: node scripts/sync-docs.mjs [--update]');

const routes = Object.fromEntries(manifest.files.map(f => [f.repository+'/'+f.path, '/docs/'+f.destination.replace(/^.*(?:current|docs)\//,'').replace(/\.mdx?$/,'')+'/']));
for (const [repo,files] of [['Valen', ['README.md','README_zh.md']], ['JevalKit', ['README.md','README_zh-CN.md']]]) for (const file of files) routes[`Valen-Team/${repo}/${file}`] = `/docs/${repo.toLowerCase()}/`;

const fetched = [];
for (const file of manifest.files) {
  const url = update ? `https://raw.githubusercontent.com/${file.repository}/main/${file.path}` : `https://api.github.com/repos/${file.repository}/git/blobs/${file.blobSha}`;
  const response = await fetch(url, {headers: {'User-Agent':'valen-team-website-docs-sync'}, signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`${response.status} fetching ${file.repository}/${file.path}. No files have been written.`);
  const bytes = update ? Buffer.from(await response.arrayBuffer()) : Buffer.from((await response.json()).content.replace(/\s/g,''), 'base64');
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (!update && sha !== file.blobSha) throw new Error(`Source hash mismatch for ${file.path}. No files have been written.`);
  const expected = diagramSources[file.repository+'/'+file.path];
  if (expected && JSON.stringify(bytes.toString('utf8').match(/```mermaid[\s\S]*?```/g) || []) !== JSON.stringify(expected)) {
    throw new Error(`Flowchart changed in ${file.path}. Update render-diagrams.mjs and diagram-sources.json before syncing. No files have been written.`);
  }
  fetched.push({file,bytes,sha});
}

const date = update ? new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()) : manifest.retrieved;
for (const {file,bytes,sha} of fetched) {
  const zh = file.locale === 'zh-Hans';
  let body = bytes.toString('utf8').replace(/^# .*\r?\n/,'').replace(/^\s*\*\*English\*\*.*\r?\n/m,'').replace(/^\s*\[English\].*\r?\n/m,'').trim();
  const diagram = file.path.startsWith('docs/architecture') ? 'execution-flow' : file.path.startsWith('docs/qwen-shared-state') ? 'shared-state' : null;
  if (diagram) body = body.replace(/```mermaid[\s\S]*?```/g, `![${zh ? '模型执行流程图' : 'Model execution flowchart'}](/img/${diagram}-${file.locale}.svg)`);
  if (file.destination.endsWith('jevalkit/quickstart.md')) body = body.replace("python -m pip install -e '.[hf,data]'", "git clone https://github.com/Valen-Team/JevalKit.git\ncd JevalKit\npython -m pip install -e '.[hf,data]'");
  body = body.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (all,img,label,link) => {
    if (/^(https?:|mailto:|#|\/)/.test(link)) return all;
    const [pathname,hash] = link.split('#');
    const sourcePath = posix.normalize(posix.join(posix.dirname(file.path),pathname)).replace(/\/$/,'');
    if (img && sourcePath === 'assets/figures/readme-architecture.png') return `![${label}](/img/valen-architecture.png)`;
    const suffix = hash ? '#'+hash : '';
    const local = routes[file.repository+'/'+sourcePath];
    if (!img && local) return `[${label}](${zh ? '/zh-Hans' : ''}${local}${suffix})`;
    const target = img ? `https://raw.githubusercontent.com/${file.repository}/main/${sourcePath}${suffix}` : `https://github.com/${file.repository}/${pathname.endsWith('/') || !posix.basename(sourcePath).includes('.') ? 'tree' : 'blob'}/main/${sourcePath}${suffix}`;
    return `${img}[${label}](${target})`;
  });
  const header = `---\ntitle: ${JSON.stringify(file.title)}\nsidebar_label: ${JSON.stringify(file.title)}\n---\n\n`;
  const footer = `\n\n---\n\n${zh ? '本文同步自' : 'Synchronized from'} [${file.repository.split('/')[1]} / ${file.path}](https://github.com/${file.repository}/blob/main/${file.path}) · ${zh ? '源文件' : 'Source blob'} \`${sha.slice(0,7)}\` · ${date}.\n`;
  writeFileSync(resolve(root,file.destination),header+body+footer);
  file.blobSha=sha;
}
if (update) {manifest.retrieved=date; writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');}
console.log(`${update ? 'Updated' : 'Restored'} ${fetched.length} imported pages from ${update ? 'current upstream releases' : 'verified source blobs'}.`);
