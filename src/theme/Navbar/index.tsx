import React,{useEffect} from 'react';
import {useColorMode} from '@docusaurus/theme-common';
import Original from '@theme-original/Navbar';
import {useLocation} from '@docusaurus/router';
import ModernNavbar from '../../components/modern/Navbar';
import {isModern} from '../../components/modern/shared';
export default function Navbar(){const modern=isModern(useLocation().pathname);const {setColorMode}=useColorMode();useEffect(()=>{if(!modern)setColorMode('light');},[modern,setColorMode]);return modern?<ModernNavbar/>:<Original/>;}
