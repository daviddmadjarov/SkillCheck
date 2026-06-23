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

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) return 'Guest Researcher';
  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;
  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

async function loadData() {
  if (!hasSupabaseEnv()) return { displayName: 'Guest Researcher', isSignedIn: false };
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return { displayName: 'Guest Researcher', isSignedIn: false };
  return { displayName: getDisplayName(user), isSignedIn: true };
}

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
  const { displayName, isSignedIn } = await loadData();
  const isMultiplayerSession = Boolean(resolved.lobby);
  const isDuelSession = resolved.mp_mode === 'duel';
  const isDailyGame = resolved.daily === 'true' && !isMultiplayerSession;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      {isMultiplayerSession ? <MultiplayerSessionGuard /> : null}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 sm:gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-4 shadow-[0_6px_0_rgba(226,232,240,1)] sm:items-center sm:px-6">
          <div className="w-full min-w-0 sm:w-auto">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="status-pill">Cognitive Category</p>
                <h1 className="mt-2 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
                  Cognitive Review
                </h1>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                  Spatial reasoning, perceptual precision and working memory across three modes.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden items-center gap-3 sm:flex">
                  <Suspense fallback={null}><DuelRoundTimerWrapper /></Suspense>
                  <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                    {displayName}
                  </div>
                </div>
                {isMultiplayerSession ? (
                  <div className="flex items-center gap-2">
                    <div className="sm:hidden">
                      <Suspense fallback={null}><DuelRoundTimerWrapper /></Suspense>
                    </div>
                    <div className={`rounded-2xl border-2 px-6 py-3 text-sm font-bold ${
                      isDuelSession
                        ? 'border-rose-300 bg-rose-50 text-rose-600'
                        : 'border-cyan-300 bg-cyan-50 text-cyan-700'
                    }`}>
                      {isDuelSession ? 'In Duel — Cannot leave' : 'In Party Session'}
                    </div>
                  </div>
                ) : isDailyGame ? (
                  <Suspense fallback={null}><DailyGameBadge /></Suspense>
                ) : (
                  <Link
                    data-return-to-lab
                    className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
                    href="/"
                  >
                    Return to Lab
                  </Link>
                )}
              </div>
            </div>

            {isMultiplayerSession || isDailyGame ? null : (
              <div className="mt-3">
                <CategoryModeTabs
                  modes={[
                    { id: 'rotation', label: 'Mental Rotation', href: '/category/thinking?mode=rotation' },
                    { id: 'estimation', label: 'Estimation Challenge', href: '/category/thinking?mode=estimation' },
                    { id: 'sequence', label: 'Sequence Memory', href: '/category/thinking?mode=sequence' },
                  ]}
                  activeMode={mode}
                />
              </div>
            )}
          </div>
        </div>

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