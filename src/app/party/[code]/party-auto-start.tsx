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
};

/**
 * Mounted for every joined player in a party lobby.
 * Polls lobby status every 2 seconds. When status becomes 'live',
 * automatically redirects to the first game URL.
 *
 * If the lobby was already live when the page loaded, the player simply
 * sees the manual "Start Session" link (no auto-redirect on first render).
 */
export function PartyAutoStart({ nextGameHref, isJoined, lobbyCode }: PartyAutoStartProps) {
  const router = useRouter();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!isJoined || !nextGameHref) return;

    redirectedRef.current = false;

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

        // When lobby status becomes 'live', auto-redirect to the next game
        if (payload.status === 'live') {
          redirectedRef.current = true;
          window.clearInterval(intervalId);
          void router.push(nextGameHref);
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isJoined, nextGameHref, lobbyCode, router]);

  return null;
}