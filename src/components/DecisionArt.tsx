import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useChinese} from './Content';

export default function DecisionArt() {
  const zh = useChinese();
  return <figure className="decision-art v-orbit-figure" aria-label={zh ? '文本、图像与视频汇入决策模型，再输出结构化概率的概念图' : 'Concept illustration: text, images, and video flow into a decision model and out as structured probabilities'}>
    <img className="decision-svg" src={useBaseUrl('/img/decision-orbits.svg')} width="560" height="510" alt="" fetchPriority="high"/>
    <div className="art-label art-label-input v-orbit-label v-orbit-label--input"><span className="status-dot"/><div>{zh ? '感知世界' : 'Perceive the world'}<small>TEXT · IMAGE · VIDEO</small></div></div>
    <div className="art-label art-label-output v-orbit-label v-orbit-label--output"><span className="v-orbit-icon">↗</span><div>{zh ? '做出决策' : 'Make a decision'}<small>CHOICE · NOUL · SCORE</small></div></div>
    <figcaption className="art-caption"><span>FIG. 01</span><span>{zh ? '从多模态感知，到结构化决策' : 'From perception to structured decisions'}</span><span>↗</span></figcaption>
  </figure>;
}
