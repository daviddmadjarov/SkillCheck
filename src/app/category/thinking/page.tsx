import Link from 'next/link';
import { Suspense } from 'react';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

import { DuelRoundTimerWrapper } from '@/components/duel-round-timer-wrapper';
import { DailyGameBadge } from '@/components/daily-game-banner';
import { CategoryModeTabs } from '@/components/category-mode-tabs';
import { GameStatistics } from '@/components/game-statistics';
import { GameInfoPanel } from '@/components/game-info-panel';
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
        <div className="flex flex-col gap-3 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-4 shadow-[0_6px_0_rgba(226,232,240,1)] sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:min-w-0">
            <div className="min-w-0">
              <p className="status-pill">Cognitive Category</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
                Cognitive Review
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
                  <Link
                    data-return-to-lab
                    className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-5 py-2.5 font-bold text-xs text-white shadow-[0_3px_0_rgba(15,23,42,1)] transition-all duration-150 active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
                    href="/"
                  >
                    Return to Lab
                  </Link>
              )}
            </div>
          </div>

          {isMultiplayerSession || isDailyGame ? null : (
            <div className="flex justify-center sm:flex-1 sm:justify-center">
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
              <Link
                data-return-to-lab
                className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-5 py-2 font-bold text-sm text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
                href="/"
              >
                Return to Lab
              </Link>
            )}
          </div>
        </div>

        <CognitiveProtocols isSignedIn={isSignedIn} mode={mode} />

        {!isMultiplayerSession && !isDailyGame ? (
          <>
            <Suspense fallback={null}>
              <GameStatistics testSlug={mode === 'estimation' ? 'estimation-challenge' : mode === 'sequence' ? 'sequence-memory' : 'mental-rotation'} visible={true} />
            </Suspense>
            <Suspense fallback={null}>
              <GameInfoPanel
                title={mode === 'estimation' ? 'Estimation Challenge' : mode === 'sequence' ? 'Sequence Memory' : 'Mental Rotation'}
                description={
                  mode === 'estimation'
                    ? 'The Estimation Challenge tests your ability to quickly and accurately estimate numerical quantities. You are shown a set of objects and must estimate the count as precisely as possible — a test of your intuitive numerical processing.'
                    : mode === 'sequence'
                      ? 'Sequence Memory challenges your short-term memory by presenting a sequence of visual cues that you must reproduce from memory. The sequence grows longer with each successful recall, pushing your working memory to its limit.'
                      : 'Mental Rotation measures your spatial reasoning ability by presenting 3D shapes and asking you to determine whether one is a rotated version of another. This classic cognitive test is one of the most well-studied measures of spatial intelligence.'
                }
                skillDescription={
                  mode === 'estimation'
                    ? 'Your intuitive numerical estimation ability — how accurately your brain can approximate quantities without counting. This engages the parietal lobe\'s number sense and is linked to broader mathematical intuition.'
                    : mode === 'sequence'
                      ? 'Your visual working memory capacity — the number of items you can hold in short-term memory and recall in order. This is a core component of fluid intelligence and is strongly correlated with general cognitive ability.'
                      : 'Your spatial visualisation ability — the capacity to mentally rotate and compare 3D objects in your mind\'s eye. Spatial reasoning is a key component of intelligence that predicts success in STEM fields, architecture, and design.'
                }
                howScoringWorks={
                  mode === 'estimation'
                    ? 'Your score is based on the accuracy of your estimates across multiple trials. The system measures the percentage deviation from the true count. Consistent estimates within 10–20% of the true value indicate strong intuitive number sense.'
                    : mode === 'sequence'
                      ? 'Your score is the length of the longest sequence you can correctly recall. The sequence starts short and increases by one item after each successful recall. Your final score is the maximum sequence length achieved before your first mistake.'
                    : 'Your score is based on your accuracy percentage and average response time across multiple mental rotation trials. Faster and more accurate responses indicate stronger spatial reasoning. The difficulty adjusts based on rotation angles — larger angles require more mental computation.'
                }
                tips={
                  mode === 'estimation'
                    ? [
                        'Use grouping strategies — mentally divide the objects into small clusters (groups of 5 or 10) and multiply.',
                        'Do not try to count every individual item. Estimation is about approximate, not exact, quantity.',
                        'Practise with real-world objects — estimating crowd sizes, items in a jar, or leaves on a branch.',
                        'Pay attention to patterns. Regular arrangements are easier to estimate than random scattering.',
                      ]
                    : mode === 'sequence'
                      ? [
                          'Use chunking — group items into meaningful pairs or triples rather than remembering each one individually.',
                          'Create a mental story or visual map linking the items. Narrative association is more durable than raw memorisation.',
                          'Repeat the sequence silently to yourself after it is shown. Verbal rehearsal reinforces visual memory.',
                          'Stay calm. Anxiety impairs working memory performance more than almost any other factor.',
                        ]
                      : [
                          'Try to mentally rotate the object along one axis at a time rather than all three simultaneously.',
                          'Look for distinguishing features — a unique protrusion or marking can help you track orientation.',
                          'Use your hands to physically rotate if it helps. The gesture can reinforce mental rotation.',
                          'Practise with real 3D objects — physically rotating objects builds the same neural pathways.',
                        ]
                }
                whyUseful={
                  mode === 'estimation'
                    ? 'Numerical estimation is used constantly in everyday life — budgeting, cooking, shopping, and time management. Strong estimation skills also correlate with better overall mathematical ability and faster decision-making under uncertainty.'
                    : mode === 'sequence'
                      ? 'Working memory capacity is one of the strongest predictors of academic and professional success. It affects reading comprehension, following instructions, mental arithmetic, and your ability to hold and manipulate information in real time.'
                    : 'Spatial reasoning is a cornerstone of human intelligence. It predicts success in science, technology, engineering, and mathematics more strongly than verbal or mathematical ability alone. It is also trainable — regular practice improves your spatial IQ.'
                }
              />
            </Suspense>
          </>
        ) : null}
      </div>
    </main>
  );
}