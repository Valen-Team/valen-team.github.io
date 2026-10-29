import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';
const sidebars: SidebarsConfig = {cookbook: [
  'index',
  {type: 'category', label: 'Foundations', items: ['api-quickstart', 'local-inference']},
  {type: 'category', label: 'Route & triage', items: ['function-calling', 'ticket-routing', 'calibrated-routing', 'unknown-categories', 'skill-support-router']},
  {type: 'category', label: "Select, don't generate", items: ['value-extraction']},
  {type: 'category', label: 'Find & judge evidence', items: ['rerank']},
  {type: 'category', label: 'Verify & escalate', items: ['citation-check', 'llm-guardrails']},
  {type: 'category', label: 'Images & video', items: ['product-screening', 'document-check', 'video-tagging', 'event-monitoring']},
  {type: 'category', label: 'Answers into data', items: ['composite-scoring']},
  {type: 'category', label: 'Adapt & ship', items: ['domain-finetuning', 'validation', 'migration']},
]};
export default sidebars;
