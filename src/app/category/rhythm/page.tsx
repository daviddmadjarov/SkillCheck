import Link from 'next/link';
import { Suspense } from 'react';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

import { DuelRoundTimerWrapper } from '@/components/duel-round-timer-wrapper';
import { DailyGameBadge } from '@/components/daily-game-banner';
import { CategoryModeTabs } from '@/components/category-mode-tabs';
import { GameStatistics } from '@/components/game-statistics';
import { GameInfoPanel } from '@/components/game-info-panel';
import { RhythmProtocols } from './rhythm-protocols';
import { MultiplayerSessionGuard } from '@/components/multiplayer-session-guard';

type SearchParams = { mode?: string; lobby?: string; game?: string; player?: string; round?: string; mp_mode?: string; daily?: string };

type RhythmMode = 'sync' | 'timer' | 'overclock';

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) {
    return 'Guest Researcher';
  }

  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;

  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

async function loadRhythmPageData() {
  if (!hasSupabaseEnv()) {
    return {
      displayName: 'Guest Researcher',
      isSignedIn: false,
    };
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return {
      displayName: 'Guest Researcher',
      isSignedIn: false,
    };
  }

  return {
    displayName: getDisplayName(user),
    isSignedIn: true,
  };
}

function getRhythmMode(value: string | undefined): RhythmMode {
  if (value === 'timer') {
    return 'timer';
  }

  if (value === 'overclock') {
    return 'overclock';
  }

  return 'sync';
}

