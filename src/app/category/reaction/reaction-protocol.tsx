'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { BetweenRoundCountdown } from '@/components/between-round-countdown';

type ReactionProtocolProps = {
  initialAttempts: number;
  initialBestScore: number | null;
  isSignedIn: boolean;
};

type Phase = 'idle' | 'waiting' | 'ready' | 'clicked' | 'too-soon' | 'finished';

export function ReactionProtocol({
  initialAttempts,
  initialBestScore,
  isSignedIn,
}: ReactionProtocolProps) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('reaction-time');
  const [phase, setPhase] = useState<Phase>('idle');
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [bestScore, setBestScore] = useState(initialBestScore);
  const [roundTimes, setRoundTimes] = useState<number[]>([]);
  const [isSaving, startSaving] = useTransition();

  const readyAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPendingTimer() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    readyAtRef.current = null;
  }

  useEffect(() => {
    return () => {
      clearPendingTimer();
    };
  }, []);

  function startProtocol() {
    clearPendingTimer();
    setPhase('waiting');
    setReactionMs(null);

    const delay = 2000 + Math.round(Math.random() * 4000);

    timeoutRef.current = setTimeout(() => {
      readyAtRef.current = performance.now();
      setPhase('ready');
    }, delay);
  }

  function saveResult(avgMs: number) {
    if (!isSignedIn) return;

    startSaving(async () => {
      try {
        const response = await fetch('/api/reaction-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reactionMs: avgMs, ...multiplayerMeta }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; score?: number; error?: string }
          | null;

        if (!response.ok || !payload?.ok || typeof payload.score !== 'number') return;

        const savedScore = payload.score;
        setAttempts((current) => current + 1);
        setBestScore((current) => (current === null ? savedScore : Math.max(current, savedScore)));

        if (isMultiplayerSession) {
          goToIntermission();
        }
      } catch {
        // silently fail
      }
    });
  }

  function startNextProtocol() {
    startProtocol();
  }

  function handleArenaClick() {
    if (phase === 'idle' || phase === 'finished') {
      setRoundTimes([]);
      startProtocol();
      return;
    }

    if (phase === 'too-soon') {
      // Retry current round without resetting progress
      startProtocol();
      return;
    }

    if (phase === 'clicked') {
      // In duel mode, wait for countdown; in solo, start immediately
      if (!isMultiplayerSession) {
        startProtocol();
      }
      return;
    }

    if (phase === 'waiting') {
      clearPendingTimer();
      setPhase('too-soon');
      setReactionMs(null);
      return;
    }

    if (phase === 'ready' && readyAtRef.current !== null) {
      const ms = Math.round(performance.now() - readyAtRef.current);
      clearPendingTimer();
      setReactionMs(ms);

      const newTimes = [...roundTimes, ms];
      setRoundTimes(newTimes);

      if (newTimes.length >= 4) {
        const avgMs = Math.round(newTimes.reduce((a, b) => a + b, 0) / 4);
        setPhase('finished');
        saveResult(avgMs);
      } else {
        setPhase('clicked');
      }
    }
  }

  const roundAvg = roundTimes.length > 0
    ? Math.round(roundTimes.reduce((a, b) => a + b, 0) / roundTimes.length)
    : null;

  const arenaTone =
    phase === 'ready'
      ? 'border-emerald-300 bg-emerald-200 text-emerald-900'
      : phase === 'waiting'
        ? 'border-amber-300 bg-amber-100 text-amber-900'
        : phase === 'too-soon'
          ? 'border-rose-300 bg-rose-100 text-rose-900'
          : 'border-cyan-200 bg-cyan-50 text-slate-800';

  const arenaTitle =
    phase === 'ready'
      ? 'CLICK'
      : phase === 'waiting'
        ? 'Wait for signal'
        : phase === 'too-soon'
          ? 'Too soon'
          : phase === 'finished'
            ? `${roundAvg ?? '--'} ms avg`
            : phase === 'clicked'
              ? `${reactionMs ?? '--'} ms`
              : 'Start protocol';

  const arenaSubtitle =
    phase === 'ready'
      ? 'Hit the panel as fast as possible.'
      : phase === 'waiting'
        ? 'Hold steady until the panel changes.'
        : phase === 'too-soon'
          ? 'Click to restart.'
          : phase === 'finished'
            ? 'Round complete — click to start a new round.'
            : phase === 'clicked'
              ? `Round ${roundTimes.length} / 4 — click for next signal.`
              : 'Click the panel to begin.';

  return (
    <section className="lab-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Reaction Category
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">
            Reaction Protocol
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {roundTimes.length > 0 && phase !== 'finished' && (
            <div className="rounded-full border-2 border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-bold text-cyan-700">
              Round {roundTimes.length} / 4
            </div>
          )}
          <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
            {isSignedIn ? 'Leaderboard sync active' : 'Guest mode'}
          </div>
        </div>
      </div>

      <div className="relative">
        <BetweenRoundCountdown
          active={isMultiplayerSession && phase === 'clicked'}
          label={`Round ${roundTimes.length + 1}`}
          onLaunch={startNextProtocol}
        />
        <button
          className={`flex min-h-[18rem] w-full cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 px-4 py-7 text-center transition sm:min-h-[20rem] sm:px-6 sm:py-8 ${arenaTone}`}
          onClick={handleArenaClick}
          type="button"
        >
        <span className="text-4xl font-black tracking-tight sm:text-6xl">{arenaTitle}</span>
        <span className="mt-4 max-w-md text-sm font-bold uppercase tracking-[0.18em] sm:text-base">
          {arenaSubtitle}
        </span>
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Last reaction</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{reactionMs ?? '--'}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Measured in milliseconds.</p>
        </div>
        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Round average</p>
          <p className="mt-2 text-3xl font-black text-slate-800">
            {roundAvg === null ? '--' : `${roundAvg} ms`}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500">Average across 4 signals per round.</p>
        </div>
        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Best lab score</p>
          <p className="mt-2 text-3xl font-black text-slate-800">
            {bestScore ?? '--'}
            {bestScore !== null && (
              <span className="ml-2 text-lg font-bold text-slate-400">({1200 - bestScore} ms)</span>
            )}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500">Higher is better on the leaderboard.</p>
        </div>
        <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Saved attempts</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{attempts}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Only stored for signed-in players.</p>
        </div>
      </div>


    </section>
  );
}