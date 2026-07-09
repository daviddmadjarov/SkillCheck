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
import { GameInfoPanel } from '@/components/game-info-panel';

type SearchParams = { duration?: string; mode?: string; traceMode?: string; lobby?: string; game?: string; player?: string; round?: string; mp_mode?: string; daily?: string };

type MouseMode = 'symbol' | 'cps' | 'tracking';

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) {
    return 'Guest Researcher';
  }

  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;

  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

async function loadMousePageData() {
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

function getMouseMode(value: string | undefined): MouseMode {
  if (value === 'cps') {
    return 'cps';
  }

  if (value === 'tracking') {
    return 'tracking';
  }

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
  const initialCpsDuration = resolvedSearchParams.duration === '5'
    ? 5
    : resolvedSearchParams.duration === '15'
      ? 15
      : 10;
  const { displayName, isSignedIn } = await loadMousePageData();
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
              <p className="status-pill">Mouse Category</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
                Mouse Control
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
                modes={[
                  { id: 'symbol', label: 'Symbol Tracing', href: '/category/mouse?mode=symbol' },
                  { id: 'tracking', label: 'Tracking Test', href: '/category/mouse?mode=tracking' },
                  { id: 'cps', label: 'CPS Tester', href: '/category/mouse?mode=cps' },
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

        <MouseProtocols
          initialCpsDuration={initialCpsDuration}
          initialTraceMode={initialTraceMode}
          isSignedIn={isSignedIn}
          mode={mode}
        />

        {!isMultiplayerSession && !isDailyGame ? (
          <>
            <Suspense fallback={null}>
              <GameStatistics testSlug={getStatsSlug(mode)} visible={true} />
            </Suspense>
            <Suspense fallback={null}>
              <GameInfoPanel
                title={mode === 'cps' ? 'CPS Tester' : mode === 'tracking' ? 'Tracking Test' : 'Symbol Tracing'}
                description={
                  mode === 'cps'
                    ? 'CPS (Clicks Per Second) Tester measures how many times you can click your mouse button within a set time window. This is a pure test of finger speed and endurance — no precision required, just raw click rate.'
                    : mode === 'tracking'
                      ? 'The Tracking Test evaluates your ability to follow a moving target smoothly and accurately with your cursor. Unlike the Aim Assessment which focuses on discrete clicks, this test measures continuous cursor control — how steadily you can stay on target over time.'
                      : 'Symbol Tracing tests your ability to trace along predefined paths with your cursor, measuring how precisely you can follow a given trajectory. This combines fine motor control with visual guidance, similar to tracing a line on paper but with your mouse.'
                }
                skillDescription={
                  mode === 'cps'
                    ? 'Your click speed and finger endurance — measured in clicks per second. This tests the maximum firing rate of your motor neurons and the fatigue resistance of your finger muscles.'
                    : mode === 'tracking'
                      ? 'Your smooth pursuit ability — how steadily and accurately you can keep your cursor aligned with a moving target. This tests different neural circuits than discrete aiming, relying on continuous visual feedback and fine motor adjustments.'
                      : 'Your trajectory precision — the accuracy with which you can follow a predetermined path. This tests your hand-eye coordination in a continuous, guided format rather than point-to-point movement.'
                }
                howScoringWorks={
                  mode === 'cps'
                    ? 'Your score is the average number of clicks per second over the test duration. You can choose between 5, 10, or 15-second tests. A score of 8–10 CPS is average, 10–12 is above average, and 12+ is exceptional with normal clicking techniques.'
                    : mode === 'tracking'
                      ? 'Your score is based on how well your cursor stays within the target zone over the tracking duration. The system measures deviation from the target centre over time — lower deviation means a higher score. Accuracy percentage and total time-on-target are displayed.'
                      : 'Your score is based on how closely your traced path matches the reference path. The system measures deviation at multiple points along the trace. Higher precision and fewer overshoots yield a better score. Speed is less important than accuracy.'
                }
                tips={
                  mode === 'cps'
                    ? [
                        'Use a consistent clicking technique — whether you prefer index finger, middle finger, or a jitter-click style, stick with what works.',
                        'Relax your wrist and forearm. Tension reduces blood flow and accelerates fatigue.',
                        'Practise short bursts (5 seconds) to build peak speed, then longer sessions (15 seconds) for endurance.',
                        'Take breaks between attempts. Click speed drops significantly with finger fatigue.',
                      ]
                    : mode === 'tracking'
                      ? [
                          'Keep your eyes ahead of the target, not on it. Smooth pursuit is more effective when your vision leads the motion.',
                          'Use a lower sensitivity for tracking — it allows finer adjustments and reduces overshoot.',
                          'Maintain a light grip on your mouse. Death-gripping causes micro-tremors that show up in your tracking data.',
                          'Practise with both horizontal and vertical tracking patterns to build balanced control.',
                        ]
                      : [
                          'Move slowly and deliberately. Tracing is about precision, not speed.',
                          'Use your arm for the general path and your wrist for fine adjustments around curves.',
                          'Rest your wrist on the desk for stability. Floating your arm reduces control.',
                          'Practise the same symbols multiple times — your muscle memory will improve path accuracy over repetitions.',
                        ]
                }
                whyUseful={
                  mode === 'cps'
                    ? 'Click speed is relevant in competitive gaming (especially PvP combat, building in Minecraft, and rapid-fire scenarios) and can indicate general hand dexterity and fine motor control.'
                    : mode === 'tracking'
                      ? 'Smooth tracking is critical in any scenario requiring continuous target following — competitive gaming (tracking enemies in FPS games), video editing (precise timeline scrubbing), and any task requiring steady cursor control over time.'
                      : 'Symbol tracing ability translates to any task requiring precise, continuous mouse guidance — graphic design, CAD work, photo editing with precise selections, and digital art.'
                }
              />
            </Suspense>
          </>
        ) : null}
      </div>
    </main>
  );
}