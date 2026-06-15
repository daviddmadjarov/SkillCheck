'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * This component mounts inside game pages during multiplayer sessions.
 * It polls session-status to detect when the round has advanced on the server
 * (meaning the opponent finished or the timer ran out), and automatically
 * redirects to the intermission/scoreboard.
 *
 * Without this, an idle player who never submits a score would stay stuck
 * on the game page forever while the other player advances.
 */
export function MultiplayerSessionGuard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const lobbyCode = searchParams.get('lobby');
  const playerId = searchParams.get('player');
  const gameSlug = searchParams.get('game');
  const roundRaw = searchParams.get('round');
  const parsedRound = Number(roundRaw);
  const round = Number.isFinite(parsedRound) && parsedRound >= 0 ? Math.floor(parsedRound) : 0;

  const isMultiplayer = Boolean(lobbyCode && playerId && gameSlug);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!isMultiplayer || !lobbyCode) return;

    mountedRef.current = true;

    const intervalId = window.setInterval(async () => {
      if (!mountedRef.current) return;

      try {
        const response = await fetch(
          `/api/multiplayer/session-status?lobby=${encodeURIComponent(lobbyCode)}&round=${round}`,
          { cache: 'no-store' },
        );
        if (!response.ok) return;

        const payload = (await response.json().catch(() => null)) as {
          readyToAdvance?: boolean;
        } | null;

        if (!payload) return;

        // If the server says we should advance to the next round,
        // redirect to intermission so the player sees the scoreboard
        if (payload.readyToAdvance && lobbyCode && playerId && gameSlug) {
          const params = new URLSearchParams();
          params.set('game', gameSlug);
          params.set('player', playerId);
          params.set('round', String(round));

          router.push(`/party/${lobbyCode}/intermission?${params.toString()}`);
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [isMultiplayer, lobbyCode, playerId, gameSlug, round, router]);

  // This component doesn't render anything visible
  return null;
}