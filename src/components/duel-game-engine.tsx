'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Universal Duel Game Engine
 *
 * Implements ALL duel lifecycle rules:
 * - 3-2-1-GO countdown on start
 * - Visible 10s timer for input phases
 * - DNF on timeout = 0 points
 * - Auto-advance between rounds
 * - No manual buttons in duel mode
 *
 * Usage in any gamemode:
 *
 *   const engine = useDuelGameEngine({
 *     isDuel: isMultiplayerSession,
 *     totalRounds: 4,
 *     timeLimitSec: 10,  // 0 for untimed games
 *     onStart: () => startRun(),
 *     onNextRound: (roundIndex) => startNextRound(roundIndex),
 *   });
 *
 *   // Render:
 *   {engine.renderOverlay()}  // Shows countdown / timer / result
 *
 *   // Gate input:
 *   if (engine.isActive) { ... allow interaction ... }
 *
 *   // Submit a round:
 *   engine.completeRound(score);
 */

type DuelGamePhase = 'countdown' | 'active' | 'result' | 'transition' | 'done';

export type DuelGameEngineOptions = {
  isDuel: boolean;
  totalRounds: number;
  timeLimitSec: number;
  onStart: () => void;
  onNextRound: (roundIndex: number) => void;
};

export function useDuelGameEngine(opts: DuelGameEngineOptions) {
  const { isDuel, totalRounds, timeLimitSec, onStart, onNextRound } = opts;

  const [phase, setPhase] = useState<DuelGamePhase>('countdown');
  const [displayNumber, setDisplayNumber] = useState<number | null>(isDuel ? 3 : null);
  const [timerSeconds, setTimerSeconds] = useState(timeLimitSec);
  const [currentRound, setCurrentRound] = useState(0);
  const [dnfThisRound, setDnfThisRound] = useState(false);

  const onStartRef = useRef(onStart);
  const onNextRoundRef = useRef(onNextRound);
  const stableOnStart = useCallback(() => onStartRef.current(), []);
  const stableOnNextRound = useCallback((i: number) => onNextRoundRef.current(i), []);

  // GLOBAL: Skip all duel logic in single player
  const skipDuelLogic = useRef(!isDuel);
  if (!isDuel && !skipDuelLogic.current) {
    skipDuelLogic.current = true;
  }

  // === COUNTDOWN PHASE ===
  useEffect(() => {
    if (!isDuel) return;
    if (phase !== 'countdown' || displayNumber === null) return;

    if (displayNumber <= 0) {
      // Show GO for 700ms then activate
      const t = setTimeout(() => {
        setPhase('active');
        setDisplayNumber(null);
        setTimerSeconds(timeLimitSec);
        if (timeLimitSec <= 0) setDnfThisRound(false);
        stableOnStart();
      }, 700);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => setDisplayNumber((n) => (n !== null ? n - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [isDuel, phase, displayNumber, timeLimitSec, stableOnStart]);

  // === ACTIVE TIMER (only when timeLimitSec > 0) ===
  useEffect(() => {
    if (!isDuel || phase !== 'active' || timeLimitSec <= 0) return;

    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setDnfThisRound(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isDuel, phase, timeLimitSec]);

  // === RESULT → TRANSITION ===
  useEffect(() => {
    if (!isDuel || phase !== 'result') return;

    const isLastRound = currentRound + 1 >= totalRounds;
    const delay = timeLimitSec > 0 ? 1500 : 800;

    const t = setTimeout(() => {
      if (isLastRound) {
        setPhase('done');
        return;
      }
      setPhase('transition');
      setDisplayNumber(3);
    }, delay);
    return () => clearTimeout(t);
  }, [isDuel, phase, currentRound, totalRounds, timeLimitSec]);

  // === TRANSITION → NEXT ROUND ===
  useEffect(() => {
    if (!isDuel || phase !== 'transition' || displayNumber === null) return;

    if (displayNumber <= 0) {
      const t = setTimeout(() => {
        setDnfThisRound(false);
        setPhase('active');
        setDisplayNumber(null);
        setTimerSeconds(timeLimitSec);
        const nextRound = currentRound + 1;
        setCurrentRound(nextRound);
        stableOnNextRound(nextRound);
      }, 700);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => setDisplayNumber((n) => (n !== null ? n - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [isDuel, phase, displayNumber, timeLimitSec, currentRound, stableOnNextRound]);

  // === PUBLIC API ===
  const isActive = phase === 'active' && !dnfThisRound && isDuel;

  const completeRound = useCallback((score: number) => {
    if (!isDuel) return;
    if (phase !== 'active' || dnfThisRound) return;
    setTimerSeconds(timeLimitSec);
    setPhase('result');
  }, [isDuel, phase, dnfThisRound, timeLimitSec]);

  const handleDnf = useCallback(() => {
    if (!isDuel || phase !== 'active') return;
    setDnfThisRound(true);
    setTimerSeconds(0);
    setPhase('result');
  }, [isDuel, phase]);

  const countdownValue = phase === 'countdown' ? displayNumber
    : phase === 'transition' ? displayNumber
    : null;

  const showGo = phase === 'countdown' && displayNumber !== null && displayNumber <= 0;

  // === OVERLAY RENDERER ===
  const renderOverlay = useCallback(() => {
    if (!isDuel) return null;
    const gameSlug = '';

    // Countdown initial
    if (phase === 'countdown') {
      return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]">
          {showGo ? (
            <p className="text-7xl font-black tracking-tight text-emerald-600">GO</p>
          ) : (
            <div className="text-center">
              {countdownValue !== null && countdownValue > 0 && (
                <p className="text-8xl font-black tracking-tighter text-slate-800">{countdownValue}</p>
              )}
              {countdownValue === null && (
                <p className="text-lg font-black text-slate-800">Preparing round...</p>
              )}
            </div>
          )}
        </div>
      );
    }

    // Active timer
    if (phase === 'active' && timeLimitSec > 0) {
      return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
          <div className={`rounded-full border-2 px-5 py-2 text-center font-bold text-lg ${
            timerSeconds <= 3
              ? 'border-rose-300 bg-rose-100 text-rose-700 animate-pulse'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}>
            Time: {timerSeconds}s
          </div>
        </div>
      );
    }

    // Transition countdown
    if (phase === 'transition' && displayNumber !== null) {
      const isGo = displayNumber <= 0;
      return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]">
          {isGo ? (
            <p className="text-7xl font-black tracking-tight text-emerald-600">GO</p>
          ) : (
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Round {currentRound + 2}
              </p>
              <p className="text-8xl font-black tracking-tighter text-slate-800">{displayNumber}</p>
            </div>
          )}
        </div>
      );
    }

    // Result
    if (phase === 'result' && dnfThisRound) {
      return (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 px-8 py-4 text-center shadow-lg">
            <p className="text-2xl font-black text-rose-700">DNF</p>
            <p className="text-sm font-semibold text-rose-500">0 points</p>
          </div>
        </div>
      );
    }

    return null;
  }, [isDuel, phase, countdownValue, showGo, displayNumber, timerSeconds, timeLimitSec, dnfThisRound, currentRound]);

  return {
    phase,
    isActive,
    isDuel,
    currentRound,
    dnfThisRound,
    timerSeconds,
    timeLimitSec,
    countdownValue: countdownValue,
    showGo,
    completeRound,
    handleDnf,
    renderOverlay,
  };
}