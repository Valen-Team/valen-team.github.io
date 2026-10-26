import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';
const sidebars: SidebarsConfig = {cookbook: [
  'index', {type: 'category', label: 'Foundations', items: ['api-quickstart', 'local-inference']},
  {type: 'category', label: 'Applications', items: ['ticket-routing', 'product-screening', 'video-tagging']},
  'validation', 'migration',
]};
export default sidebars;
