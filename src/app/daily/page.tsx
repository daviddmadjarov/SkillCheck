'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Trophy } from 'lucide-react';

type DailyChallenge = {
  date: string;
  gameSlug: string;
  gameLabel: string;
  gameDescription: string;
  gameCategory: string;
  gameHref: string;
  completed: boolean;
  userScore: number | null;
};

function DailyPageContent() {
  const searchParams = useSearchParams();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const redirectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const justCompleted = searchParams.get('completed') === '1';
  const hasStartedRedirectRef = useRef(false);

  // Strip ?completed=1 from the URL on first mount so bookmarking or
  // returning to this URL won't trigger a second redirect.
  useEffect(() => {
    if (justCompleted) {
      window.history.replaceState({}, '', '/daily');
    }
  }, [justCompleted]);

  const fetchChallenge = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/daily');
      const payload = await response.json().catch(() => null) as DailyChallenge | { error?: string } | null;

      if (!response.ok || !payload || 'error' in payload) {
        setError((payload as { error?: string } | null)?.error ?? 'Could not load today\'s challenge.');
        return;
      }

      setChallenge(payload as DailyChallenge);
    } catch {
      setError('Could not load today\'s challenge.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  // ── Auto-redirect to home after completing a daily challenge ──
  // Only triggers on the immediate return from the game (URL has ?completed=1).
  // After the URL is stripped in the effect above, this won't re-trigger.
  useEffect(() => {
    if (hasStartedRedirectRef.current) return;
    if (!justCompleted || !challenge?.completed || redirectCountdown !== null) return;

    hasStartedRedirectRef.current = true;
    setRedirectCountdown(3);
  }, [justCompleted, challenge?.completed, redirectCountdown]);

  useEffect(() => {
    if (redirectCountdown === null) return;

    if (redirectCountdown <= 0) {
      window.location.href = '/';
      return;
    }

    redirectTimerRef.current = setInterval(() => {
      setRedirectCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);

    return () => {
      if (redirectTimerRef.current) {
        clearInterval(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [redirectCountdown]);

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <section className="rounded-[2rem] border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50 p-6 shadow-[0_8px_0_rgba(253,230,138,1)] sm:p-8">
            <p className="text-sm font-medium text-slate-500">Loading today's challenge…</p>
          </section>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen px-4 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <section className="rounded-[2rem] border-2 border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6 shadow-[0_8px_0_rgba(254,202,202,1)] sm:p-8">
            <p className="status-pill">Error</p>
            <h1 className="force-dark-black mt-4 text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
              Oops
            </h1>
            <p className="mt-4 text-base font-medium leading-7 text-slate-600">{error}</p>
            <button
              className="mt-6 rounded-2xl border-2 border-rose-700 bg-rose-500 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(190,24,93,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-rose-400 hover:shadow-[0_8px_0_rgba(190,24,93,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(190,24,93,1)]"
              onClick={fetchChallenge}
              type="button"
            >
              Try again
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (!challenge) {
    return null;
  }

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <section className="rounded-[2rem] border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50 p-6 shadow-[0_8px_0_rgba(253,230,138,1)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl space-y-4">
              <p className="status-pill !border-amber-300 !bg-amber-100 !text-amber-800">DAILY CHALLENGE</p>
              <h1 className="force-dark-black text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
                {challenge.gameLabel}
              </h1>
              <p className="max-w-xl text-base font-medium leading-7 text-slate-600">
                {challenge.gameDescription}
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <CalendarDays className="h-4 w-4" />
                <span>{challenge.date}</span>
              </div>
            </div>

            <a
              className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
              href="/"
            >
              Back to Lab
            </a>
          </div>

          <div className="mt-8 space-y-4">
            {challenge.completed ? (
              <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <Trophy className="h-6 w-6 text-emerald-500" />
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-600">Completed</p>
                    <p className="mt-1 text-2xl font-black text-emerald-800">
                      Score: {challenge.userScore ?? '—'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-emerald-700">
                  You already played today's challenge. Each daily challenge is one attempt only — come back tomorrow for a new one!
                </p>
                {justCompleted && redirectCountdown !== null && redirectCountdown > 0 && (
                  <p className="mt-3 text-sm font-semibold text-emerald-600">
                    Redirecting to home page in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}…
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm font-bold leading-6 text-slate-600">
                  One attempt per day. Make it count!
                </p>
                <Link
                  className="inline-block w-full rounded-2xl border-2 border-amber-600 bg-amber-500 px-6 py-4 text-center text-lg font-bold text-white shadow-[0_4px_0_rgba(217,119,6,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-amber-400 hover:shadow-[0_8px_0_rgba(217,119,6,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(217,119,6,1)]"
                  href={`${challenge.gameHref}${challenge.gameHref.includes('?') ? '&' : '?'}daily=true`}
                >
                  Play Today's Challenge
                </Link>
              </>
            )}

            <Link
              className="inline-block w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-center text-sm font-bold text-slate-700 shadow-sm transition-all duration-150 hover:bg-slate-100"
              href="/?leaderboard=daily"
            >
              View Daily Leaderboard on the home page
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function DailyPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen px-4 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <section className="rounded-[2rem] border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50 p-6 shadow-[0_8px_0_rgba(253,230,138,1)] sm:p-8">
            <p className="text-sm font-medium text-slate-500">Loading today's challenge…</p>
          </section>
        </div>
      </main>
    }>
      <DailyPageContent />
    </Suspense>
  );
}
