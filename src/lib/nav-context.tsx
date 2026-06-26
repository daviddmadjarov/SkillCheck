'use client';

import { createContext, useContext, type ReactNode } from 'react';

const NavContext = createContext<ReactNode>(null);

export function NavProvider({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return <NavContext.Provider value={nav}>{children}</NavContext.Provider>;
}

export function useNav() {
  return useContext(NavContext);
}