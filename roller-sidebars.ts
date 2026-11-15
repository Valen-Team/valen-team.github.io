import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';
const sidebars: SidebarsConfig = {roller: [
  'index',
  {type: 'category', label: 'Getting started', collapsed: false, items: ['start/introduction', 'start/getting-started', 'start/cli-reference', 'start/docker-builds']},
  {type: 'category', label: 'Harness setup', items: ['harnesses/openclaw-configuration', 'harnesses/codex-configuration', 'harnesses/claude-code-configuration', 'harnesses/hermes-configuration', 'harnesses/opencode-configuration', 'harnesses/deepseek-configuration', 'harnesses/pi-configuration', 'harnesses/tool-availability']},
  {type: 'category', label: 'Tasks and runs', items: ['tasks/task-format', 'tasks/task-bundle-and-storage', 'tasks/user-simulator']},
  {type: 'category', label: 'Traces and training data', items: ['traces/trajectory-outputs', 'traces/sft-format', 'traces/subagent-capture-protocol', 'traces/thinking-verification-matrix', 'traces/viewer']},
  {type: 'category', label: 'Benchmarks', items: ['benches/bench-format', 'benches/benchmark-standard', 'benches/wildclawbench', 'benches/skillsbench', 'benches/pinchbench', {type: 'category', label: 'QwenClawBench', link: {type: 'doc', id: 'benches/qwenclawbench'}, items: ['benches/qwenclawbench-evaluation-2026-09-17']}, 'benches/swebench-pro']},
]};
export default sidebars;
