'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Reads the Supabase user metadata to determine if the "Staff Access"
 * override has been triggered.  When anomalous_access is true, the hook
 * intermittently swaps display text to the lore variant and applies a
 * CSS glitch class for a brief duration.
 *
 * The metadata read piggybacks on the existing Supabase client auth state
 * so it introduces zero additional network requests once the user is signed in.
 *
 * @param originalText  The normal label (e.g. "Reaction Protocol")
 * @param loreText      The clinical Aethelgard variant (e.g. "Neural Latency Probe")
 * @param options       Optional tuning for glitch frequency / duration
 */

type GlitchOptions = {
  /** Probability (0-1) of glitch when hovering.  Default 0.08 (8%) */
  hoverChance?: number;
  /** Min glitch duration in ms.  Default 300 */
  minDuration?: number;
  /** Max glitch duration in ms.  Default 1200 */
  maxDuration?: number;
  /** Min pause between glitches in ms.  Default 6000 */
  minPause?: number;
  /** Max pause between glitches in ms.  Default 20000 */
  maxPause?: number;
};

export function useLoreGlitch(
  originalText: string,
  loreText: string,
  options?: GlitchOptions,
) {
  const {
    hoverChance = 0.08,
    minDuration = 300,
    maxDuration = 1200,
    minPause = 6000,
    maxPause = 20000,
  } = options ?? {};

  const [displayText, setDisplayText] = useState(originalText);
  const [isGlitching, setIsGlitching] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const hoveredRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detect anomalous_access from Supabase metadata via the session
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Dynamic import so this hook doesn't break non-Supabase environments
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const metadata = (data.session?.user?.user_metadata ?? {}) as Record<string, unknown>;
        setHasAccess(metadata.anomalous_access === true || metadata.anomalous_access === 'true');
      } catch {
        // Silent — Supabase may not be configured
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Periodic random glitch when anomalous_access is active
  useEffect(() => {
    if (!hasAccess) return;

    const scheduleNext = () => {
      const pause = minPause + Math.random() * (maxPause - minPause);
      intervalRef.current = setTimeout(() => {
        // Only glitch if not currently hovered (hover has its own trigger)
        if (!hoveredRef.current) {
          triggerGlitch();
        }
        scheduleNext();
      }, pause);
    };

    const triggerGlitch = () => {
      setIsGlitching(true);
      setDisplayText(loreText);
      const duration = minDuration + Math.random() * (maxDuration - minDuration);
      setTimeout(() => {
        setDisplayText(originalText);
        setIsGlitching(false);
      }, duration);
    };

    scheduleNext();

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [hasAccess, originalText, loreText, minDuration, maxDuration, minPause, maxPause]);

  const onMouseEnter = useCallback(() => {
    hoveredRef.current = true;
    if (!hasAccess) return;
    if (Math.random() < hoverChance) {
      setIsGlitching(true);
      setDisplayText(loreText);
      const duration = minDuration + Math.random() * (maxDuration - minDuration);
      setTimeout(() => {
        setDisplayText(originalText);
        setIsGlitching(false);
      }, duration);
    }
  }, [hasAccess, hoverChance, loreText, originalText, minDuration, maxDuration]);

  const onMouseLeave = useCallback(() => {
    hoveredRef.current = false;
  }, []);

  return { displayText, isGlitching, hasAccess, onMouseEnter, onMouseLeave };
}