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
import { GameInfoPanel } from '@/components/game-info-panel';

type SearchParams = { mode?: string; lobby?: string; game?: string; player?: string; round?: string; mp_mode?: string; daily?: string };

type AimMode = 'trainer' | 'moving' | 'split';

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) {
    return 'Guest Researcher';
  }

  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;

  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

async function loadAimPageData() {
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

function getAimMode(value: string | undefined): AimMode {
  if (value === 'moving') {
    return 'moving';
  }

  if (value === 'split') {
    return 'split';
  }

  return 'trainer';
}

export default async function AimPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const mode = getAimMode(resolvedSearchParams.mode);
  const { displayName, isSignedIn } = await loadAimPageData();
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
              <p className="status-pill">Aim Category</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
                Aim Assessment
              </h1>
            </div>
            {/* Right-side buttons on mobile */}
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
                  { id: 'trainer', label: 'Aim Trainer', href: '/category/aim?mode=trainer' },
                  { id: 'moving', label: 'Moving Targets', href: '/category/aim?mode=moving' },
                  { id: 'split', label: 'Perfect Split', href: '/category/aim?mode=split' },
                ]}
                activeMode={mode}
              />
            </div>
          )}

          {/* Right-side buttons on desktop (hidden on mobile) */}
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

        <AimProtocols mode={mode} isSignedIn={isSignedIn} />

        {!isMultiplayerSession && !isDailyGame ? (
          <>
            <Suspense fallback={null}>
              <GameStatistics testSlug={mode === 'moving' ? 'aim-moving-targets' : mode === 'split' ? 'aim-perfect-split' : 'aim-trainer'} visible={true} />
            </Suspense>
            <Suspense fallback={null}>
              <GameInfoPanel
                title={mode === 'moving' ? 'Moving Targets' : mode === 'split' ? 'Perfect Split' : 'Aim Trainer'}
                description={
                  mode === 'moving'
                    ? 'Moving Targets tests your ability to track and hit dynamically moving targets. Unlike static aim training, this mode forces you to predict movement trajectories and adjust your aim in real time — a skill essential for competitive gaming and any fast-paced visual tracking task.'
                    : mode === 'split'
                      ? 'Perfect Split challenges your precision by requiring you to land shots on small, precisely positioned targets. This mode emphasises accuracy over speed, training your fine motor control and the consistency of your aim under controlled conditions.'
                      : 'The Aim Trainer presents static targets one after another, measuring how quickly and accurately you can acquire each one. This is the foundational test of hand-eye coordination — the ability to move your cursor to a precise location and click with minimal delay.'
                }
                skillDescription={
                  mode === 'moving'
                    ? 'Dynamic hand-eye coordination and target tracking — your ability to predict motion, adjust aim mid-trajectory, and time your click to intersect with a moving target.'
                    : mode === 'split'
                      ? 'Fine motor control and pixel-perfect precision. This test isolates your ability to make small, accurate cursor adjustments without overshooting — a skill that separates good aim from great aim.'
                      : 'Static hand-eye coordination — the speed and accuracy with which you can move your cursor from one point to another and click. This is the most basic and most trained aiming skill in first-person gaming.'
                }
                howScoringWorks={
                  mode === 'moving'
                    ? 'Your score is based on your accuracy percentage (hits vs misses) and your average time-to-target in milliseconds. Both factors are combined into a single score — higher accuracy and faster acquisition yield a higher total score.'
                    : mode === 'split'
                      ? 'Scoring is based on your accuracy percentage across multiple precision targets. Each target is small and requires a deliberate, controlled click. The closer you get to 100% accuracy, the better your score. Speed is secondary to precision here.'
                      : 'Your score combines accuracy (percentage of targets hit) with your average target acquisition time. The formula rewards both speed and precision — rushing will lower accuracy, while being too slow will lower your time score.'
                }
                tips={
                  mode === 'moving'
                    ? [
                        'Predict the trajectory rather than chasing the target. Your eyes should lead the cursor, not follow it.',
                        'Use a low mouse sensitivity for smoother tracking — high sensitivity makes fine adjustments harder.',
                        'Practise tracking in both horizontal and vertical patterns. Most players are stronger in one axis.',
                        'Keep your arm relaxed. Tension causes micro-adjustments that throw off tracking.',
                      ]
                    : mode === 'split'
                      ? [
                          'Take your time on each shot. Precision mode rewards accuracy over speed, so do not rush.',
                          'Use a mouse with high DPI and a consistent sensor for the most reliable cursor control.',
                          'Focus on your grip — a consistent claw or palm grip produces more repeatable aim.',
                          'Take breaks between attempts. Fine motor control degrades with fatigue.',
                        ]
                      : [
                          'Keep your crosshair at head/centre height (on screen) between targets to minimise travel distance.',
                          'Use your arm for large movements and your wrist for fine adjustments.',
                          'Find a sensitivity that lets you do a full 180-degree turn with one comfortable swipe.',
                          'Warm up with 5–10 minutes of aim training before competitive gaming sessions.',
                          'Stay consistent with your mouse, pad, and sensitivity. Muscle memory builds through repetition.',
                        ]
                }
                whyUseful={
                  mode === 'moving'
                    ? 'Moving target aim is the most transferable aiming skill for real-time applications — competitive FPS games, drone piloting, wildlife photography, and any field requiring tracking of moving objects through space.'
                    : mode === 'split'
                      ? 'Perfect Split precision translates directly to scenarios where accuracy matters more than speed — surgery simulations, graphic design work, micro-soldering, and any profession requiring steady hands and precise tool control.'
                      : 'Aim training is the most direct way to improve hand-eye coordination. Gamers who practise aim training see measurable improvements in their in-game performance, and the skill transfers to many real-world activities requiring precise visual-motor coordination.'
                }
              />
            </Suspense>
          </>
        ) : null}
      </div>
    </main>
  );
}