'use client';

import { useEffect, useState, useRef } from 'react';
import { getRoundTimeLimitSeconds } from '@/lib/multiplayer/session';

type DuelRoundTimerProps = {
  gameSlug: string;
  lobbyCode: string;
  playerId: string;
  round: number;
};

/**
 * Live round time-limit countdown for duel sessions.
 * Props are passed from the parent server component to avoid useSearchParams() issues.
 *
 * When the timer reaches 0 and the player hasn't submitted results,
 * auto-submits a score of 0 (DNF) and redirects to the intermission page.
 */
export function DuelRoundTimer({ gameSlug, lobbyCode, playerId, round }: DuelRoundTimerProps) {
  const timeLimit = getRoundTimeLimitSeconds(gameSlug);
  const [remaining, setRemaining] = useState(timeLimit);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    if (timeLimit <= 0) return;
    hasExpiredRef.current = false;
    setRemaining(timeLimit);

    const interval = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;

            // Submit DNF (score = 0) so the opponent can continue to next round
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
              // Ignore – the server will resolve the round anyway
            });

            // Redirect to intermission
            const params = new URLSearchParams();
            params.set('game', gameSlug);
            params.set('player', playerId);
            params.set('round', String(round));
            window.location.href = `/party/${lobbyCode}/intermission?${params.toString()}`;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [gameSlug, lobbyCode, playerId, round, timeLimit]);

  if (timeLimit <= 0) return null;

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