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

const returnToLabClassName = 'lab-button-refined';

export default async function LabResultsPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
          <section className="lab-card-refined p-6 sm:p-8">
            <div className="flex justify-end">
              <Link data-return-to-lab className={returnToLabClassName} href="/">
                Return to Lab
              </Link>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Lab Results</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
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
          <section className="lab-card-refined p-6 sm:p-8">
            <div className="flex justify-end">
              <Link data-return-to-lab className={returnToLabClassName} href="/">
                Return to Lab
              </Link>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Lab Results</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              Sign in to view your personal best-to-worst results across your game modes.
            </p>
            <a className="lab-button-refined mt-6 inline-flex" href="/auth/login?provider=google">
              Sign In with Google
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
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
        <section className="lab-card-refined p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Lab Results</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                Your best performance in each mode, ordered from strongest to weakest.
              </p>
            </div>
            <Link data-return-to-lab className={returnToLabClassName} href="/">
              Return to Lab
            </Link>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-medium text-rose-700">
                Could not load your results: {error.message}
              </p>
            </div>
          ) : modeResults.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-600">
                No recorded scores yet. Complete a protocol and your ranking will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <div className="lab-stat-card">
                  <p className="lab-stat-label">Overall Average</p>
                  <p className="lab-stat-value">{formatNumber(calculateAverageScore(modeResults))}</p>
                  <p className="lab-stat-secondary">out of {MAX_MODE_SCORE}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="lab-progress-bar">
                      <div
                        aria-label="Overall average progress"
                        className="lab-progress-fill"
                        style={{ width: `${getProgressPercent(calculateAverageScore(modeResults))}%` }}
                      />
                    </div>
                    <p className="shrink-0 text-xs font-bold uppercase tracking-widest text-indigo-600">
                      {getProgressPercent(calculateAverageScore(modeResults))}%
                    </p>
                  </div>
                </div>
                <div className="lab-stat-card">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="lab-accent-icon" />
                    <p className="lab-stat-label">Daily Challenges</p>
                  </div>
                  <p className="lab-stat-value">{formatNumber(dailyChallengeCount)}</p>
                  <p className="lab-stat-secondary">{dailyChallengeCount === 1 ? 'challenge completed all time' : 'challenges completed all time'}</p>
                </div>
              </div>
              <div className="mt-8">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500">Your Rankings</h2>
                <ol className="space-y-3">
                  {modeResults.map((entry, index) => {
                    const progressPercent = getProgressPercent(entry.score);

                    return (
                      <li
                        className="lab-mode-item"
                        key={entry.slug}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                            {index < 3 ? <Trophy className="h-5 w-5 text-amber-500" /> : <Medal className="h-5 w-5 text-indigo-600" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-slate-900">{entry.label}</p>
                            <p className="text-xs font-medium text-slate-500">
                              {entry.attempts} {entry.attempts === 1 ? 'attempt' : 'attempts'} • updated {formatDate(entry.updatedAt)}
                            </p>
                            <div className="mt-2 flex items-center gap-3">
                              <div className="lab-progress-bar">
                                <div
                                  aria-label={`${entry.label} progress`}
                                  className="lab-progress-fill"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <p className="shrink-0 text-xs font-bold uppercase tracking-widest text-indigo-600">
                                {progressPercent}%
                              </p>
                            </div>
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                              {formatNumber(Math.max(0, Math.min(MAX_MODE_SCORE, entry.score)))}/{MAX_MODE_SCORE}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Rank</p>
                          <p className="text-2xl font-black text-indigo-600">#{index + 1}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}