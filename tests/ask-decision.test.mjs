import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
async function sourceModule(file) {
  const js = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const {buildPayload, booleanCandidates, scoreCandidates, parseAnswer, weightedScore} = await sourceModule('../src/components/modern/decision.ts');
const {fileKind} = await sourceModule('../src/components/modern/media.ts');
const base = {model: 'valen-2b', question: 'Does the customer want a new delivery address?', context: 'Please deliver to my new address.', mode: 'boolean', candidates: booleanCandidates(false)};

test('output modes use their native request contracts', () => {
  for (const zh of [false, true]) {
    for (const [mode, candidates] of [['boolean', booleanCandidates(zh)], ['score', scoreCandidates(zh)], ['choice', [{value:'stay', description:'Stay'}, {value:'go', description:'Go'}]]]) {
      const payload = buildPayload({...base, mode, candidates});
      assert.equal(payload.questions[0].type, mode === 'boolean' ? 'predicate' : mode);
      assert.equal(payload.questions[0].name, 'q0');
      assert.equal(payload.temperature, 1);
      if (mode === 'choice') assert.deepEqual(payload.questions[0].choices.map(c => c.value), candidates.map(c => c.value));
      if (mode === 'boolean') {assert.equal(payload.questions[0].choices, undefined); assert.equal(payload.questions[0].levels, undefined);}
      assert(!JSON.stringify(payload).includes('Authorization'));
      if (mode === 'score') assert.deepEqual(payload.questions[0].levels, candidates.map(c => ({label: String(c.score), description: c.description})));
    }
  }
});
test('current evidence survives long conversation history and stays within endpoint limits', () => {
  const context = 'Current customer evidence. '.repeat(100);
  const payload = buildPayload({...base, context, history:'old text'.repeat(4000)});
  assert(payload.input.length <= 4000);
  assert(payload.input.endsWith(context.trim()));
});
test('images are inline and candidate descriptions are the ones evaluated', () => {
  const image = 'data:image/jpeg;base64,YWJj';
  const payload = buildPayload({...base, image});
  assert.equal(payload.input[0].content[1].image_url, image);
  assert.throws(() => buildPayload({...base, image:'https://example.test/private.jpg'}));
  assert.throws(() => buildPayload({...base, question:'   '}));
  assert.throws(() => buildPayload({...base, candidates:[{value:'a',description:'A'},{value:'a',description:'B'}]}));
});
test('response validation rejects mismatched, duplicated or incomplete probability distributions', () => {
  const valid = {answers:[{name:'q0',type:'choice',choice:'true',confidence:.6,probabilities:[{value:'true',probability:.8},{value:'false',probability:.2}]}]};
  assert.equal(parseAnswer(valid,base.candidates,'choice').choice,'true');
  for (const probabilities of [[{value:'true',probability:1}], [{value:'true',probability:.5},{value:'true',probability:.5}], [{value:'true',probability:NaN},{value:'false',probability:.2}], [{value:'true',probability:.8},{value:'false',probability:.8}]]) {
    assert.throws(() => parseAnswer({answers:[{...valid.answers[0],probabilities}]},base.candidates,'choice'));
  }
});
test('predicate preserves its native probability and derives complementary bars', () => {
  const answer = parseAnswer({answers:[{name:'q0',type:'predicate',probability:.8}]},base.candidates,'boolean');
  assert.equal(answer.probability,.8);
  assert.equal(answer.choice,'true');
  assert(Math.abs(answer.probabilities[1].probability-.2)<1e-12);
  assert.throws(()=>parseAnswer({answers:[{name:'q0',type:'predicate',probability:1.1}]},base.candidates,'boolean'));
});
test('rating uses the returned zero-based score and numeric level indices', () => {
  const candidates=scoreCandidates(false);
  const raw={name:'q0',type:'score',score:2.3,confidence:.1,probabilities:candidates.map((c,i)=>({value:i,label:String(i),probability:[.1,.1,.4,.2,.2][i]}))};
  const answer=parseAnswer({answers:[raw]},candidates,'score');
  assert.equal(weightedScore(answer,candidates),2.3);
  assert.equal(answer.probabilities[0].value,candidates[0].value);
  assert.deepEqual(answer.raw,raw);
});
test('all documented models are forwarded without substitution', () => {
  for (const model of ['valen-2b','valen-4b','valen-0-8b','valen-preview-0923']) assert.equal(buildPayload({...base,model}).model,model);
  assert.throws(()=>buildPayload({...base,model:'unknown'}));
});
test('file selection enforces advertised extensions, MIME types and size limits', () => {
  assert.equal(fileKind({name:'PHOTO.JPG',type:'image/jpeg',size:1024}),'image');
  assert.equal(fileKind({name:'clip.webm',type:'video/webm',size:1024}),'video');
  assert.equal(fileKind({name:'clip.mp4',type:'',size:1024}),'video');
  for(const file of [{name:'image.gif',type:'image/gif',size:10},{name:'image.png',type:'video/mp4',size:10},{name:'clip.mp4',type:'video/mp4',size:21*1024*1024},{name:'image.jpg',type:'image/jpeg',size:4*1024*1024}]) assert.throws(()=>fileKind(file));
});
