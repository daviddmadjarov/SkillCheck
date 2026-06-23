import Link from 'next/link';
import { Suspense } from 'react';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { DuelRoundTimerWrapper } from '@/components/duel-round-timer-wrapper';
import { DailyGameBadge } from '@/components/daily-game-banner';
import { GameStatistics } from '@/components/game-statistics';
import { ModePickerWrapper } from '@/components/mode-picker-wrapper';
import type { ModeOption } from '@/components/mode-picker';

import { AimProtocols } from './aim-protocols';
import { MultiplayerSessionGuard } from '@/components/multiplayer-session-guard';

type SearchParams = { mode?: string; lobby?: string; game?: string; player?: string; round?: string; mp_mode?: string; daily?: string };

type AimMode = 'trainer' | 'moving' | 'split';

const AIM_MODES: ModeOption[] = [
  { id: 'trainer', label: 'Aim Trainer', shortLabel: 'Trainer', description: 'Precision warm-up' },
  { id: 'moving', label: 'Moving Targets', shortLabel: 'Moving', description: 'Motion reading' },
  { id: 'split', label: 'Perfect Split', shortLabel: 'Split', description: 'Geometric precision' },
];

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) return 'Guest Researcher';
  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;
  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

async function loadAimPageData() {
  if (!hasSupabaseEnv()) return { displayName: 'Guest Researcher', isSignedIn: false };
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return { displayName: 'Guest Researcher', isSignedIn: false };
  return { displayName: getDisplayName(user), isSignedIn: true };
}

function getAimMode(value: string | undefined): AimMode {
  if (value === 'moving') return 'moving';
  if (value === 'split') return 'split';
  return 'trainer';
}

function getStatsSlug(mode: AimMode): string {
  if (mode === 'moving') return 'aim-moving-targets';
  if (mode === 'split') return 'aim-perfect-split';
  return 'aim-trainer';
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
  const isSessionLocked = isMultiplayerSession || isDailyGame;

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      {isMultiplayerSession ? <MultiplayerSessionGuard /> : null}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 sm:gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-4 shadow-[0_6px_0_rgba(226,232,240,1)] sm:items-center sm:px-6">
          <div>
            <p className="status-pill">Aim Category</p>
            <h1 className="mt-2 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
              Aim Assessment
            </h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              Choose a mode: aim trainer, moving targets, or perfect split.
            </p>
          </div>

          <div className="flex items-center gap-3">
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

        {/* Compact inline mode picker — client component handles URL updates instantly */}
        <Suspense fallback={null}>
          <ModePickerWrapper
            modes={AIM_MODES}
            activeMode={mode}
            hidden={isSessionLocked}
          />
        </Suspense>

        <AimProtocols mode={mode} isSignedIn={isSignedIn} />

        {!isSessionLocked ? (
          <Suspense fallback={null}>
            <GameStatistics testSlug={getStatsSlug(mode)} visible={true} />
          </Suspense>
        ) : null}
      </div>
    </main>
  );
}
