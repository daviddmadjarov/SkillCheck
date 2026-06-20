'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

export type MultiplayerSubmissionMeta = {
  multiplayerGameSlug: string | null;
  multiplayerLobbyCode: string | null;
  multiplayerPlayerId: string | null;
  multiplayerRound: number;
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

    return {
      multiplayerGameSlug,
      multiplayerLobbyCode,
      multiplayerPlayerId,
      multiplayerRound,
      daily,
    };
  }, [defaultGameSlug, searchParams]);
}

export function useMultiplayerRoundFlow(defaultGameSlug?: string) {
  const router = useRouter();
  const meta = useMultiplayerSubmissionMeta(defaultGameSlug);

  const isMultiplayerSession = Boolean(meta.multiplayerLobbyCode && meta.multiplayerPlayerId && meta.multiplayerGameSlug);

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

  return {
    goToIntermission,
    isMultiplayerSession,
    meta,
  };
}