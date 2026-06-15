'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, Timer, Users } from 'lucide-react';

import { MULTIPLAYER_GAME_POOL } from '@/lib/multiplayer/catalog';

export default function DuelPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isQueued, setIsQueued] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queueCount, setQueueCount] = useState<number>(0);

  async function handleStartDuel() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/multiplayer/duel', { method: 'POST' });
      const payload = (await response.json().catch(() => null)) as { error?: string; status?: string; url?: string; queueCount?: number } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Could not start a duel right now.');
        return;
      }

      if (payload?.url) {
        router.push(payload.url);
        return;
      }

      if (payload?.status === 'waiting') {
        setIsQueued(true);
        if (typeof payload.queueCount === 'number') {
          setQueueCount(payload.queueCount);
        }
      }
    } catch {
      setError('Could not start a duel right now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelQueue() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/multiplayer/duel', { method: 'DELETE' });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Could not cancel queue.');
        return;
      }

      setIsQueued(false);
    } catch {
      setError('Could not cancel queue.');
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!isQueued) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch('/api/multiplayer/duel', { method: 'GET' });
        const payload = (await response.json().catch(() => null)) as { status?: string; url?: string; queueCount?: number } | null;

        if (!response.ok) {
          return;
        }

        if (payload?.status === 'matched' && payload.url) {
          router.push(payload.url);
        }
        if (typeof payload?.queueCount === 'number') {
          setQueueCount(payload.queueCount);
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isQueued, router]);

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-[2rem] border-2 border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6 shadow-[0_8px_0_rgba(254,202,202,1)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl space-y-4">
              <p className="status-pill">DUEL</p>
              <h1 className="force-dark-black text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
                Queue a head-to-head lobby.
              </h1>
              <p className="max-w-xl text-base font-medium leading-7 text-slate-600">
                Enter the duel queue and get matched against a random player currently waiting for a 1v1 match.
              </p>
            </div>

            <a
              className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
              href="/"
            >
              Return to Lab
            </a>

            <div className="grid w-full gap-3 sm:min-w-[16rem] sm:w-auto">
              <div className="rounded-[1.4rem] border-2 border-white bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <Swords className="h-4 w-4 text-rose-500" />
                  <span className="text-sm font-bold">Match format</span>
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Best of a compact mixed skill set.</p>
              </div>
              <div className="rounded-[1.4rem] border-2 border-white bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <Users className="h-4 w-4 text-cyan-500" />
                  <span className="text-sm font-bold">Players</span>
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">2 competitors in a single duel lobby.</p>
              </div>
              <div className="rounded-[1.4rem] border-2 border-white bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <Timer className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-bold">Flow</span>
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Queue, auto-match, and jump straight into the duel lobby.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              className="w-full rounded-2xl border-2 border-rose-700 bg-rose-500 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(190,24,93,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-rose-400 hover:shadow-[0_8px_0_rgba(190,24,93,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(190,24,93,1)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              disabled={isSubmitting}
              onClick={isQueued ? handleCancelQueue : handleStartDuel}
              type="button"
            >
              {isSubmitting ? (isQueued ? 'Cancelling…' : 'Queueing…') : isQueued ? 'Cancel Queue' : 'Queue Duel'}
            </button>
            <a className="lab-button-secondary w-full text-center sm:w-auto" href="/party/create">
              Create Party instead
            </a>
          </div>

          {isQueued ? (
            <p className="mt-4 rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-700">
              {queueCount > 1
                ? `Looking for a random opponent — ${queueCount - 1} other player${queueCount - 1 === 1 ? '' : 's'} currently in queue...`
                : queueCount === 1
                  ? 'Looking for a random opponent in queue...'
                  : 'Waiting for other players to join the queue...'}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MULTIPLAYER_GAME_POOL.slice(0, 4).map((game) => (
            <div key={game.slug} className="rounded-[1.5rem] border-2 border-slate-200 bg-white p-4 shadow-[0_6px_0_rgba(226,232,240,1)]">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{game.category}</p>
              <h2 className="mt-2 text-lg font-black text-slate-800">{game.label}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{game.description}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
