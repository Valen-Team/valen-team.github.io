import React, {useEffect, useState} from 'react';
import {ArrowUpRight, Star} from 'lucide-react';
import {useChinese} from './Content';
import './community-projects.css';

const projects = [
  {name: 'vLLM Jev', repo: 'mode-io/vllm-jev', stars: 780, url: 'https://github.com/mode-io/vllm-jev', kind: ['MODEL SERVING', '模型部署'], description: ['Serves Valen-Preview-0923 for text, images and short video on documented Linux and Mac paths.', '在其说明的 Linux 和 Mac 路径中，为 Valen-Preview-0923 提供文本、图片与短视频决策服务。'], license: ['Apache-2.0', 'Apache-2.0']},
  {name: 'System1-Omni', repo: 'InferMatrixLab/system1-omni', stars: 61, url: 'https://github.com/InferMatrixLab/system1-omni/blob/main/recipe/valen/reference.md', kind: ['REFERENCE SERVING', '参考推理服务'], description: ['A Python reference worker for Valen-Preview-0923 with text and single-image inputs.', 'Valen-Preview-0923 的 Python 参考 worker，支持文本和单张图片。'], license: ['License not specified', '未注明许可证']},
  {name: 'JevLight', repo: 'usail-hkust/JevLight', stars: 10, url: 'https://github.com/usail-hkust/JevLight/tree/main/config/valen-2b', kind: ['SIMULATION CONFIGURATION', '仿真配置'], description: ['Traffic-signal simulation with configurations for Valen models.', '交通信号仿真项目，提供 Valen 模型配置。'], license: ['License not specified', '未注明许可证']},
  {name: 'reflex', repo: 'ptlnextdoor/reflex', stars: 0, url: 'https://github.com/ptlnextdoor/reflex/blob/main/bench/infer/RESULTS.md', kind: ['MODEL EXPERIMENTS', '模型实验'], description: ['Valen-0.8B reference and MLX experiments on synthetic game frames.', '在合成游戏画面上开展 Valen-0.8B 参考与 MLX 实验。'], license: ['License not specified', '未注明许可证']},
  {name: 'LLM2Jev', repo: 'Yinsongxu/LLM2Jev', stars: 463, url: 'https://github.com/Yinsongxu/LLM2Jev#valen-eval-game', kind: ['DATASET EVALUATION', '数据集评测'], description: ['Uses Valen-Eval-Game to evaluate its own inference pipeline on single-step Sokoban decisions.', '使用 Valen-Eval-Game 评测其推理流程中的推箱子单步决策。'], license: ['Apache-2.0', 'Apache-2.0']},
  {name: 'tasksource', repo: 'sileod/tasksource', stars: 228, url: 'https://github.com/sileod/tasksource/blob/main/docs/jev/audits/game-expansion-audit.md', kind: ['DATASET ADAPTATION', '数据集整理'], description: ['Repackages Valen game examples as typed decisions, documenting splits and label handling.', '将 Valen 游戏样本整理为类型化决策数据，并记录数据划分和标签处理。'], license: ['BSD-3-Clause', 'BSD-3-Clause']},
];

export default function CommunityProjects() {
  const zh = useChinese();
  const lang = zh ? 1 : 0;
  const [liveStars, setLiveStars] = useState<Record<string, number>>({});
  useEffect(() => {
    const controller = new AbortController();
    projects.forEach(async project => {
      try {
        const response = await fetch(`https://api.github.com/repos/${project.repo}`, {signal: controller.signal});
        if (!response.ok) return;
        const data: {stargazers_count?: unknown} = await response.json();
        if (typeof data.stargazers_count === 'number' && Number.isFinite(data.stargazers_count)) {
          setLiveStars(previous => ({...previous, [project.repo]: data.stargazers_count as number}));
        }
      } catch {
        // Keep the dated snapshot if GitHub is unreachable or rate-limited.
      }
    });
    return () => controller.abort();
  }, []);
  return <section id="community-projects" className="community-projects" aria-labelledby="community-projects-title">
    <div className="community-projects-intro">
      <span className="community-projects-kicker">{zh ? '社区项目' : 'COMMUNITY PROJECTS'}</span>
      <h2 id="community-projects-title">{zh ? 'Valen 在社区中的探索' : 'Built and explored with Valen'}</h2>
      <p>{zh ? '社区项目通过模型部署、实验和数据集探索 Valen。请查看各项目的版本、许可证与适用范围。' : 'Community projects explore Valen through serving, experiments and datasets. Check each project’s version, license and scope.'}</p>
    </div>
    <div className="community-projects-grid">
      {projects.map(project => <article className="community-project" key={project.name}>
        <div className="community-project-top">
          <span className="community-project-kind">{project.kind[lang]}</span>
          <a className="community-project-stars" href={`https://github.com/${project.repo}`} aria-label={`${project.name}: ${liveStars[project.repo] ?? project.stars} GitHub stars${liveStars[project.repo] === undefined ? (zh ? '，2026 年 10 月 27 日快照' : ', snapshot from October 27, 2026') : ''}`} title={liveStars[project.repo] === undefined ? (zh ? '2026 年 10 月 27 日快照' : 'Snapshot from October 27, 2026') : (zh ? 'GitHub 当前星标数' : 'Current GitHub stars')}><svg className="community-project-github" aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 4.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg><Star size={15} aria-hidden="true"/><span>{(liveStars[project.repo] ?? project.stars).toLocaleString('en-US')}</span>{liveStars[project.repo] === undefined && <span className="community-project-snapshot">{zh ? '快照' : 'snapshot'}</span>}</a>
        </div>
        <h3><a href={project.url}>{project.name}<ArrowUpRight size={16} aria-hidden="true"/></a></h3>
        <p>{project.description[lang]}</p>
        <small>{project.license[lang]}</small>
      </article>)}
    </div>
    <p className="community-projects-note">{zh ? '以上项目由各自作者维护；收录不代表合作、背书或已独立复现。' : 'These projects are maintained by their respective authors; inclusion does not imply affiliation, endorsement or independent reproduction.'}</p>
  </section>;
}
