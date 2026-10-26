import React from 'react';
import CodeBlock from '@theme/CodeBlock';
import evidence from '@site/static/cookbook/results.json';
import data from '@site/static/cookbook/code/samples.json';
import {useChinese} from './Content';

type Recipe = {date:string; model:string; revision:string; sdk:string; backend:string; result:unknown; status:string};
export default function CookbookEvidence({id}:{id:string}) {
  const zh=useChinese(), recipe=(evidence.recipes as Record<string,Recipe>)[id];
  if (!recipe || recipe.status!=='verified') return <p>{zh?'此版本尚未完成真实模型执行验证。':'Real-model execution has not completed for this revision.'}</p>;
  return <section>
    <p>{zh?'真实模型验证':'Real-model verification'}: {recipe.date} · {recipe.model} · SDK {recipe.sdk} · {recipe.backend}.</p>
    <p>{zh?'源模型 revision':'Source model revision'}: <code>{recipe.revision}</code>. <a href="/cookbook/results.json">{zh?'机器可读结果':'Machine-readable results'}</a></p>
    <CodeBlock language="json" title={zh?'实际业务输出':'Actual output'}>{JSON.stringify(recipe.result,null,2)}</CodeBlock>
  </section>;
}
export function CookbookSample({id}:{id:'ticket'|'product'|'video'}) {
  return <CodeBlock language="json" title="samples.json">{JSON.stringify(data[id],null,2)}</CodeBlock>;
}