export default async function RhythmPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const mode = getRhythmMode(resolvedSearchParams.mode);
  const { displayName, isSignedIn } = await loadRhythmPageData();
  const isMultiplayerSession = Boolean(resolvedSearchParams.lobby);
  const isDuelSession = resolvedSearchParams.mp_mode === 'duel';
  const isDailyGame = resolvedSearchParams.daily === 'true' && !isMultiplayerSession;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      {isMultiplayerSession ? <MultiplayerSessionGuard /> : null}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 sm:gap-5">
        <div className="flex flex-col gap-3 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-4 shadow-[0_6px_0_rgba(226,232,240,1)] sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:min-w-0">
            <div className="min-w-0">
              <p className="status-pill">Rhythm Category</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
                Rhythm Sync
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:hidden shrink-0">
              <Suspense fallback={null}><DuelRoundTimerWrapper /></Suspense>
              {isMultiplayerSession ? (
                <div className={`rounded-2xl border-2 px-3 py-1.5 text-xs font-bold whitespace-nowrap ${
                  isDuelSession
                    ? 'border-rose-300 bg-rose-50 text-rose-600'
                    : 'border-cyan-300 bg-cyan-50 text-cyan-700'
                }`}>
                  {isDuelSession ? 'In Duel' : 'In Party'}
                </div>
              ) : isDailyGame ? (
                <Suspense fallback={null}><DailyGameBadge /></Suspense>
              ) : (
                <Link data-return-to-lab className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-5 py-2.5 font-bold text-xs text-white shadow-[0_3px_0_rgba(15,23,42,1)] transition-all duration-150 active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]" href="/">
                  Return to Lab
                </Link>
              )}
            </div>
          </div>

          {isMultiplayerSession || isDailyGame ? null : (
            <div className="flex justify-center sm:flex-1 sm:justify-center">
              <CategoryModeTabs
                accent="violet"
                modes={[
                  { id: 'sync', label: 'Sync Test', href: '/category/rhythm?mode=sync' },
                  { id: 'timer', label: 'Stop the Timer', href: '/category/rhythm?mode=timer' },
                  { id: 'overclock', label: 'Overclock', href: '/category/rhythm?mode=overclock' },
                ]}
                activeMode={mode}
              />
            </div>
          )}

          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <div className="hidden items-center gap-2 sm:flex">
              <Suspense fallback={null}><DuelRoundTimerWrapper /></Suspense>
              <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600">
                {displayName}
              </div>
            </div>
            {isMultiplayerSession ? (
              <div className={`rounded-2xl border-2 px-5 py-2 text-sm font-bold whitespace-nowrap ${
                isDuelSession
                  ? 'border-rose-300 bg-rose-50 text-rose-600'
                  : 'border-cyan-300 bg-cyan-50 text-cyan-700'
              }`}>
                {isDuelSession ? 'In Duel' : 'In Party'}
              </div>
            ) : isDailyGame ? (
              <Suspense fallback={null}><DailyGameBadge /></Suspense>
            ) : (
              <Link data-return-to-lab className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-5 py-2 font-bold text-sm text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]" href="/">
                Return to Lab
              </Link>
            )}
          </div>
        </div>

        <RhythmProtocols isSignedIn={isSignedIn} mode={mode} />

        {!isMultiplayerSession && !isDailyGame ? (
          <>
            <Suspense fallback={null}>
              <GameStatistics testSlug={mode === 'timer' ? 'stop-timer' : mode === 'overclock' ? 'perfect-sync' : 'perfect-sync'} visible={true} />
            </Suspense>
            <Suspense fallback={null}>
              <GameInfoPanel
                title={mode === 'timer' ? 'Stop the Timer' : mode === 'overclock' ? 'Overclock' : 'Sync Test'}
                description={
                  mode === 'timer'
                    ? 'Stop the Timer tests your internal time estimation ability. A timer starts counting up, and you must stop it as close to a target time as possible — without any visual countdown aid. This is a pure test of your internal clock accuracy.'
                    : mode === 'overclock'
                      ? 'Overclock pushes your timing precision to the limit. You must tap or click in perfect synchronisation with an accelerating rhythm. As the tempo increases, maintaining accuracy becomes exponentially harder — revealing the upper limits of your timing control.'
                      : 'The Sync Test measures how accurately you can match a steady rhythm by tapping in time with a visual or auditory beat. This tests your internal timing mechanism and your ability to synchronise motor output with a rhythmic reference.'
                }
                skillDescription={
                  mode === 'timer'
                    ? 'Your internal time estimation — the accuracy of your brain\'s ability to measure elapsed time without external cues. This engages the basal ganglia and cerebellum, regions responsible for timing and motor coordination.'
                    : mode === 'overclock'
                      ? 'Your timing precision under increasing speed demands. This tests both your maximum tapping rate and your ability to maintain accuracy as the rhythm accelerates, engaging your brain\'s timing networks at their limit.'
                      : 'Your sensorimotor synchronisation — the ability to align your physical actions with an external rhythmic stimulus. This is a fundamental skill that engages multiple brain regions including the auditory cortex, motor cortex, and cerebellum.'
                }
                howScoringWorks={
                  mode === 'timer'
                    ? 'Your score is the absolute difference (in milliseconds) between your stop time and the target time. Lower deviation means better timing. A deviation of under 50 ms is excellent, 50–100 ms is good, and over 150 ms suggests room for improvement in time estimation.'
                    : mode === 'overclock'
                      ? 'Your score is based on the highest tempo (beats per minute) at which you can maintain accurate synchronisation. As the BPM increases, your accuracy percentage is tracked. Your final score reflects the peak BPM achieved with acceptable accuracy.'
                      : 'Your score measures the consistency and accuracy of your taps relative to the beat. The system calculates the standard deviation of your timing offset — lower variance means more reliable rhythm. Accuracy percentage is also displayed.'
                }
                tips={
                  mode === 'timer'
                    ? [
                        'Do not count in your head. Counting introduces variability — try to feel the duration instead.',
                        'Maintain a consistent mental state between attempts. Stress and fatigue affect time perception.',
                        'Use the same finger and the same motion each time. Consistency in execution improves consistency in timing.',
                        'Practise at different target durations. Your internal clock may be more accurate at certain intervals.',
                      ]
                    : mode === 'overclock'
                      ? [
                          'Start relaxed. Tension in your hand will limit your maximum tapping speed.',
                          'Use a light touch — bottoming out the key or button wastes energy and slows you down.',
                          'Focus on the rhythm, not the speed. Let accuracy guide your tempo, not the other way around.',
                          'Take breaks between attempts. Timing precision degrades rapidly with fatigue.',
                        ]
                      : [
                          'Tap with the beat, not slightly after. Anticipate the beat rather than reacting to it.',
                          'Close your eyes if the visual cue is distracting — you may find audio rhythm easier to follow.',
                          'Keep your tapping motion small and consistent. Large movements introduce timing variability.',
                          'Start with slower tempos and gradually work up. Solid rhythm at low BPM builds the foundation for fast BPM.',
                        ]
                }
                whyUseful={
                  mode === 'timer'
                    ? 'Time estimation accuracy is relevant in music performance, sports (timing your movements in racing or combat sports), public speaking (pacing), and any situation where you need to judge elapsed time without a clock.'
                    : mode === 'overclock'
                      ? 'High-speed rhythm accuracy is directly applicable to music performance (especially fast passages), competitive rhythm games, and any activity requiring precise rapid timing — from typing to high-speed assembly work.'
                      : 'Rhythm synchronisation is a core musical skill, but it also correlates with broader cognitive abilities including attention, working memory, and even language processing. Good rhythm performers often show advantages in reading and temporal processing.'
                }
              />
            </Suspense>
          </>
        ) : null}
      </div>
    </main>
  );
}