'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * This component mounts inside game pages during multiplayer sessions.
 *
 * It polls session-status to detect when the round has advanced on the server
 * (meaning the opponent finished or the timer ran out), and automatically
 * redirects to the intermission/scoreboard.
 *
 * When unmounting (player navigates away), it signals the server for an
 * instant forfeit so the opponent gets the win immediately.
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

    // ── Poll session status every 2s (round advancement + forfeit detection) ──
    const statusInterval = window.setInterval(async () => {
      if (!mountedRef.current) return;

      try {
        const response = await fetch(
          `/api/multiplayer/session-status?lobby=${encodeURIComponent(lobbyCode)}&round=${round}`,
          { cache: 'no-store' },
        );
        if (!response.ok) return;

        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          forfeited?: boolean;
          forfeitedMessage?: string;
          readyToAdvance?: boolean;
        } | null;

        if (!payload) return;

        // ── Forfeit detected (opponent left) ──
        if (payload.forfeited) {
          const params = new URLSearchParams();
          if (gameSlug) params.set('game', gameSlug);
          if (playerId) params.set('player', playerId);
          params.set('round', String(round));
          params.set('forfeited', '1');
          if (payload.forfeitedMessage) {
            params.set('message', payload.forfeitedMessage);
          }

          router.push(`/party/${lobbyCode}/intermission?${params.toString()}`);
          return;
        }

        // ── Round advance (normal) ──
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
      window.clearInterval(statusInterval);

      // Signal the server that we're leaving so the opponent gets instant forfeit
      fetch('/api/multiplayer/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyCode, leave: true }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [isMultiplayer, lobbyCode, playerId, gameSlug, round, router]);

  // This component doesn't render anything visible
  return null;
}