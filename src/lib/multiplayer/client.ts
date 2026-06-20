'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

export type MultiplayerSessionMode = 'duel' | 'party' | null;

export type MultiplayerSubmissionMeta = {
  multiplayerGameSlug: string | null;
  multiplayerLobbyCode: string | null;
  multiplayerPlayerId: string | null;
  multiplayerRound: number;
  multiplayerMode: MultiplayerSessionMode;
  daily: boolean;
};

export function useMultiplayerSubmissionMeta(defaultGameSlug?: string): MultiplayerSubmissionMeta {
  const searchParams = useSearchParams();

  return useMemo(() => {
    const multiplayerLobbyCode = searchParams.get('lobby');
    const multiplayerGameSlug = searchParams.get('game') ?? defaultGameSlug ?? null;
    const multiplayerPlayerId = searchParams.get('player');
    const parsedRound = Number(searchParams.get('round'));
    const multiplayerRound = Number.isFinite(parsedRound) && parsedRound >= 0 ? Math.floor(parsedRound) : 0;
    const daily = searchParams.get('daily') === 'true';
    const modeParam = searchParams.get('mp_mode');
    const multiplayerMode: MultiplayerSessionMode = modeParam === 'duel' ? 'duel' : modeParam === 'party' ? 'party' : null;

    return {
      multiplayerGameSlug,
      multiplayerLobbyCode,
      multiplayerPlayerId,
      multiplayerRound,
      multiplayerMode,
      daily,
    };
  }, [defaultGameSlug, searchParams]);
}

export function useMultiplayerRoundFlow(defaultGameSlug?: string) {
  const router = useRouter();
  const meta = useMultiplayerSubmissionMeta(defaultGameSlug);

  const isMultiplayerSession = Boolean(meta.multiplayerLobbyCode && meta.multiplayerPlayerId && meta.multiplayerGameSlug);
  const isDailyGame = meta.daily && !isMultiplayerSession;

  function goToIntermission() {
    if (!isMultiplayerSession || !meta.multiplayerLobbyCode || !meta.multiplayerPlayerId || !meta.multiplayerGameSlug) {
      return;
    }

    const params = new URLSearchParams();
    params.set('game', meta.multiplayerGameSlug);
    params.set('player', meta.multiplayerPlayerId);
    params.set('round', String(meta.multiplayerRound));

    router.push(`/party/${meta.multiplayerLobbyCode}/intermission?${params.toString()}`);
  }

  function goToDailyResult() {
    if (!isDailyGame) return;
    router.push('/daily?completed=1');
  }

  return {
    goToIntermission,
    goToDailyResult,
    isMultiplayerSession,
    isDailyGame,
    meta,
  };
}