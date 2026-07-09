'use client';

import { type ReactNode } from 'react';

export function RefreshLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        window.location.href = href;
      }}
      className={className}
    >
      {children}
    </a>
  );
}