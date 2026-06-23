import Link from 'next/link';
import { Suspense } from 'react';

import { AudioReactionProtocol } from '@/app/category/reaction/audio-reaction-protocol';
import { MultiReactionProtocol } from '@/app/category/reaction/multi-reaction-protocol';
import { ReactionProtocol } from '@/app/category/reaction/reaction-protocol';
import { DuelRoundTimerWrapper } from '@/components/duel-round-timer-wrapper';
import { DailyGameBadge } from '@/components/daily-game-banner';
import { CategoryModeTabs } from '@/components/category-mode-tabs';
import { GameStatistics } from '@/components/game-statistics';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { MultiplayerSessionGuard } from '@/components/multiplayer-session-guard';

type SearchParams = { mode?: string; lobby?: string; game?: string; player?: string; round?: string; mp_mode?: string; daily?: string };

type ReactionMode = 'time' | 'audio' | 'multi';

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) {
    return 'Guest Researcher';
  }

  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;

  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

async function loadReactionPageData() {
  if (!hasSupabaseEnv()) {
    return {
      attempts: 0,
      audioAttempts: 0,
      multiAttempts: 0,
      bestScore: null as number | null,
      audioBestScore: null as number | null,
      multiBestScore: null as number | null,
      displayName: 'Guest Researcher',
      isSignedIn: false,
    };
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return {
      attempts: 0,
      audioAttempts: 0,
      multiAttempts: 0,
      bestScore: null as number | null,
      audioBestScore: null as number | null,
      multiBestScore: null as number | null,
      displayName: 'Guest Researcher',
      isSignedIn: false,
    };
  }

  const [
    { data: bestRows },
    { data: audioBestRows },
    { data: multiBestRows },
    attemptsResult,
    audioAttemptsResult,
    multiAttemptsResult,
  ] = await Promise.all([
    supabase
      .from('score_submissions')
      .select('score')
      .eq('user_id', user.id)
      .eq('test_slug', 'reaction-time')
      .order('score', { ascending: false })
      .limit(1),
    supabase
      .from('score_submissions')
      .select('score')
      .eq('user_id', user.id)
      .eq('test_slug', 'audio-reaction')
      .order('score', { ascending: false })
      .limit(1),
    supabase
      .from('score_submissions')
      .select('score')
      .eq('user_id', user.id)
      .eq('test_slug', 'multi-reaction')
      .order('score', { ascending: false })
      .limit(1),
    supabase
      .from('score_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('test_slug', 'reaction-time'),
    supabase
      .from('score_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('test_slug', 'audio-reaction'),
    supabase
      .from('score_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('test_slug', 'multi-reaction'),
  ]);

  return {
    attempts: attemptsResult.count ?? 0,
    audioAttempts: audioAttemptsResult.count ?? 0,
    multiAttempts: multiAttemptsResult.count ?? 0,
    bestScore: bestRows?.[0]?.score ?? null,
    audioBestScore: audioBestRows?.[0]?.score ?? null,
    multiBestScore: multiBestRows?.[0]?.score ?? null,
    displayName: getDisplayName(user),
    isSignedIn: true,
  };
}

function getReactionMode(value: string | undefined): ReactionMode {
  if (value === 'audio') {
    return 'audio';
  }

  if (value === 'multi') {
    return 'multi';
  }

  return 'time';
}

function getStatsSlug(mode: ReactionMode): string {
  if (mode === 'audio') return 'audio-reaction';
  if (mode === 'multi') return 'multi-reaction';
  return 'reaction-time';
}

export default async function ReactionPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const mode = getReactionMode(resolvedSearchParams.mode);
  const { attempts, audioAttempts, multiAttempts, bestScore, audioBestScore, multiBestScore, displayName, isSignedIn } = await loadReactionPageData();
  const isMultiplayerSession = Boolean(resolvedSearchParams.lobby);
  const isDuelSession = resolvedSearchParams.mp_mode === 'duel';
  const isDailyGame = resolvedSearchParams.daily === 'true' && !isMultiplayerSession;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      {isMultiplayerSession ? <MultiplayerSessionGuard /> : null}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 sm:gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-4 shadow-[0_6px_0_rgba(226,232,240,1)] sm:items-center sm:px-6">
          <div className="w-full min-w-0 sm:w-auto">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="status-pill">Reaction Category</p>
                <h1 className="mt-2 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
                  Reaction Protocol
                </h1>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                  Choose a mode: visual reaction, audio reaction, or multi-reaction protocol.
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
                  <Link data-return-to-lab className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]" href="/">
                    Return to Lab
                  </Link>
                )}
              </div>
            </div>

            {isMultiplayerSession || isDailyGame ? null : (
              <div className="mt-3">
                <CategoryModeTabs
                  modes={[
                    { id: 'time', label: 'Reaction Time', href: '/category/reaction?mode=time' },
                    { id: 'audio', label: 'Audio Reaction', href: '/category/reaction?mode=audio' },
                    { id: 'multi', label: 'Multi-Reaction', href: '/category/reaction?mode=multi' },
                  ]}
                  activeMode={mode}
                />
              </div>
            )}
          </div>
        </div>

        {mode === 'audio' ? (
          <AudioReactionProtocol initialAttempts={audioAttempts} initialBestScore={audioBestScore} isSignedIn={isSignedIn} />
        ) : mode === 'multi' ? (
          <MultiReactionProtocol
            initialAttempts={multiAttempts}
            initialBestScore={multiBestScore}
            isSignedIn={isSignedIn}
          />
        ) : (
          <ReactionProtocol
            initialAttempts={attempts}
            initialBestScore={bestScore}
            isSignedIn={isSignedIn}
          />
        )}

        {!isMultiplayerSession && !isDailyGame ? (
          <Suspense fallback={null}>
            <GameStatistics testSlug={getStatsSlug(mode)} visible={true} />
          </Suspense>
        ) : null}
      </div>
    </main>
  );
}