'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * This component mounts inside game pages during multiplayer sessions.
 *
 * It does two things:
 * 1. Polls session-status to detect when the round has advanced on the server
 *    (meaning the opponent finished or the timer ran out), and automatically
 *    redirects to the intermission/scoreboard.
 * 2. Sends a heartbeat every 10 seconds to track the player's presence.
 *    If the opponent stops sending heartbeats for >30 seconds, the server
 *    will declare a forfeit and the next poll will detect it.
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
  const forfeitDetectedRef = useRef(false);

  useEffect(() => {
    if (!isMultiplayer || !lobbyCode) return;

    mountedRef.current = true;
    forfeitDetectedRef.current = false;

    // ── Poll session status every 2s (round advancement + forfeit detection) ──
    const statusInterval = window.setInterval(async () => {
      if (!mountedRef.current || forfeitDetectedRef.current) return;

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

        // ── Forfeit detected ──
        if (payload.forfeited) {
          forfeitDetectedRef.current = true;

          // Redirect to intermission with forfeit info
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

    // ── Send heartbeat every 10s ──
    const heartbeatInterval = window.setInterval(async () => {
      if (!mountedRef.current) return;

      try {
        const response = await fetch('/api/multiplayer/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyCode }),
        });

        if (!response.ok) return;

        const payload = (await response.json().catch(() => null)) as {
          action?: string;
          forfeited?: boolean;
          winnerUserId?: string;
          winnerDisplayName?: string;
          loserDisplayName?: string;
        } | null;

        // If the heartbeat endpoint detected a forfeit, redirect
        if (payload?.forfeited) {
          forfeitDetectedRef.current = true;

          const params = new URLSearchParams();
          if (gameSlug) params.set('game', gameSlug);
          if (playerId) params.set('player', playerId);
          params.set('round', String(round));
          params.set('forfeited', '1');

          if (payload.winnerUserId === playerId) {
            // We won by forfeit
            params.set('message', `Opponent has left the match. You win!`);
          } else {
            // We lost by forfeit (opponent saw it first)
            params.set('message', `Your opponent has left.`);
          }

          router.push(`/party/${lobbyCode}/intermission?${params.toString()}`);
        }
      } catch {
        // keep trying
      }
    }, 10000);

    // Send an immediate first heartbeat
    fetch('/api/multiplayer/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lobbyCode }),
    }).catch(() => {});

    return () => {
      mountedRef.current = false;
      window.clearInterval(statusInterval);
      window.clearInterval(heartbeatInterval);
    };
  }, [isMultiplayer, lobbyCode, playerId, gameSlug, round, router]);

  // This component doesn't render anything visible
  return null;
}