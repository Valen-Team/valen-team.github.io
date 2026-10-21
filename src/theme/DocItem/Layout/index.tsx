import React from 'react';
import Original from '@theme-original/DocItem/Layout';
import {useLocation} from '@docusaurus/router';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import DocItemContent from '@theme/DocItem/Content';
import DocItemPaginator from '@theme/DocItem/Paginator';
import Link from '@docusaurus/Link';
import {ChevronRight} from 'lucide-react';
import {useChinese} from '../../../components/Content';
import type {Props} from '@theme/DocItem/Layout';
import {isModernDoc} from '../../../components/modern/shared';
import ApiReference from '../../../components/modern/ApiReference';
import DocExample from '../../../components/modern/DocExample';
export default function DocItemLayout(props:Props){const modern=isModernDoc(useLocation().pathname);const {metadata}=useDoc();const zh=useChinese();if(!modern)return <Original {...props}/>;return <div className="modern-doc-grid"><div className="modern-doc-content"><nav className="modern-breadcrumbs" aria-label={zh?'页面路径':'Breadcrumbs'}><Link to="/docs/">{zh?'文档':'Documentation'}</Link><ChevronRight size={12}/><span>{metadata.title}</span></nav><article>{metadata.id==='valen/api'?<ApiReference/>:<DocItemContent>{props.children}</DocItemContent>}</article><DocItemPaginator/></div><DocExample/></div>;}
