import React from 'react';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import CodeBlock from '@theme/CodeBlock';
import {decisionPayload, requestCode} from './examples';

type Props = {protocol: 'systemone' | 'decisions'; image?: boolean};

export default function RequestExample({protocol, image = false}: Props) {
  const payload = image
    ? decisionPayload('Answer using only the visible image.', 'data:image/png;base64,')
    : decisionPayload();

  return <Tabs groupId="request-language">
    <TabItem value="python" label="Python" default>
      <CodeBlock language="python">{requestCode(payload, 'python', 'image.png', protocol)}</CodeBlock>
    </TabItem>
    <TabItem value="curl" label="cURL">
      <CodeBlock language="bash">{requestCode(payload, 'bash', 'image.png', protocol)}</CodeBlock>
    </TabItem>
  </Tabs>;
}
