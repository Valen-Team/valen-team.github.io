import React from 'react';

export function Arrow({diagonal = false, ...props}: React.SVGProps<SVGSVGElement> & {diagonal?: boolean}) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function ProjectGlyph({kind}: {kind: 'model' | 'tool' | 'data'}) {
  return <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    {kind === 'model' ? <><path d="m8 11 12 7 12-7M8 11v16l12 7 12-7V11L20 4 8 11Z" stroke="currentColor" strokeWidth="1.5"/><path d="M20 18v16m-12-7 24-16M8 11l24 16" stroke="currentColor" strokeWidth="1.1" opacity=".5"/></> : kind === 'tool' ? <><path d="M8 9v23h25M13 26l6-8 6 3 8-12" stroke="currentColor" strokeWidth="1.7"/><circle cx="19" cy="18" r="2.5" fill="currentColor"/><circle cx="25" cy="21" r="2.5" fill="currentColor"/><circle cx="33" cy="9" r="2.5" fill="currentColor"/></> : <><ellipse cx="20" cy="9" rx="12" ry="5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 9v21c0 7 24 7 24 0V9M8 19c0 7 24 7 24 0" stroke="currentColor" strokeWidth="1.5"/></>}
  </svg>;
}
