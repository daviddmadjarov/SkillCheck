'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * DNF scoring: worst possible performance value per gamemode type.
 */
const DNF_TIMED_MS = 99999;  // For timed games: max time + penalty
const DNF_PRECISION_PCT = 0; // For precision games: 0% accuracy
const DNF_SCORE = 0;         // For scored games: 0 out of 1000

export type DuelPhase = 'countdown' | 'active' | 'result' | 'transition';

export type DuelLifecycleOptions = {
  /** Whether this is a duel session */
  isDuel: boolean;
  /** Total rounds (0 for single-round games like typing/cps) */
  totalRounds?: number;
  /** Time limit in seconds for the input phase (0 = no limit) */
  timeLimitSec?: number;
  /** Called to start/focus the game when countdown completes */
  onActivate?: () => void;
  /** Called when time runs out without input */
  onDNF?: () => number; // Must return DNF score
  /** Called to submit the current result */
  onSubmitResult?: (score: number) => void;
  /** Called to start the next round */
  onNextRound?: () => void;
};

export type DuelLifecycleState = {
  phase: DuelPhase;
  countdownValue: number | null;
  timeRemaining: number;
  currentRound: number;
  roundScores: number[];
  isInputEnabled: boolean;
  dnfTriggered: boolean;
};

export function useDuelLifecycle(opts: DuelLifecycleOptions) {
  const {
    isDuel,
    totalRounds = 4,
    timeLimitSec = 0,
    onActivate,
    onDNF,
    onSubmitResult,
    onNextRound,
  } = opts;

  const [phase, setPhase] = useState<DuelPhase>('countdown');
  const [countdownValue, setCountdownValue] = useState<number | null>(isDuel ? 3 : null);
  const [timeRemaining, setTimeRemaining] = useState(timeLimitSec);
  const [currentRound, setCurrentRound] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [isInputEnabled, setIsInputEnabled] = useState(false);
  const [dnfTriggered, setDnfTriggered] = useState(false);

  const activeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  // Phase 1: Countdown (duel only)
  useEffect(() => {
    if (!isDuel) {
      // Non-duel: skip to active immediately
      setPhase('active');
      setIsInputEnabled(true);
      setCountdownValue(null);
      if (onActivate) onActivate();
      return;
    }

    if (phase !== 'countdown' || countdownValue === null) return;

    if (countdownValue <= 0) {
      // GO phase — 0.6s then activate
      countdownTimerRef.current = setTimeout(() => {
        setPhase('active');
        setIsInputEnabled(true);
        setCountdownValue(null);
        if (timeLimitSec > 0) setTimeRemaining(timeLimitSec);
        if (onActivate) onActivate();
      }, 600);
      return () => { if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current); };
    }

    countdownTimerRef.current = setTimeout(() => {
      setCountdownValue((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => { if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current); };
  }, [isDuel, phase, countdownValue, onActivate, timeLimitSec]);

  // Phase 2: Active play timer (only when timeLimitSec > 0)
  useEffect(() => {
    if (phase !== 'active' || timeLimitSec <= 0 || !isDuel) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Timeout – trigger DNF
          setDnfTriggered(true);
          setIsInputEnabled(false);
          const dnfScore = onDNF ? onDNF() : 0;
          const newScores = [...roundScores, dnfScore];
          setRoundScores(newScores);
          setPhase('result');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, timeLimitSec, isDuel, onDNF, roundScores]);

  // Submit a round result (called from game components)
  const submitRound = useCallback((score: number) => {
    if (phase !== 'active' || dnfTriggered) return;
    setIsInputEnabled(false);
    if (activeTimerRef.current) clearTimeout(activeTimerRef.current);
    const newScores = [...roundScores, score];
    setRoundScores(newScores);
    setPhase('result');
    if (onSubmitResult) onSubmitResult(score);
  }, [phase, dnfTriggered, roundScores, onSubmitResult]);

  // Phase 3→4: Result → transition
  useEffect(() => {
    if (phase !== 'result') return;

    const isLastRound = currentRound + 1 >= totalRounds;
    const delay = isLastRound ? 2000 : 1500;

    resultTimerRef.current = setTimeout(() => {
      if (isLastRound) {
        // Duel complete - no further action (intermission will handle)
        return;
      }
      // Phase 4: Transition with countdown
      setPhase('transition');
      setCountdownValue(3);
    }, delay);

    return () => { if (resultTimerRef.current) clearTimeout(resultTimerRef.current); };
  }, [phase, currentRound, totalRounds]);

  // Phase 4→5: Transition countdown → next round
  useEffect(() => {
    if (phase !== 'transition' || countdownValue === null || !isDuel) return;

    if (countdownValue <= 0) {
      countdownTimerRef.current = setTimeout(() => {
        setDnfTriggered(false);
        setPhase('active');
        setIsInputEnabled(true);
        setCountdownValue(null);
        setCurrentRound((r) => r + 1);
        if (timeLimitSec > 0) setTimeRemaining(timeLimitSec);
        if (onNextRound) onNextRound();
      }, 600);
      return () => { if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current); };
    }

    countdownTimerRef.current = setTimeout(() => {
      setCountdownValue((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => { if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current); };
  }, [phase, countdownValue, isDuel, timeLimitSec, onNextRound]);

  // Display helpers
  const countdownDisplay = phase === 'countdown' ? countdownValue :
    phase === 'transition' ? countdownValue : null;

  const showGo = phase === 'countdown' && countdownValue !== null && countdownValue <= 0;

  return {
    phase,
    countdownDisplay,
    showGo,
    timeRemaining,
    currentRound,
    roundScores,
    isInputEnabled,
    dnfTriggered,
    submitRound,
  };
}