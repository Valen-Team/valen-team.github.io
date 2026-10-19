import {readdirSync, readFileSync, existsSync} from 'node:fs';
import {join, resolve, relative} from 'node:path';

const root = resolve(import.meta.dirname, '../build');
if (!existsSync(root)) throw new Error('Run npm run build first.');
const walk = dir => readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : e.name.endsWith('.html') ? [join(dir,e.name)] : []);
const pages = walk(root);
const content = new Map(pages.map(p => [p,readFileSync(p,'utf8')]));
const errors = new Set(); let checked = 0;
for (const [file,html] of content) {
  const current = 'https://valen-team.github.io/' + relative(root,file).replace(/index\.html$/,'');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const href = match[1].replace(/&amp;/g, '&');
    if (/^(mailto:|tel:|data:|javascript:)/.test(href) || href === '#') continue;
    const target = new URL(href,current);
    if (target.origin !== 'https://valen-team.github.io') continue;
    const path = decodeURIComponent(target.pathname);
    // Docusaurus's generated error pages advertise virtual localized 404 URLs.
    if (file.endsWith('404.html') && /^\/(?:zh-Hans\/)?404(?:\.html)?\/$/.test(path)) continue;
    let destination = join(root,path);
    if (path.endsWith('/')) destination = join(destination,'index.html');
    if (!existsSync(destination) && existsSync(join(destination,'index.html'))) destination = join(destination,'index.html');
    checked++;
    if (!existsSync(destination)) {errors.add(`${relative(root,file)} → missing ${href}`); continue;}
    if (target.hash && destination.endsWith('.html')) {
      const id = decodeURIComponent(target.hash.slice(1)).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
      if (!content.get(destination)?.includes(`id="${id}"`)) errors.add(`${relative(root,file)} → missing anchor ${href}`);
    }
  }
}
if (errors.size) {console.error([...errors].join('\n')); process.exitCode=1;}
else console.log(`Verified ${checked} internal links and assets across ${pages.length} HTML pages. No broken targets or anchors.`);
