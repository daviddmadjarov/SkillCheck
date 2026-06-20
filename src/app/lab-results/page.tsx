import Link from 'next/link';
import { CalendarDays, Medal, Trophy } from 'lucide-react';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type SubmissionRow = Pick<
  Database['public']['Tables']['score_submissions']['Row'],
  'test_slug' | 'score' | 'created_at'
>;

type ModeResult = {
  slug: string;
  label: string;
  score: number;
  attempts: number;
  updatedAt: string;
};

const REQUIRED_LAB_RESULT_MODES = [
  'stop-timer',
  'mental-rotation',
  'estimation-challenge',
  'sequence-memory',
] as const;

const MAX_MODE_SCORE = 1000;

const modeLabels: Record<string, string> = {
  'reaction-time': 'Reaction Time',
  'audio-reaction': 'Audio Reaction',
  'multi-reaction': 'Multi Reaction',
  'aim-trainer': 'Aim Trainer',
  'aim-moving-targets': 'Moving Targets',
  'aim-tracking-test': 'Aim Tracking',
  'aim-perfect-split': 'Perfect Split',
  'mental-rotation': 'Mental Rotation',
  'estimation-challenge': 'Estimation Challenge',
  'sequence-memory': 'Sequence Memory',
  'perfect-sync': 'Perfect Sync',
  'stop-timer': 'Stop Timer',
  'typing-speed': 'Typing Speed',
  'mouse-symbol-tracing': 'Mouse Symbol Tracing',
  'symbol-tracing': 'Mouse Symbol Tracing',
  'mouse-cps': 'CPS Tester',
};

function toBucket(testSlug: string) {
  if (modeLabels[testSlug]) {
    return testSlug;
  }

  if (testSlug.startsWith('typing-speed')) {
    return 'typing-speed';
  }

  if (testSlug.startsWith('mouse-symbol-tracing')) {
    return 'mouse-symbol-tracing';
  }

  if (testSlug.startsWith('symbol-tracing')) {
    return 'mouse-symbol-tracing';
  }

  return null;
}

