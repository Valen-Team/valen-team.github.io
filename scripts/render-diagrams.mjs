import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Static renderings of the two flowcharts in the imported Valen reference docs.
// Original graph definitions remain available through each page's source link.
const dir = resolve(import.meta.dirname, '../static/img');
const {tokens: {color}} = JSON.parse(readFileSync(resolve(import.meta.dirname, '../src/design-system/tokens/tokens.json')));
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function node(x,y,w,h,title,subtitle='',accent=false) {
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${accent ? color.tint : color.surface}" stroke="${color.line}"/><text x="${x+w/2}" y="${y+h/2+(subtitle ? -4 : 4)}" text-anchor="middle" font-size="13" fill="${color.ink}">${esc(title)}</text>${subtitle ? `<text x="${x+w/2}" y="${y+h/2+16}" text-anchor="middle" font-size="9.5" fill="${color.muted}">${esc(subtitle)}</text>` : ''}</g>`;
}
const edge = d => `<path d="${d}" fill="none" stroke="${color.action}" stroke-width="1.4" marker-end="url(#arrow)"/>`;
function svg(title,height,body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="${height}" viewBox="0 0 700 ${height}" role="img" aria-labelledby="title"><title id="title">${esc(title)}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="${color.action}"/></marker></defs><rect width="700" height="${height}" rx="10" fill="${color.paper}"/><g font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif">${body}</g></svg>\n`;
}
for (const locale of ['en','zh-Hans']) {
  const zh = locale === 'zh-Hans';
  const flow = [
    edge('M206 54H260'), edge('M440 54H494'), edge('M584 84V150'), edge('M494 187H440'), edge('M260 187H206'), edge('M116 224V260H171V300'), edge('M116 224V260H529V300'),
    node(26,24,180,60,'JSONL record'),
    node(260,24,180,60,zh ? '读取与校验' : 'Read & validate','read_jsonl / validate_record'),
    node(494,24,180,60,'Compiler.compile'),
    node(494,150,180,74,zh ? '编译后的状态' : 'Compiled state','State / Question / Branch'),
    node(260,150,180,74,'ValenQwen.forward'),
    node(26,150,180,74,zh ? '候选 logits' : 'Candidate logits'),
    node(26,300,290,70,zh ? 'SFT 或 RLCD 损失' : 'SFT or RLCD loss','',true),
    node(384,300,290,70,'answer / question_metrics','',true),
  ].join('');
  writeFileSync(resolve(dir,`execution-flow-${locale}.svg`),svg(zh ? '从 JSONL 到决策' : 'From JSONL to a decision',395,flow));
  const shared = [
    edge('M166 90V112H350V135'), edge('M534 90V112H350V135'), edge('M350 205V250'),
    edge('M350 320V343H166V365'), edge('M350 320V343H534V365'),
    edge('M166 435V458H350V480'), edge('M534 435V458H350V480'), edge('M350 550V595'),
    node(26,25,280,65,'State',zh ? '文本 · 图片 · 视频' : 'Text · image · video'),
    node(394,25,280,65,zh ? '问题 Schema' : 'Question schemas'),
    node(210,135,280,70,zh ? 'State + 全部问题与候选' : 'State + questions + candidates'),
    node(210,250,280,70,zh ? '一次 Qwen3.5 backbone 前向' : 'One Qwen3.5 backbone forward','',true),
    node(26,365,280,70,zh ? '共享 State 隐状态' : 'Shared state hidden states'),
    node(394,365,280,70,zh ? '各问题的读出' : 'Per-question readouts',zh ? '指令 · 候选 · Decision' : 'Instructions · candidates · Decision'),
    node(210,480,280,70,zh ? '共享 Mixer 头' : 'Shared Mixer head','',true),
    node(210,595,280,70,zh ? '各问题的候选 logits 与概率' : 'Candidate logits & probabilities'),
  ].join('');
  writeFileSync(resolve(dir,`shared-state-${locale}.svg`),svg(zh ? '共享状态模型与特征' : 'Shared-state model and features',690,shared));
}
console.log('Rendered 4 localized SVG flowcharts.');
