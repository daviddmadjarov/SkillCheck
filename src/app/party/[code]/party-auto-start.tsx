'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type PartyAutoStartProps = {
  /** The URL to redirect to when the session goes live */
  nextGameHref: string | null;
  /** Whether the current player has joined the lobby */
  isJoined: boolean;
  /** The lobby code */
  lobbyCode: string;
  /** The initial lobby status (to detect transitions) */
  initialStatus: string;
};

/**
 * Mounted for every joined player in a party lobby.
 * Polls lobby status every 2 seconds. When status transitions from
 * 'waiting'/'lobby' to 'live', automatically redirects to the first game URL.
 *
 * Only redirects on status transition — if the lobby was already live when
 * the page loaded, the player simply sees the manual "Start Session" link.
 */
export function PartyAutoStart({ nextGameHref, isJoined, lobbyCode, initialStatus }: PartyAutoStartProps) {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const wasLiveRef = useRef(initialStatus === 'live');

  useEffect(() => {
    if (!isJoined || !nextGameHref) return;

    redirectedRef.current = false;
    wasLiveRef.current = initialStatus === 'live';

    const intervalId = window.setInterval(async () => {
      if (redirectedRef.current) return;

      try {
        const response = await fetch(
          `/api/multiplayer/lobby-status?lobby=${encodeURIComponent(lobbyCode)}`,
          { cache: 'no-store' },
        );

        if (!response.ok) return;

        const payload = (await response.json().catch(() => null)) as {
          status?: string;
        } | null;

        if (!payload) return;

        // Detect transition: was NOT live, now IS live
        if (!wasLiveRef.current && payload.status === 'live') {
          redirectedRef.current = true;
          window.clearInterval(intervalId);
          router.push(nextGameHref);
          return;
        }

        // Update our tracking ref
        if (payload.status === 'live') {
          wasLiveRef.current = true;
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isJoined, nextGameHref, lobbyCode, router, initialStatus]);

  return null;
}