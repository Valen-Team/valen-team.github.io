import React from 'react';

// Keep the published API reference in the localized MDX source. A second copy
// here previously hid documentation edits from the rendered page.
export default function ApiReference({children}: {children: React.ReactNode}) {
  return <div className="modern-api-reference">{children}</div>;
}
