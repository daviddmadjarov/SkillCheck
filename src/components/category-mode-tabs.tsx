'use client';

import Link from 'next/link';

type ModeTab = {
  id: string;
  label: string;
  href: string;
};

type CategoryModeTabsProps = {
  modes: ModeTab[];
  activeMode: string;
  accent?: 'cyan' | 'violet';
};

function tabClass(isActive: boolean, accent: 'cyan' | 'violet') {
  const activeColors =
    accent === 'violet'
      ? 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-900 dark:text-violet-300'
      : 'border-cyan-300 bg-cyan-100 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-900 dark:text-cyan-300';

  const base =
    'rounded-full border-2 px-4 py-2 text-sm font-bold transition active:translate-y-0.5';

  if (isActive) {
    return `${base} ${activeColors}`;
  }
  return `${base} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800`;
}

export function CategoryModeTabs({ modes, activeMode, accent = 'cyan' }: CategoryModeTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {modes.map((mode) => (
        <Link
          key={mode.id}
          className={tabClass(activeMode === mode.id, accent)}
          href={mode.href}
          scroll={false}
        >
          {mode.label}
        </Link>
      ))}
    </div>
  );
}