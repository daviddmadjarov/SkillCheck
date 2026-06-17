'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { BetweenRoundCountdown } from '@/components/between-round-countdown';

type AudioReactionProtocolProps = {
  initialAttempts: number;
  initialBestScore: number | null;
  isSignedIn: boolean;
};

type Phase = 'idle' | 'waiting' | 'ready' | 'clicked' | 'too-soon' | 'finished';

export function AudioReactionProtocol({ initialAttempts, initialBestScore, isSignedIn }: AudioReactionProtocolProps) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('audio-reaction');
  const [phase, setPhase] = useState<Phase>('idle');
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [bestScore, setBestScore] = useState(initialBestScore);
  const [roundTimes, setRoundTimes] = useState<number[]>([]);
  const [isSaving, startSaving] = useTransition();

  const readyAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  function getAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }

    return audioContextRef.current;
  }

  function playSignal() {
    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 880;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    oscillator.start(now);
    oscillator.stop(now + 0.16);
  }

  function startProtocol() {
    clearPendingTimer();
    setPhase('waiting');
    setReactionMs(null);

    const delay = 2000 + Math.round(Math.random() * 4000);

    timeoutRef.current = setTimeout(() => {
      playSignal();
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
          body: JSON.stringify({ reactionMs: avgMs, testSlug: 'audio-reaction', ...multiplayerMeta }),
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
      startProtocol();
      return;
    }

    if (phase === 'clicked') {
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
    phase === 'too-soon'
      ? 'border-rose-300 bg-rose-100 text-rose-900'
      : phase === 'clicked'
        ? 'border-cyan-300 bg-cyan-100 text-slate-900'
        : 'border-indigo-200 bg-indigo-50 text-slate-800';

  const arenaTitle =
    phase === 'too-soon'
      ? 'Too soon'
      : phase === 'finished'
        ? `${roundAvg ?? '--'} ms avg`
        : phase === 'clicked'
          ? `${reactionMs ?? '--'} ms`
          : phase === 'waiting' || phase === 'ready'
            ? 'Listen'
            : 'Start protocol';

  const arenaSubtitle =
    phase === 'too-soon'
      ? 'Click to restart.'
      : phase === 'finished'
        ? 'Round complete — click to start a new round.'
        : phase === 'clicked'
          ? `Round ${roundTimes.length} / 4 — click for next signal.`
          : phase === 'waiting' || phase === 'ready'
            ? 'Wait for the beep and react as fast as possible.'
            : 'Click the panel to begin.';

  return (
    <section className="lab-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Reaction Category
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">
            Audio Reaction
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {roundTimes.length > 0 && phase !== 'finished' && (
            <div className="rounded-full border-2 border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700">
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
        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Saved attempts</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{attempts}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Only stored for signed-in players.</p>
        </div>
      </div>


    </section>
  );
}
