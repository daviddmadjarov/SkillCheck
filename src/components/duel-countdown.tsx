'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

type DuelCountdownProps = {
  /** Children to show while the countdown is active and after launch */
  children: ReactNode;
  /** Called when the countdown reaches 0 and the game should start */
  onLaunch: () => void;
  /** Whether this is a duel/multiplayer context */
  isMultiplayer: boolean;
  /** Optional: game mode slug for display */
  gameSlug?: string;
};

/**
 * Displays a 3-2-1-GO countdown overlay in duel mode, then calls onLaunch.
 * In single-player mode, children render immediately with no countdown.
 *
 * Usage:
 *   <DuelCountdown onLaunch={startGame} isMultiplayer={isDuel}>
 *     <YourGameContent />
 *   </DuelCountdown>
 */
export function DuelCountdown({ children, onLaunch, isMultiplayer, gameSlug }: DuelCountdownProps) {
  const [count, setCount] = useState<number | null>(null);
  const [phase, setPhase] = useState<'idle' | 'counting' | 'go' | 'launched'>('idle');
  const launchedRef = useRef(false);

  const startCountdown = useCallback(() => {
    if (launchedRef.current) return;
    setCount(3);
    setPhase('counting');
  }, []);

  useEffect(() => {
    // In single player mode, launch immediately
    if (!isMultiplayer) {
      if (!launchedRef.current) {
        launchedRef.current = true;
        setPhase('launched');
        onLaunch();
      }
      return;
    }

    // In multiplayer mode, auto-start after a short delay
    const timeoutId = setTimeout(startCountdown, 800);
    return () => clearTimeout(timeoutId);
  }, [isMultiplayer, onLaunch, startCountdown]);

  // Countdown ticker
  useEffect(() => {
    if (phase !== 'counting' || count === null) return;

    if (count <= 1) {
      // Show GO for 0.8s then launch
      setPhase('go');
      const timeoutId = setTimeout(() => {
        if (!launchedRef.current) {
          launchedRef.current = true;
          setPhase('launched');
          onLaunch();
        }
      }, 800);
      return () => clearTimeout(timeoutId);
    }

    const intervalId = setTimeout(() => {
      setCount((c) => (c !== null ? c - 1 : null));
    }, 1000);

    return () => clearTimeout(intervalId);
  }, [phase, count, onLaunch]);

  // Show children dimmed behind the overlay during countdown
  if (phase === 'launched') {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Dimmed game content behind countdown */}
      <div className="opacity-30 pointer-events-none select-none" aria-hidden>
        {children}
      </div>

      {/* Countdown overlay */}
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-[2rem] bg-white/70 backdrop-blur-sm">
        {phase === 'idle' && (
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              {gameSlug ?? 'Duel Round'}
            </p>
            <p className="mt-2 text-lg font-black text-slate-800 sm:text-xl">Preparing round...</p>
          </div>
        )}

        {phase === 'counting' && count !== null && (
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              Round starts in
            </p>
            <p className="mt-2 text-7xl font-black tracking-tighter text-slate-800 sm:text-8xl">
              {count}
            </p>
          </div>
        )}

        {phase === 'go' && (
          <div className="text-center">
            <p className="text-6xl font-black tracking-tight text-emerald-600 sm:text-7xl">
              GO
            </p>
          </div>
        )}
      </div>
    </div>
  );
}