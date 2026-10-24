import React from 'react';
import OriginalCodeBlock from '@theme-original/CodeBlock';
import type {Props} from '@theme/CodeBlock';

const languageLabels: Record<string, string> = {
  bash: 'Bash', sh: 'Shell', shell: 'Shell', shellscript: 'Shell',
  python: 'Python', py: 'Python', json: 'JSON', jsonc: 'JSONC',
  javascript: 'JavaScript', js: 'JavaScript', typescript: 'TypeScript', ts: 'TypeScript',
  jsx: 'JSX', tsx: 'TSX', yaml: 'YAML', yml: 'YAML',
  html: 'HTML', css: 'CSS', sql: 'SQL', dockerfile: 'Dockerfile',
  text: 'Text', plaintext: 'Text', http: 'HTTP', toml: 'TOML',
};

export default function CodeBlock(props: Props) {
  const parts = React.Children.toArray(props.children);
  const text = parts.every(part => typeof part === 'string') ? parts.join('') : '';
  const multiline = text.trimEnd().includes('\n');
  const language = (props.language || props.className?.match(/(?:^|\s)language-([\w-]+)/)?.[1])?.toLowerCase();
  const hasMetadataTitle = /(?:^|\s)title\s*=/.test(props.metastring || '');
  const title = props.title ?? (hasMetadataTitle ? undefined : language && (languageLabels[language] || language));
  return <OriginalCodeBlock {...props} title={title} showLineNumbers={props.showLineNumbers ?? multiline}/>;
}
