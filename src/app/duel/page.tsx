'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, Timer, Users } from 'lucide-react';

import { MULTIPLAYER_GAME_POOL } from '@/lib/multiplayer/catalog';

type DuelState = 'idle' | 'waiting' | 'matched';

export default function DuelPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DuelState>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [playingCount, setPlayingCount] = useState<number>(0);
  const [opponentName, setOpponentName] = useState<string | null>(null);

  async function handleQueue() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/multiplayer/duel', { method: 'POST' });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        status?: string;
        url?: string;
        lobbyCode?: string;
        opponentName?: string;
        queueCount?: number;
        playingCount?: number;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Could not start a duel right now.');
        setIsSubmitting(false);
        return;
      }

      if (payload?.status === 'matched' && payload.url) {
        setState('matched');
        if (payload.opponentName) setOpponentName(payload.opponentName);
        router.push(payload.url);
        return;
      }

      if (payload?.status === 'waiting') {
        setState('waiting');
        setIsSubmitting(false);
      }
    } catch {
      setError('Could not start a duel right now.');
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/multiplayer/duel', { method: 'DELETE' });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        queueCount?: number;
        playingCount?: number;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Could not cancel queue.');
        setIsSubmitting(false);
        return;
      }

      if (typeof payload?.queueCount === 'number') setQueueCount(payload.queueCount);
      if (typeof payload?.playingCount === 'number') setPlayingCount(payload.playingCount);

      setState('idle');
      setIsSubmitting(false);
    } catch {
      setError('Could not cancel queue.');
      setIsSubmitting(false);
    }
  }

  // ── Polling loop when waiting ──
  const poll = useCallback(async () => {
    try {
      const response = await fetch('/api/multiplayer/duel', { method: 'GET' });
      const payload = (await response.json().catch(() => null)) as {
        status?: string;
        url?: string;
        lobbyCode?: string;
        opponentName?: string;
        queueCount?: number;
        playingCount?: number;
      } | null;

      if (!response.ok) return;

      if (typeof payload?.queueCount === 'number') setQueueCount(payload.queueCount);
      if (typeof payload?.playingCount === 'number') setPlayingCount(payload.playingCount);

      if (payload?.status === 'matched' && payload.url) {
        setState('matched');
        if (payload.opponentName) setOpponentName(payload.opponentName);
        router.push(payload.url);
        return;
      }

      if (payload?.status === 'cancelled') {
        setState('idle');
      }
    } catch {
      // keep polling
    }
  }, [router]);

  useEffect(() => {
    if (state !== 'waiting') return;

    // Immediate first fetch for stats
    poll();

    const intervalId = window.setInterval(poll, 2000);
    return () => window.clearInterval(intervalId);
  }, [state, poll]);

  // ── Auto-cancel queue on navigational leave ──
  // Cancel the queue entry if the user navigates away or closes the tab while queued.
  // Uses keepalive: true so the request completes even during page unload.
  useEffect(() => {
    if (state !== 'waiting') return;

    function cancelOnLeave() {
      fetch('/api/multiplayer/duel', { method: 'DELETE', keepalive: true }).catch(() => {});
    }

    window.addEventListener('beforeunload', cancelOnLeave);

    return () => {
      window.removeEventListener('beforeunload', cancelOnLeave);
      cancelOnLeave();
    };
  }, [state]);

  // ── Background stats polling ──
  // Polls stats every 5 s when NOT queued (the waiting-poller at 2 s handles it when queued).
  // This keeps queueCount / playingCount fresh for all viewers, even those not in queue.
  useEffect(() => {
    if (state === 'waiting') return;

    async function fetchStats() {
      try {
        const response = await fetch('/api/multiplayer/duel', { method: 'GET' });
        const payload = (await response.json().catch(() => null)) as {
          queueCount?: number;
          playingCount?: number;
          status?: string;
        } | null;
        if (!response.ok) return;
        if (typeof payload?.queueCount === 'number') setQueueCount(payload.queueCount);
        if (typeof payload?.playingCount === 'number') setPlayingCount(payload.playingCount);
      } catch {
        // ignore
      }
    }

    fetchStats();

    const intervalId = window.setInterval(fetchStats, 5000);
    return () => window.clearInterval(intervalId);
  }, [state]);

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

            <button
              data-return-to-lab
              className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
              onClick={() => {
                if (state === 'waiting') {
                  fetch('/api/multiplayer/duel', { method: 'DELETE' })
                    .then(r => r.json().catch(() => null))
                    .then(payload => {
                      if (payload && typeof payload.queueCount === 'number') setQueueCount(payload.queueCount);
                      if (payload && typeof payload.playingCount === 'number') setPlayingCount(payload.playingCount);
                    })
                    .catch(() => {})
                    .finally(() => { router.push('/'); });
                } else {
                  router.push('/');
                }
              }}
              type="button"
            >
              Return to Lab
            </button>

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
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Queue, auto-match, and jump straight into the duel.</p>
              </div>
            </div>
          </div>

          {/* ── Live queue stats ── */}
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-bold text-cyan-700">
              <Users className="h-4 w-4" />
              <span>{queueCount} {queueCount === 1 ? 'player' : 'players'} searching</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border-2 border-purple-200 bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
              <Swords className="h-4 w-4" />
              <span>{playingCount} {playingCount === 1 ? 'player' : 'players'} currently in duels</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              className="w-full rounded-2xl border-2 border-rose-700 bg-rose-500 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(190,24,93,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-rose-400 hover:shadow-[0_8px_0_rgba(190,24,93,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(190,24,93,1)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              disabled={isSubmitting || state === 'matched'}
              onClick={state === 'waiting' ? handleCancel : handleQueue}
              type="button"
            >
              {isSubmitting
                ? (state === 'waiting' ? 'Cancelling…' : 'Queueing…')
                : state === 'waiting'
                  ? 'Cancel Queue'
                  : 'Queue Duel'}
            </button>
            <a className="lab-button-secondary w-full text-center sm:w-auto" href="/party/create">
              Create Party instead
            </a>
          </div>

          {state === 'waiting' ? (
            <p className="mt-4 rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-700">
              Looking for an opponent —
              {queueCount > 1
                ? ` ${queueCount - 1} other player${queueCount - 1 === 1 ? '' : 's'} also waiting in queue...`
                : ' waiting for another player to join...'}
            </p>
          ) : null}

          {state === 'matched' ? (
            <p className="mt-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Match found{opponentName ? ` against ${opponentName}` : ''}! Redirecting to the duel…
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