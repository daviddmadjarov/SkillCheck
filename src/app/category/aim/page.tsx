import Link from 'next/link';
import { Suspense } from 'react';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { DuelRoundTimerWrapper } from '@/components/duel-round-timer-wrapper';
import { DailyGameBadge } from '@/components/daily-game-banner';
import { CategoryModeTabs } from '@/components/category-mode-tabs';

import { AimProtocols } from './aim-protocols';
import { MultiplayerSessionGuard } from '@/components/multiplayer-session-guard';
import { GameStatistics } from '@/components/game-statistics';

type SearchParams = { mode?: string; lobby?: string; game?: string; player?: string; round?: string; mp_mode?: string; daily?: string };
type AimMode = 'trainer' | 'moving' | 'split';

function getAimMode(value: string | undefined): AimMode {
  if (value === 'moving') return 'moving';
  if (value === 'split') return 'split';
  return 'trainer';
}

export default async function AimPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const resolved = (await searchParams) ?? {};
  const mode = getAimMode(resolved.mode);
  const isSignedIn = hasSupabaseEnv() ? (await (await createClient()).auth.getUser()).data.user !== null : false;
  const isMultiplayer = Boolean(resolved.lobby);
  const isDuel = resolved.mp_mode === 'duel';
  const isDaily = resolved.daily === 'true' && !isMultiplayer;

  const nav = !isMultiplayer && !isDaily ? (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1.5">
      <Link data-return-to-lab className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-3 py-1.5 font-bold text-[11px] text-white shadow-[0_3px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)] no-underline" href="/">← Lab</Link>
      <div className="flex-1 flex justify-center">
        <CategoryModeTabs
          modes={[
            { id: 'trainer', label: 'Aim Trainer', href: '/category/aim?mode=trainer' },
            { id: 'moving', label: 'Moving Targets', href: '/category/aim?mode=moving' },
            { id: 'split', label: 'Perfect Split', href: '/category/aim?mode=split' },
          ]}
          activeMode={mode}
        />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{isSignedIn ? 'Online' : 'Guest'}</span>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-end gap-2 px-1 py-1.5">
      <Suspense fallback={null}><DuelRoundTimerWrapper /></Suspense>
      {isMultiplayer ? (
        <div className={`rounded-2xl border-2 px-3 py-1 text-xs font-bold ${isDuel ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-cyan-300 bg-cyan-50 text-cyan-700'}`}>
          {isDuel ? 'Duel' : 'Party'}
        </div>
      ) : isDaily ? <DailyGameBadge /> : null}
      <Link data-return-to-lab className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-3 py-1.5 font-bold text-[11px] text-white shadow-[0_3px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)] no-underline" href="/">← Lab</Link>
    </div>
  );

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      {isMultiplayer ? <MultiplayerSessionGuard /> : null}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4">
        {/* Nav bar + game card merged in one container */}
        <div className="divide-y divide-slate-200 rounded-[2rem] border-2 border-slate-200 bg-white shadow-[0_6px_0_rgba(226,232,240,1)]">
          <div className="px-3 py-2">{nav}</div>
          <AimProtocols mode={mode} isSignedIn={isSignedIn} />
        </div>
        {!isMultiplayer && !isDaily ? (
          <Suspense fallback={null}><GameStatistics testSlug={mode === 'moving' ? 'aim-moving-targets' : mode === 'split' ? 'aim-perfect-split' : 'aim-trainer'} visible={true} /></Suspense>
        ) : null}
      </div>
    </main>
  );
}