function buildModeResults(rows: SubmissionRow[]): ModeResult[] {
  const byMode = new Map<string, ModeResult>();

  for (const row of rows) {
    if (!Number.isFinite(row.score)) {
      continue;
    }

    const bucket = toBucket(row.test_slug);
    if (!bucket) {
      continue;
    }

    const roundedScore = Math.round(row.score);
    const label = modeLabels[bucket] ?? bucket;
    const current = byMode.get(bucket);

    if (!current) {
      byMode.set(bucket, {
        slug: bucket,
        label,
        score: roundedScore,
        attempts: 1,
        updatedAt: row.created_at ?? new Date(0).toISOString(),
      });
      continue;
    }

    const isNewBest = roundedScore > current.score;
    const latestTimestamp =
      Date.parse(row.created_at ?? '') > Date.parse(current.updatedAt)
        ? (row.created_at ?? current.updatedAt)
        : current.updatedAt;

    byMode.set(bucket, {
      ...current,
      score: isNewBest ? roundedScore : current.score,
      attempts: current.attempts + 1,
      updatedAt: latestTimestamp,
    });
  }

  return [...byMode.values()].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

function withRequiredModeRows(modeResults: ModeResult[]) {
  const byMode = new Map(modeResults.map((entry) => [entry.slug, entry] as const));

  for (const slug of REQUIRED_LAB_RESULT_MODES) {
    if (byMode.has(slug)) {
      continue;
    }

    byMode.set(slug, {
      slug,
      label: modeLabels[slug] ?? slug,
      score: 0,
      attempts: 0,
      updatedAt: new Date(0).toISOString(),
    });
  }

  return [...byMode.values()].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(iso: string) {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(parsed));
}

function getProgressPercent(score: number) {
  const boundedScore = Math.max(0, Math.min(MAX_MODE_SCORE, score));
  return Math.round((boundedScore / MAX_MODE_SCORE) * 100);
}

function calculateAverageScore(modeResults: ModeResult[]): number {
  if (modeResults.length === 0) return 0;
  const totalScore = modeResults.reduce((sum, mode) => sum + mode.score, 0);
  return Math.round(totalScore / modeResults.length);
}

const returnToLabClassName =
  'rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]';

export default async function LabResultsPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
          <section className="lab-card p-6">
            <div className="flex justify-end">
              <Link data-return-to-lab className={returnToLabClassName} href="/">
                Return to Lab
              </Link>
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-800">Lab Results</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              Supabase is not configured yet, so personal performance history is unavailable.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
          <section className="lab-card p-6">
            <div className="flex justify-end">
            <Link data-return-to-lab className={returnToLabClassName} href="/">
              Return to Lab
            </Link>
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-800">Lab Results</h1>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
              Sign in to view your personal best-to-worst results across your game modes.
            </p>
            <a className="lab-button mt-5 inline-flex" href="/auth/login?provider=google">
              Sign In
            </a>
          </section>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase
    .from('score_submissions')
    .select('test_slug, score, created_at')
    .eq('user_id', user.id);

  const modeResults = withRequiredModeRows(buildModeResults(data ?? []));

  // ── Fetch daily challenge completions count ──
  let dailyChallengeCount = 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: dailyCount } = await (supabase.from('daily_challenge_log' as any) as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    dailyChallengeCount = dailyCount ?? 0;
  } catch {
    // Table may not exist yet — silently ignore
  }

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
        <section className="lab-card p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">Lab Results</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                Your best performance in each mode, ordered from strongest to weakest.
              </p>
            </div>
            <Link data-return-to-lab className={returnToLabClassName} href="/">
              Return to Lab
            </Link>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border-2 border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-medium text-rose-700">
                Could not load your results: {error.message}
              </p>
            </div>
          ) : modeResults.length === 0 ? (
            <div className="mt-5 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-600">
                No recorded scores yet. Complete a protocol and your ranking will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Overall Average</p>
                  <p className="mt-1 text-3xl font-black text-slate-800">{formatNumber(calculateAverageScore(modeResults))}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">out of {MAX_MODE_SCORE}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-4 w-full overflow-hidden rounded-full border-2 border-cyan-200 bg-white">
                      <div
                        aria-label="Overall average progress"
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"
                        style={{ width: `${getProgressPercent(calculateAverageScore(modeResults))}%` }}
                      />
                    </div>
                    <p className="shrink-0 text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
                      {getProgressPercent(calculateAverageScore(modeResults))}%
                    </p>
                  </div>
                </div>
                <div className="rounded-[1.4rem] border-2 border-amber-200 bg-amber-50 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-amber-500" />
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Daily Challenges</p>
                  </div>
                  <p className="mt-1 text-3xl font-black text-amber-800">{formatNumber(dailyChallengeCount)}</p>
                  <p className="mt-1 text-xs font-medium text-amber-700">{dailyChallengeCount === 1 ? 'challenge completed all time' : 'challenges completed all time'}</p>
                </div>
              </div>
              <ol className="mt-5 space-y-3">
              {modeResults.map((entry, index) => {
                const progressPercent = getProgressPercent(entry.score);

                return (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 px-4 py-3 sm:flex-nowrap"
                  key={entry.slug}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-[0_3px_0_rgba(226,232,240,1)]">
                      {index < 3 ? <Trophy className="h-5 w-5 text-amber-500" /> : <Medal className="h-5 w-5 text-cyan-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-800">{entry.label}</p>
                      <p className="text-sm font-medium text-slate-500">
                        {entry.attempts} attempts • updated {formatDate(entry.updatedAt)}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-3 w-full overflow-hidden rounded-full border-2 border-cyan-200 bg-white">
                          <div
                            aria-label={`${entry.label} progress`}
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <p className="shrink-0 text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
                          {progressPercent}%
                        </p>
                      </div>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        {formatNumber(Math.max(0, Math.min(MAX_MODE_SCORE, entry.score)))}/{MAX_MODE_SCORE}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">#{index + 1}</p>
                    <p className="text-2xl font-black text-slate-800">{formatNumber(entry.score)}</p>
                  </div>
                </li>
                );
              })}
            </ol>
            </>
          )}
        </section>
      </div>
    </main>
  );
}