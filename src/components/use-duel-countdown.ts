'use client';

import { useEffect, useRef, useState } from 'react';
import { playCountdownTick, playCountdownGo } from '@/lib/audio/sounds';

export type CountdownState = {
  active: boolean;       // true during countdown
  value: number | null;  // 3, 2, 1, null during GO
  phase: 'counting' | 'go' | null; // null when not active
  launched: boolean;     // true when countdown completed, game should start
};

/**
 * Reliable hook-based duel countdown: 3→2→1→GO→launch.
 * Uses setTimeout chains outside of useEffect to avoid React lifecycle issues.
 *
 * Usage in ANY gamemode:
 *   const cd = useDuelCountdown(isMultiplayerSession);
 *   // When cd.launched becomes true, start the game:
 *   useEffect(() => { if (cd.launched) setRunning(true); }, [cd.launched]);
 *   // Render the overlay:
 *   if (cd.active) { ... render 3-2-1-GO overlay from cd.value / cd.phase ... }
 */
export function useDuelCountdown(isMultiplayer: boolean) {
  const [value, setValue] = useState<number | null>(isMultiplayer ? 3 : null);
  const [phase, setPhase] = useState<'counting' | 'go' | null>(isMultiplayer ? 'counting' : null);
  const [launched, setLaunched] = useState(false);
  const launchedOnce = useRef(false);

  useEffect(() => {
    if (!isMultiplayer) return;
    if (launchedOnce.current) return;

    let cancelled = false;
    const steps = [3, 2, 1] as const;

    async function run() {
      for (const n of steps) {
        await delay(1000);
        if (cancelled) return;
        setValue(n);
        setPhase('counting');
        playCountdownTick();
      }
      await delay(200);
      if (cancelled) return;
      setValue(null);
      setPhase('go');
      playCountdownGo();
      await delay(600);
      if (cancelled) return;
      setPhase(null);
      setLaunched(true);
      launchedOnce.current = true;
    }

    run();
    return () => { cancelled = true; };
  }, [isMultiplayer]);

  return {
    active: phase !== null && !launched,
    value,
    phase,
    launched,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}