'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { getRoundTimeLimitSeconds } from '@/lib/multiplayer/session';

/**
 * Live round time-limit countdown for duel sessions.
 *
 * Desktop: appears to the left of the player display name.
 * Mobile:  appears next to the "In Duel — Cannot leave" badge.
 *
 * When the timer reaches 0 the player hasn't submitted results for,
 * this component auto-submits a score of 0 (DNF) and redirects
 * to the intermission page so both players advance.
 */
export function DuelRoundTimer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const lobbyCode = searchParams.get('lobby');
  const playerId = searchParams.get('player');
  const gameSlug = searchParams.get('game');
  const roundRaw = searchParams.get('round');
  const parsedRound = Number(roundRaw);
  const round = Number.isFinite(parsedRound) && parsedRound >= 0 ? Math.floor(parsedRound) : 0;

  const isMultiplayer = Boolean(lobbyCode && playerId && gameSlug);
  const timeLimit = gameSlug ? getRoundTimeLimitSeconds(gameSlug) : 0;

  const [remaining, setRemaining] = useState(timeLimit);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    if (!isMultiplayer || timeLimit <= 0) return;
    hasExpiredRef.current = false;
    setRemaining(timeLimit);

    const interval = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;

            // Submit DNF (score = 0)
            fetch('/api/scores/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                testSlug: gameSlug,
                score: 0,
                multiplayerGameSlug: gameSlug,
                multiplayerLobbyCode: lobbyCode,
                multiplayerPlayerId: playerId,
                multiplayerRound: round,
                daily: false,
              }),
            }).catch(() => {
              // Ignore fetch errors – the server-side round resolution will advance us anyway
            });
            // Redirect regardless of API result — the server will resolve the round
            const params = new URLSearchParams();
            if (gameSlug) params.set('game', gameSlug);
            if (playerId) params.set('player', playerId);
            params.set('round', String(round));
            router.push(`/party/${lobbyCode}/intermission?${params.toString()}`);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isMultiplayer, timeLimit, gameSlug, lobbyCode, playerId, round, router]);

  if (!isMultiplayer || timeLimit <= 0) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeStr = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}`
    : `${seconds}s`;

  return (
    <div
      className={`rounded-2xl border-2 px-3 py-2 text-sm font-bold whitespace-nowrap shrink-0 ${
        remaining <= 10
          ? 'border-rose-300 bg-rose-50 text-rose-700 animate-pulse'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      ⏱ {timeStr}
    </div>
  );
}