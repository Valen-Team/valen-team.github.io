import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';
const sidebars: SidebarsConfig = {cookbook: [
  'index', {type: 'category', label: 'Foundations', items: ['api-quickstart', 'local-inference']},
  {type: 'category', label: 'Applications', items: ['skill-support-router', 'ticket-routing', 'unknown-categories', 'calibrated-routing', 'product-screening', 'video-tagging','domain-finetuning']},
  'validation', 'migration',
]};
export default sidebars;
