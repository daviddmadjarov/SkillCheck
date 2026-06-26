import Link from 'next/link';
import { Suspense } from 'react';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

import { DuelRoundTimerWrapper } from '@/components/duel-round-timer-wrapper';
import { DailyGameBadge } from '@/components/daily-game-banner';
import { CategoryModeTabs } from '@/components/category-mode-tabs';
import { GameStatistics } from '@/components/game-statistics';
import { CognitiveProtocols } from './cognitive-protocols';
import { MultiplayerSessionGuard } from '@/components/multiplayer-session-guard';

type SearchParams = { mode?: string; lobby?: string; game?: string; player?: string; round?: string; mp_mode?: string; daily?: string };
type ThinkingMode = 'rotation' | 'estimation' | 'sequence';

function getMode(value: string | undefined): ThinkingMode {
  if (value === 'estimation') return 'estimation';
  if (value === 'sequence') return 'sequence';
  return 'rotation';
}

export default async function ThinkingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  const mode = getMode(resolved.mode);
  const isSignedIn = hasSupabaseEnv() ? (await (await createClient()).auth.getUser()).data.user !== null : false;
  const isMultiplayerSession = Boolean(resolved.lobby);
  const isDuelSession = resolved.mp_mode === 'duel';
  const isDailyGame = resolved.daily === 'true' && !isMultiplayerSession;

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
                  { id: 'rotation', label: 'Mental Rotation', href: '/category/thinking?mode=rotation' },
                  { id: 'estimation', label: 'Estimation Challenge', href: '/category/thinking?mode=estimation' },
                  { id: 'sequence', label: 'Sequence Memory', href: '/category/thinking?mode=sequence' },
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

        <CognitiveProtocols isSignedIn={isSignedIn} mode={mode} />

        {!isMultiplayerSession && !isDailyGame ? (
          <Suspense fallback={null}>
            <GameStatistics testSlug={mode === 'estimation' ? 'estimation-challenge' : mode === 'sequence' ? 'sequence-memory' : 'mental-rotation'} visible={true} />
          </Suspense>
        ) : null}
      </div>
    </main>
  );
}