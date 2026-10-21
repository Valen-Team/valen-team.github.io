import React from 'react';
import Original from '@theme-original/DocRoot/Layout';
import {useLocation} from '@docusaurus/router';
import {isModernDoc,ModernSidebar} from '../../../components/modern/shared';
import type {Props} from '@theme/DocRoot/Layout';
export default function DocRootLayout(props:Props){if(!isModernDoc(useLocation().pathname))return <Original {...props}/>;return <div className="modern-doc-root"><aside className="modern-doc-sidebar"><ModernSidebar/></aside><main className="modern-doc-main">{props.children}</main></div>;}
