import Link from 'next/link';
import { Suspense } from 'react';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { DuelRoundTimerWrapper } from '@/components/duel-round-timer-wrapper';
import { DailyGameBadge } from '@/components/daily-game-banner';
import { GameStatistics } from '@/components/game-statistics';
import { GameInfoPanel } from '@/components/game-info-panel';

import { TypingProtocol } from './typing-protocol';
import { MultiplayerSessionGuard } from '@/components/multiplayer-session-guard';

type SearchParams = { duration?: string; language?: string; lobby?: string; game?: string; player?: string; round?: string; mp_mode?: string; daily?: string };

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) {
    return 'Guest Researcher';
  }

  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;

  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

async function loadTypingPageData() {
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

export default async function TypingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { displayName, isSignedIn } = await loadTypingPageData();
  const isMultiplayerSession = Boolean(resolvedSearchParams.lobby);
  const isDuelSession = resolvedSearchParams.mp_mode === 'duel';
  const isDailyGame = resolvedSearchParams.daily === 'true' && !isMultiplayerSession;

  const initialDuration = resolvedSearchParams.duration === '60' ? 60 : 30;
  const initialLanguage = resolvedSearchParams.language === 'german'
    ? 'german'
    : resolvedSearchParams.language === 'spanish'
      ? 'spanish'
      : 'english';

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      {isMultiplayerSession ? <MultiplayerSessionGuard /> : null}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 sm:gap-5">
        <div className="flex flex-col gap-3 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-4 shadow-[0_6px_0_rgba(226,232,240,1)] sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:min-w-0">
            <div className="min-w-0">
              <p className="status-pill">Typing Category</p>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
                Typing Speed Test
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

          <div className="hidden sm:flex sm:flex-1" /> {/* spacer */}

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

        <TypingProtocol
          initialDuration={initialDuration}
          initialLanguage={initialLanguage}
          isSignedIn={isSignedIn}
          isDailyGame={isDailyGame}
        />

        {!isMultiplayerSession && !isDailyGame ? (
          <>
            <Suspense fallback={null}>
              <GameStatistics testSlug="typing-speed" visible={true} />
            </Suspense>
            <Suspense fallback={null}>
              <GameInfoPanel
                title="Typing Speed Test"
                description="The Keystroke Test measures your typing speed and accuracy across timed sessions. You are presented with a text passage and must type it as quickly and accurately as possible. The test supports English, German, and Spanish, and offers 30-second and 60-second durations."
                skillDescription="Your typing fluency — the speed (words per minute) and accuracy (error rate) with which you can transcribe written text. This measures both your keyboard familiarity and your language processing speed."
                howScoringWorks="Your gross WPM is calculated as total characters typed divided by five (the standard word length) divided by time in minutes. Your net WPM subtracts a penalty for each incorrect word. Accuracy is reported as the percentage of correctly typed characters. The test records both your raw speed and your effective speed after errors."
                tips={[
                  'Focus on accuracy first. Speed naturally follows as your muscle memory develops — rushing causes errors that slow your effective WPM.',
                  'Use all ten fingers and maintain proper home-row position. Hunting for keys is the single biggest speed limiter.',
                  'Practise with the language you use most, but challenge yourself with others — switching languages forces your brain to engage differently.',
                  'Take the 60-second test for endurance measurement and the 30-second test for sprint speed. They measure different aspects of typing ability.',
                  'Warm up with a few practice sentences before attempting your best score.',
                ]}
                whyUseful="Typing speed is one of the most directly applicable skills measured on SkillCheck. Faster typing saves hours every week for knowledge workers, programmers, writers, and students. It is also a reliable indicator of overall computer literacy."
              />
            </Suspense>
          </>
        ) : null}
      </div>
    </main>
  );
}