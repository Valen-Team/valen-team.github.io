import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  main: [
    'intro',
    {type: 'category', label: 'Valen', collapsed: false, link: {type: 'doc', id: 'valen/overview'}, items: [
      'valen/quickstart', 'valen/sglang', 'valen/api', 'valen/data-format', 'valen/architecture', 'valen/qwen-shared-state', 'valen/configuration', 'valen/evaluation',
    ]},
    {type: 'category', label: 'JevalKit', collapsed: false, link: {type: 'doc', id: 'jevalkit/overview'}, items: [
      'jevalkit/quickstart', 'jevalkit/models', 'jevalkit/benchmarks',
    ]},
    'resources', 'contributing',
  ],
};

export default sidebars;
