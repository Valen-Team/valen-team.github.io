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
import {isModernDoc,isCookbook} from '../../../components/modern/shared';
import ApiReference from '../../../components/modern/ApiReference';
export default function DocItemLayout(props:Props){const pathname=useLocation().pathname;const modern=isModernDoc(pathname);const cookbook=isCookbook(pathname);const {metadata}=useDoc();const zh=useChinese();if(!modern)return <Original {...props}/>;return <div className="modern-doc-grid"><div className="modern-doc-content"><nav className="modern-breadcrumbs" aria-label={zh?'页面路径':'Breadcrumbs'}><Link to={cookbook?'/cookbook/':'/docs/'}>{cookbook?'Cookbook':zh?'文档':'Documentation'}</Link><ChevronRight size={12}/><span>{cookbook&&metadata.id==='index'?(zh?'教程概览':'Overview'):metadata.title}</span></nav><article>{(metadata.id==='valen/api'||metadata.id.startsWith('valen/api/'))?<ApiReference><DocItemContent>{props.children}</DocItemContent></ApiReference>:<DocItemContent>{props.children}</DocItemContent>}</article><DocItemPaginator/></div></div>;}
