'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { reactionMsToLeaderboardScore } from '@/lib/scoring/reaction';

type Phase = 'idle' | 'waiting' | 'ready' | 'result' | 'too-soon';
type SaveState = 'idle' | 'saving' | 'saved' | 'guest' | 'error';

type ReactionProtocolGameProps = {
  attempts: number;
  bestScore: number | null;
  displayName: string;
  isSignedIn: boolean;
};

export function ReactionProtocolGame({
  attempts: initialAttempts,
  bestScore: initialBestScore,
  displayName,
  isSignedIn,
}: ReactionProtocolGameProps) {
  const router = useRouter();
  const timeoutRef = useRef<number | null>(null);
  const readyAtRef = useRef<number | null>(null);

  const [attempts, setAttempts] = useState(initialAttempts);
  const [bestScore, setBestScore] = useState<number | null>(initialBestScore);
  const [lastReactionMs, setLastReactionMs] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setAttempts(initialAttempts);
  }, [initialAttempts]);

  useEffect(() => {
    setBestScore(initialBestScore);
  }, [initialBestScore]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function clearPendingTimer() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function startTrial() {
    clearPendingTimer();
    readyAtRef.current = null;
    setLastReactionMs(null);
    setSaveState('idle');
    setSaveMessage(null);
    setPhase('waiting');

    const delay = 1200 + Math.floor(Math.random() * 1800);
    timeoutRef.current = window.setTimeout(() => {
      readyAtRef.current = performance.now();
      setPhase('ready');
    }, delay);
  }

  async function saveResult(reactionMs: number) {
    if (!isSignedIn) {
      setSaveState('guest');
      setSaveMessage('This run stays local until you sign in.');
      return;
    }

    setSaveState('saving');
    setSaveMessage('Saving result to your profile...');

    try {
      const response = await fetch('/api/reaction-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reactionMs }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; score?: number }
        | null;

      if (!response.ok || !payload?.score) {
        setSaveState('error');
        setSaveMessage(payload?.error ?? 'Could not save this result.');
        return;
      }

      setSaveState('saved');
      setSaveMessage(`Saved for ${displayName}. Leaderboard score: ${payload.score}.`);
      setBestScore((current) => (current === null ? payload.score ?? null : Math.max(current, payload.score ?? 0)));
      setAttempts((current) => current + 1);
      router.refresh();
    } catch {
      setSaveState('error');
      setSaveMessage('Network error while saving the result.');
    }
  }

  function handleArenaClick() {
    if (phase === 'idle' || phase === 'result' || phase === 'too-soon') {
      startTrial();
      return;
    }

    if (phase === 'waiting') {
      clearPendingTimer();
      setPhase('too-soon');
      setSaveState('idle');
      setSaveMessage('Too early. Wait for the signal before clicking.');
      return;
    }

    if (phase === 'ready' && readyAtRef.current !== null) {
      const reactionMs = Math.round(performance.now() - readyAtRef.current);
      clearPendingTimer();
      readyAtRef.current = null;
      setLastReactionMs(reactionMs);
      setPhase('result');
      void saveResult(reactionMs);
    }
  }

  const localScore = lastReactionMs === null ? null : reactionMsToLeaderboardScore(lastReactionMs);
  const arenaClasses =
    phase === 'ready'
      ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
      : phase === 'waiting'
        ? 'border-amber-300 bg-amber-100 text-amber-900'
        : phase === 'too-soon'
          ? 'border-rose-300 bg-rose-100 text-rose-900'
          : 'border-cyan-200 bg-cyan-50 text-slate-800';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Best Saved Score
          </p>
          <p className="mt-2 text-3xl font-black text-slate-800">{bestScore ?? '--'}</p>
        </div>
        <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Recorded Attempts
          </p>
          <p className="mt-2 text-3xl font-black text-slate-800">{attempts}</p>
        </div>
        <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Last Reaction
          </p>
          <p className="mt-2 text-3xl font-black text-slate-800">
            {lastReactionMs === null ? '--' : `${lastReactionMs} ms`}
          </p>
        </div>
      </div>

      <button
        className={`flex min-h-[22rem] w-full flex-col items-center justify-center rounded-[2rem] border-2 border-b-[8px] px-6 py-10 text-center shadow-[0_6px_0_rgba(226,232,240,1)] transition ${arenaClasses}`}
        onClick={handleArenaClick}
        type="button"
      >
        <div className="max-w-xl space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em]">
            {phase === 'ready'
              ? 'Signal Visible'
              : phase === 'waiting'
                ? 'Stand By'
                : phase === 'too-soon'
                  ? 'Protocol Reset'
                  : phase === 'result'
                    ? 'Result Captured'
                    : 'Reaction Protocol'}
          </p>

          <h2 className="text-4xl font-black tracking-tight sm:text-5xl">
            {phase === 'idle' && 'Click to start'}
            {phase === 'waiting' && 'Wait for the signal'}
            {phase === 'ready' && 'CLICK NOW'}
            {phase === 'too-soon' && 'Too soon'}
            {phase === 'result' && `${lastReactionMs ?? '--'} ms`}
          </h2>

          <p className="text-base font-medium leading-7">
            {phase === 'idle' && 'The panel will change after a random delay. React only when the signal appears.'}
            {phase === 'waiting' && 'Stay focused. Clicking early cancels the run.'}
            {phase === 'ready' && 'Your click will be measured and converted into a leaderboard score.'}
            {phase === 'too-soon' && 'Click again to retry the assessment.'}
            {phase === 'result' &&
              (localScore === null
                ? 'Run completed. Click again to retry.'
                : `Local leaderboard score: ${localScore}. Click again to run another attempt.`)}
          </p>
        </div>
      </button>

      <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
          Save Status
        </p>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
          {saveState === 'idle' &&
            (isSignedIn
              ? 'Signed-in runs save directly into your overall leaderboard score.'
              : 'Guest runs are playable immediately. Sign in to persist them.')}
          {saveState === 'saving' && saveMessage}
          {saveState === 'saved' && saveMessage}
          {saveState === 'guest' && saveMessage}
          {saveState === 'error' && saveMessage}
        </p>
      </div>
    </div>
  );
}