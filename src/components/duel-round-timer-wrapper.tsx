'use client';

import { useSearchParams } from 'next/navigation';
import { DuelRoundTimer } from '@/components/duel-round-timer';

/**
 * Client-side wrapper around DuelRoundTimer that reads the lobby/game/player/round
 * params from the URL. This keeps the server pages clean and avoids Suspense issues
 * since this component will be used inside already-client contexts or Suspense boundaries.
 *
 * Renders nothing when not in a multiplayer session.
 */
export function DuelRoundTimerWrapper() {
  const searchParams = useSearchParams();

  const lobbyCode = searchParams.get('lobby');
  const playerId = searchParams.get('player');
  const gameSlug = searchParams.get('game');
  const roundRaw = searchParams.get('round');
  const parsedRound = Number(roundRaw);
  const round = Number.isFinite(parsedRound) && parsedRound >= 0 ? Math.floor(parsedRound) : 0;

  if (!lobbyCode || !playerId || !gameSlug) return null;

  return (
    <DuelRoundTimer
      gameSlug={gameSlug}
      lobbyCode={lobbyCode}
      playerId={playerId}
      round={round}
    />
  );
}