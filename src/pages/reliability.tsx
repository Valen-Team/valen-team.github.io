import React from 'react';
import {Redirect} from '@docusaurus/router';
import {useChinese} from '../components/Content';

export default function ReliabilityRedirect(){
  return <Redirect to={(useChinese()?'/zh-Hans':'')+'/docs/valen/reliability/'}/>;
}
