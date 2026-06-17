'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { BetweenRoundCountdown } from '@/components/between-round-countdown';
import { DuelCountdown } from '@/components/duel-countdown';

type MultiReactionProtocolProps = {
  initialAttempts: number;
  initialBestScore: number | null;
  isSignedIn: boolean;
};

type GamePhase = 'idle' | 'waiting' | 'active' | 'too-soon' | 'finished';

const NUM_BUTTONS = 4;
const MIN_ROUND_DELAY_MS = 2000;
const MAX_ROUND_DELAY_MS = 4000;
const MIN_GAP_AFTER_CLICK_MS = 200;

const BUTTON_LABELS = ['A', 'B', 'C', 'D'];

const BUTTON_IDLE_STYLE = [
  'border-rose-200 bg-rose-50 text-rose-400',
  'border-blue-200 bg-blue-50 text-blue-400',
  'border-amber-200 bg-amber-50 text-amber-400',
  'border-emerald-200 bg-emerald-50 text-emerald-400',
];

const BUTTON_ACTIVE_STYLE = [
  'border-rose-400 bg-rose-300 text-rose-900 shadow-[0_0_28px_rgba(244,63,94,0.45)]',
  'border-blue-400 bg-blue-300 text-blue-900 shadow-[0_0_28px_rgba(59,130,246,0.45)]',
  'border-amber-400 bg-amber-300 text-amber-900 shadow-[0_0_28px_rgba(245,158,11,0.45)]',
  'border-emerald-400 bg-emerald-300 text-emerald-900 shadow-[0_0_28px_rgba(16,185,129,0.45)]',
];

export function MultiReactionProtocol({
  initialAttempts,
  initialBestScore,
  isSignedIn,
}: MultiReactionProtocolProps) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('multi-reaction');
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [roundTimes, setRoundTimes] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [bestScore, setBestScore] = useState(initialBestScore);
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
    return () => clearPendingTimer();
  }, []);

  function scheduleNextButton(extraGapMs: number) {
    const delay = extraGapMs + MIN_ROUND_DELAY_MS + Math.round(Math.random() * (MAX_ROUND_DELAY_MS - MIN_ROUND_DELAY_MS));
    timeoutRef.current = setTimeout(() => {
      const btn = Math.floor(Math.random() * NUM_BUTTONS);
      readyAtRef.current = performance.now();
      setActiveButton(btn);
      setGamePhase('active');
    }, delay);
  }

  function startGame() {
    clearPendingTimer();
    setGamePhase('waiting');
    setCurrentRound(0);
    setRoundTimes([]);
    setActiveButton(null);
    scheduleNextButton(0);
  }

  function saveResult(avgMs: number) {
    if (!isSignedIn) return;

    startSaving(async () => {
      try {
        const response = await fetch('/api/reaction-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reactionMs: avgMs, testSlug: 'multi-reaction', ...multiplayerMeta }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; score?: number; error?: string }
          | null;

        if (!response.ok || !payload?.ok || typeof payload.score !== 'number') return;

        const savedScore = payload.score;
        setAttempts((c) => c + 1);
        setBestScore((c) => (c === null ? savedScore : Math.max(c, savedScore)));

        if (isMultiplayerSession) {
          goToIntermission();
        }
      } catch {
        // silently fail
      }
    });
  }

  function handleButtonClick(index: number) {
    if (gamePhase === 'idle' || gamePhase === 'finished') {
      startGame();
      return;
    }

    if (gamePhase === 'too-soon') {
      // Retry current round without resetting progress
      clearPendingTimer();
      setGamePhase('waiting');
      setActiveButton(null);
      scheduleNextButton(0);
      return;
    }

    if (gamePhase === 'waiting') {
      clearPendingTimer();
      setGamePhase('too-soon');
      setActiveButton(null);
      return;
    }

    if (gamePhase === 'active') {
      if (index !== activeButton) {
        // Wrong button — ignore silently
        return;
      }

      const ms = Math.round(performance.now() - (readyAtRef.current ?? performance.now()));
      clearPendingTimer();
      setActiveButton(null);

      const newTimes = [...roundTimes, ms];
      const nextRound = currentRound + 1;
      setRoundTimes(newTimes);
      setCurrentRound(nextRound);

      if (nextRound >= NUM_BUTTONS) {
        const avgMs = Math.round(newTimes.reduce((a, b) => a + b, 0) / newTimes.length);
        setGamePhase('finished');
        saveResult(avgMs);
      } else {
        setGamePhase('waiting');
        scheduleNextButton(MIN_GAP_AFTER_CLICK_MS);
      }
    }
  }

  const lastMs = roundTimes.length > 0 ? roundTimes[roundTimes.length - 1] : null;
  const avgMs =
    roundTimes.length > 0
      ? Math.round(roundTimes.reduce((a, b) => a + b, 0) / roundTimes.length)
      : null;

  const isIdle = gamePhase === 'idle' || gamePhase === 'finished';
  const isTooSoon = gamePhase === 'too-soon';

  return (
    <section className="lab-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Reaction Category</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">
            Multi-Reaction
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isIdle && !isTooSoon && (
            <div className="rounded-full border-2 border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700">
              Round {Math.min(currentRound + 1, NUM_BUTTONS)} / {NUM_BUTTONS}
            </div>
          )}
          <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
            {isSignedIn ? 'Leaderboard sync active' : 'Guest mode'}
          </div>
        </div>
      </div>

      <div className="relative">
        {isMultiplayerSession && gamePhase === 'idle' && (
          <DuelCountdown
            gameSlug="Multi-Reaction"
            isMultiplayer={isMultiplayerSession}
            onLaunch={startGame}
          />
        )}
        <BetweenRoundCountdown
          active={isMultiplayerSession && gamePhase === 'waiting' && currentRound > 0}
          label={`Round ${currentRound + 1}`}
          onLaunch={() => {}}
        />
        <div className={`grid grid-cols-2 gap-4 ${isTooSoon ? 'opacity-60' : ''}`}>
          {BUTTON_LABELS.map((label, i) => {
            const isActive = gamePhase === 'active' && activeButton === i;
            return (
              <button
                key={i}
                className={`flex min-h-[10rem] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 px-4 py-6 text-center transition-all duration-75 sm:min-h-[12rem] ${
                  isActive ? BUTTON_ACTIVE_STYLE[i] : BUTTON_IDLE_STYLE[i]
                }`}
                onClick={() => handleButtonClick(i)}
                type="button"
              >
                <span className="text-5xl font-black tracking-tight sm:text-6xl">{label}</span>
                {isIdle && (
                  <span className="mt-2 text-xs font-bold uppercase tracking-[0.18em] opacity-60">
                    {gamePhase === 'idle' ? 'Click to start' : 'Click to restart'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Last signal</p>
          <p className="mt-2 text-3xl font-black text-slate-800">
            {lastMs !== null ? `${lastMs} ms` : '--'}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500">Most recent reaction in this run.</p>
        </div>
        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Round average</p>
          <p className="mt-2 text-3xl font-black text-slate-800">
            {avgMs !== null ? `${avgMs} ms` : '--'}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500">Average across {NUM_BUTTONS} signals.</p>
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
        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Saved attempts</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{attempts}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Only stored for signed-in players.</p>
        </div>
      </div>

    </section>
  );
}
