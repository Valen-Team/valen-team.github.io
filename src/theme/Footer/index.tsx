import React from 'react';
import Original from '@theme-original/Footer';
import {useLocation} from '@docusaurus/router';
import {isModern,ModernFooter} from '../../components/modern/shared';
export default function Footer(){return isModern(useLocation().pathname)?<ModernFooter/>:<Original/>;}
