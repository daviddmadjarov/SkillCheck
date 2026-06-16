'use client';

import { useEffect, useRef, useState } from 'react';

type ResponseTimerProps = {
  /** Total seconds the player has to respond */
  durationSeconds?: number;
  /** Called when time runs out with no submission */
  onTimeout: () => void;
  /** Whether the timer is active (e.g., during an input phase) */
  active: boolean;
  /** Label for the timer display */
  label?: string;
};

/**
 * Displays a visible countdown timer during input phases.
 * When time expires, calls onTimeout to auto-submit/advance.
 * Used for games like Reaction Time, Sync Test, etc. where
 * the player must provide input within a time limit.
 */
export function ResponseTimer({
  durationSeconds = 10,
  onTimeout,
  active,
  label = 'Time remaining',
}: ResponseTimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!active) {
      // Reset when inactive
      setRemaining(durationSeconds);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Start countdown
    setRemaining(durationSeconds);

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    timeoutRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, durationSeconds * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [active, durationSeconds]);

  if (!active) {
    return null;
  }

  const isUrgent = remaining <= 3;

  return (
    <div
      className={`rounded-full border-2 px-4 py-2 text-center text-sm font-bold ${
        isUrgent
          ? 'border-rose-300 bg-rose-100 text-rose-700 animate-pulse'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      {label}: {remaining}s
    </div>
  );
}