'use client';

import { useEffect, useState, useRef } from 'react';

type BetweenRoundCountdownProps = {
  /** When true, shows the countdown overlay and starts the sequence */
  active: boolean;
  /** Called after GO phase (when countdown reaches 0) */
  onLaunch: () => void;
  /** Optional label like "Round 3" */
  label?: string;
};

/**
 * Shows a 3-2-1-GO countdown between rounds in multi-round duel games.
 * After "GO" displays for 600ms, calls onLaunch to start the next round.
 *
 * Usage:
 *   <BetweenRoundCountdown
 *     active={phase === 'clicked'}
 *     onLaunch={startNextProtocol}
 *     label={`Round ${roundTimes.length + 1}`}
 *   />
 */
export function BetweenRoundCountdown({ active, onLaunch, label }: BetweenRoundCountdownProps) {
  const [count, setCount] = useState<number | null>(null);
  const [phaseState, setPhaseState] = useState<'idle' | 'counting' | 'go'>('idle');
  const launchedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setCount(null);
      setPhaseState('idle');
      launchedRef.current = false;
      return;
    }

    // Reset state for a new countdown cycle
    setCount(3);
    setPhaseState('counting');
    launchedRef.current = false;
  }, [active]);

  // Countdown ticker
  useEffect(() => {
    if (phaseState !== 'counting' || count === null) return;

    if (count <= 1) {
      setPhaseState('go');
      const timeoutId = setTimeout(() => {
        if (!launchedRef.current) {
          launchedRef.current = true;
          onLaunch();
        }
      }, 600);
      return () => clearTimeout(timeoutId);
    }

    const timeoutId = setTimeout(() => {
      setCount((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [phaseState, count, onLaunch]);

  if (!active || phaseState === 'idle') return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[2rem] bg-white/75 backdrop-blur-sm">
      {phaseState === 'counting' && count !== null && (
        <div className="text-center">
          {label && (
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
          )}
          <p className="mt-2 text-7xl font-black tracking-tighter text-slate-800 sm:text-8xl">
            {count}
          </p>
        </div>
      )}

      {phaseState === 'go' && (
        <div className="text-center">
          <p className="text-6xl font-black tracking-tight text-emerald-600 sm:text-7xl">GO</p>
        </div>
      )}
    </div>
  );
}