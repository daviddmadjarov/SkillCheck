import Link from 'next/link';
import { Suspense } from 'react';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

import { MouseProtocols } from './mouse-protocols';
import { MultiplayerSessionGuard } from '@/components/multiplayer-session-guard';
import { DuelRoundTimerWrapper } from '@/components/duel-round-timer-wrapper';
import { DailyGameBadge } from '@/components/daily-game-banner';
import { CategoryModeTabs } from '@/components/category-mode-tabs';
import { GameStatistics } from '@/components/game-statistics';

type SearchParams = { duration?: string; mode?: string; traceMode?: string; lobby?: string; game?: string; player?: string; round?: string; mp_mode?: string; daily?: string };
type MouseMode = 'symbol' | 'cps' | 'tracking';

function getMouseMode(value: string | undefined): MouseMode {
  if (value === 'cps') return 'cps';
  if (value === 'tracking') return 'tracking';
  return 'symbol';
}

function getStatsSlug(mode: MouseMode): string {
  if (mode === 'cps') return 'mouse-cps';
  if (mode === 'tracking') return 'aim-tracking-test';
  return 'mouse-symbol-tracing';
}

export default async function MousePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const mode = getMouseMode(resolvedSearchParams.mode);
  const initialTraceMode = resolvedSearchParams.traceMode === 'memory' ? 'memory' : 'assist';
  const initialCpsDuration = resolvedSearchParams.duration === '5' ? 5 : resolvedSearchParams.duration === '15' ? 15 : 10;
  const isSignedIn = hasSupabaseEnv() ? (await (await createClient()).auth.getUser()).data.user !== null : false;
  const isMultiplayerSession = Boolean(resolvedSearchParams.lobby);
  const isDuelSession = resolvedSearchParams.mp_mode === 'duel';
  const isDailyGame = resolvedSearchParams.daily === 'true' && !isMultiplayerSession;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      {isMultiplayerSession ? <MultiplayerSessionGuard /> : null}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 sm:gap-5">
        {!isMultiplayerSession && !isDailyGame ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-3 shadow-[0_4px_0_rgba(226,232,240,1)] sm:px-5">
            <div className="flex items-center gap-3">
              <Suspense fallback={null}><DuelRoundTimerWrapper /></Suspense>
            </div>
            <div className="flex-1 flex justify-center">
              <CategoryModeTabs
                modes={[
                  { id: 'symbol', label: 'Symbol Tracing', href: '/category/mouse?mode=symbol' },
                  { id: 'tracking', label: 'Tracking Test', href: '/category/mouse?mode=tracking' },
                  { id: 'cps', label: 'CPS Tester', href: '/category/mouse?mode=cps' },
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
                isDuelSession ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-cyan-300 bg-cyan-50 text-cyan-700'
              }`}>
                {isDuelSession ? 'In Duel' : 'In Party'}
              </div>
            ) : isDailyGame ? (
              <Suspense fallback={null}><DailyGameBadge /></Suspense>
            ) : null}
          </div>
        )}

        <MouseProtocols
          initialCpsDuration={initialCpsDuration}
          initialTraceMode={initialTraceMode}
          isSignedIn={isSignedIn}
          mode={mode}
        />

        {!isMultiplayerSession && !isDailyGame ? (
          <Suspense fallback={null}>
            <GameStatistics testSlug={getStatsSlug(mode)} visible={true} />
          </Suspense>
        ) : null}
      </div>
    </main>
  );
}