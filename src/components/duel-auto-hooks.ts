'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook that auto-starts a run when the game is in duel mode and idle.
 * Returns the auto-start state so components can skip manual "Start" buttons.
 *
 * Usage:
 *   const shouldAutoStart = useDuelAutoStart(isMultiplayerSession, isIdle, startRun);
 */
export function useDuelAutoStart(
  isMultiplayer: boolean,
  isIdle: boolean,
  onStart: () => void,
) {
  const startedRef = useRef(false);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  useEffect(() => {
    if (!isMultiplayer || !isIdle || startedRef.current) return;

    // Re-check after a frame to ensure game is loaded
    const frame = requestAnimationFrame(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      onStartRef.current();
    });

    return () => cancelAnimationFrame(frame);
  }, [isMultiplayer, isIdle]);

  const reset = useCallback(() => {
    startedRef.current = false;
  }, []);

  return {
    /** Call when starting a new run to allow future auto-starts */
    resetAutoStart: reset,
    /** Whether the duel mode auto-start is active (hide manual start buttons) */
    shouldAutoStart: isMultiplayer && isIdle,
  };
}

/**
 * Hook that auto-advances to the next round in multi-round games.
 * Shows the result briefly, then calls onAdvance after a delay.
 *
 * Usage:
 *   useDuelAutoAdvance(
 *     isMultiplayerSession,
 *     showResult,        // boolean: are we showing a result?
 *     !sessionFinished,  // boolean: more rounds remaining?
 *     advanceRound,      // function to go to next round
 *     { delayMs: 2000 }  // optional: how long to show results
 *   );
 */
export function useDuelAutoAdvance(
  isMultiplayer: boolean,
  showResult: boolean,
  hasMoreRounds: boolean,
  onAdvance: () => void,
  options?: { delayMs?: number },
) {
  const { delayMs = 1500 } = options ?? {};
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;

  useEffect(() => {
    if (!isMultiplayer || !showResult || !hasMoreRounds) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      onAdvanceRef.current();
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isMultiplayer, showResult, hasMoreRounds, delayMs]);
}