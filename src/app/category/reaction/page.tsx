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

async function loadReactionPageData() {
  if (!hasSupabaseEnv()) {
    return { attempts: 0, audioAttempts: 0, multiAttempts: 0, bestScore: null as number | null, audioBestScore: null as number | null, multiBestScore: null as number | null, isSignedIn: false };
  }
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return { attempts: 0, audioAttempts: 0, multiAttempts: 0, bestScore: null, audioBestScore: null, multiBestScore: null, isSignedIn: false };

  const bestResult = await supabase.from('score_submissions').select('score').eq('user_id', user.id).eq('test_slug', 'reaction-time').order('score', { ascending: false }).limit(1);
  const audioBestResult = await supabase.from('score_submissions').select('score').eq('user_id', user.id).eq('test_slug', 'audio-reaction').order('score', { ascending: false }).limit(1);
  const multiBestResult = await supabase.from('score_submissions').select('score').eq('user_id', user.id).eq('test_slug', 'multi-reaction').order('score', { ascending: false }).limit(1);
  const attemptsResult = await supabase.from('score_submissions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('test_slug', 'reaction-time');
  const audioAttemptsResult = await supabase.from('score_submissions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('test_slug', 'audio-reaction');
  const multiAttemptsResult = await supabase.from('score_submissions').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('test_slug', 'multi-reaction');

  return {
    attempts: attemptsResult.count ?? 0, audioAttempts: audioAttemptsResult.count ?? 0, multiAttempts: multiAttemptsResult.count ?? 0,
    bestScore: bestResult.data?.[0]?.score ?? null, audioBestScore: audioBestResult.data?.[0]?.score ?? null, multiBestScore: multiBestResult.data?.[0]?.score ?? null,
    isSignedIn: true,
  };
}

function getReactionMode(value: string | undefined): ReactionMode {
  if (value === 'audio') return 'audio';
  if (value === 'multi') return 'multi';
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
  const data = await loadReactionPageData();
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
                  { id: 'time', label: 'Reaction Time', href: '/category/reaction?mode=time' },
                  { id: 'audio', label: 'Audio Reaction', href: '/category/reaction?mode=audio' },
                  { id: 'multi', label: 'Multi-Reaction', href: '/category/reaction?mode=multi' },
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

        {mode === 'audio' ? (
          <AudioReactionProtocol initialAttempts={data.audioAttempts} initialBestScore={data.audioBestScore} isSignedIn={data.isSignedIn} />
        ) : mode === 'multi' ? (
          <MultiReactionProtocol initialAttempts={data.multiAttempts} initialBestScore={data.multiBestScore} isSignedIn={data.isSignedIn} />
        ) : (
          <ReactionProtocol initialAttempts={data.attempts} initialBestScore={data.bestScore} isSignedIn={data.isSignedIn} />
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