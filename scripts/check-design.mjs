import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),snapshot=resolve(root,'src/design-system');
const manifest=JSON.parse(readFileSync(resolve(snapshot,'manifest.json')));
const sourceIndex=process.argv.indexOf('--source');
const source=sourceIndex>=0 ? resolve(process.argv[sourceIndex+1]) : null;
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(source&&JSON.parse(readFileSync(resolve(source,'package.json'))).version!==manifest.version) throw new Error('Source/snapshot version mismatch');
for(const [file,expected] of Object.entries(manifest.files)) {
 if(hash(resolve(snapshot,file))!==expected) throw new Error(`Changed snapshot: ${file}. Update the shared source, then export.`);
 if(source&&hash(resolve(source,file))!==expected) throw new Error(`Stale source snapshot: ${file}. Export a new release.`);
}
if(hash(resolve(root,'static/img/valen-mark.png'))!==hash(resolve(snapshot,'assets/brand/valen-mark-white.png'))) throw new Error('Static Valen logo differs from shared brand source');
if(hash(resolve(root,'static/img/jevalkit-light.svg'))!==hash(resolve(snapshot,'assets/brand/jevalkit-light.svg'))) throw new Error('Static JevalKit logo differs from shared brand source');
if(hash(resolve(root,'static/img/decision-orbits.svg'))!==hash(resolve(snapshot,'assets/illustrations/decision-orbits.svg'))) throw new Error('Static editorial illustration differs from shared source');
console.log(`Verified ${manifest.name} ${manifest.version}: ${Object.keys(manifest.files).length} files${source?' and local source':''}.`);
