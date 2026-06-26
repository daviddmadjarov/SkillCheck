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

export default async function AimPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const mode = getAimMode(resolvedSearchParams.mode);
  const isSignedIn = hasSupabaseEnv() ? (await (await createClient()).auth.getUser()).data.user !== null : false;
  const isMultiplayerSession = Boolean(resolvedSearchParams.lobby);
  const isDuelSession = resolvedSearchParams.mp_mode === 'duel';
  const isDailyGame = resolvedSearchParams.daily === 'true' && !isMultiplayerSession;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      {isMultiplayerSession ? <MultiplayerSessionGuard /> : null}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 sm:gap-5">
        {/* Inline mode tabs + nav, no separate header box */}
        {!isMultiplayerSession && !isDailyGame ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-3 shadow-[0_4px_0_rgba(226,232,240,1)] sm:px-5">
            <div className="flex items-center gap-3">
              <Suspense fallback={null}><DuelRoundTimerWrapper /></Suspense>
            </div>
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
            <Link data-return-to-lab className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-4 py-2 font-bold text-xs text-white shadow-[0_3px_0_rgba(15,23,42,1)] transition-all duration-150 active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]" href="/">
              Return to Lab
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-3 shadow-[0_4px_0_rgba(226,232,240,1)] sm:px-5">
            <Suspense fallback={null}><DuelRoundTimerWrapper /></Suspense>
            {isMultiplayerSession ? (
              <div className={`rounded-2xl border-2 px-4 py-2 text-sm font-bold ${
                isDuelSession
                  ? 'border-rose-300 bg-rose-50 text-rose-600'
                  : 'border-cyan-300 bg-cyan-50 text-cyan-700'
              }`}>
                {isDuelSession ? 'In Duel' : 'In Party'}
              </div>
            ) : isDailyGame ? (
              <Suspense fallback={null}><DailyGameBadge /></Suspense>
            ) : null}
          </div>
        )}

        <AimProtocols mode={mode} isSignedIn={isSignedIn} />

        {!isMultiplayerSession && !isDailyGame ? (
          <Suspense fallback={null}>
            <GameStatistics testSlug={mode === 'moving' ? 'aim-moving-targets' : mode === 'split' ? 'aim-perfect-split' : 'aim-trainer'} visible={true} />
          </Suspense>
        ) : null}
      </div>
    </main>
  );
}