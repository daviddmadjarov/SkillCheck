import { NextRequest, NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const lobbyCode = searchParams.get('lobby');

  if (!lobbyCode) {
    return NextResponse.json({ error: 'Missing lobby parameter.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lobby } = await (supabase as any)
    .from('multiplayer_lobbies')
    .select('id, code, status, mode, forfeited, winner_user_id')
    .eq('code', lobbyCode)
    .maybeSingle();

  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found.' }, { status: 404 });
  }

  if (lobby.mode !== 'duel') {
    return NextResponse.json({ error: 'Not a duel lobby.' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: players } = await (supabase as any)
    .from('multiplayer_lobby_players')
    .select('id, display_name, user_id, score_total')
    .eq('lobby_id', lobby.id)
    .order('score_total', { ascending: false })
    .order('joined_at', { ascending: true });

  // Get the winner's display name
  let winnerDisplayName: string | null = null;
  const effectiveWinnerUserId = lobby.winner_user_id ?? players?.[0]?.user_id ?? null;
  if (effectiveWinnerUserId) {
    const winnerPlayer = (players ?? []).find(
      (p: { display_name: string; user_id: string }) => p.user_id === effectiveWinnerUserId,
    );
    winnerDisplayName = winnerPlayer?.display_name ?? null;
  }

  // Get the current user's elo from profiles (after match completion)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentProfile } = await (supabase as any)
    .from('profiles')
    .select('elo_rating, username')
    .eq('id', user.id)
    .maybeSingle();

  // Get both players' profiles for elo display
  const playerIds = (players ?? []).map((p: { user_id: string }) => p.user_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allProfiles } = await (supabase as any)
    .from('profiles')
    .select('id, elo_rating')
    .in('id', playerIds.length > 0 ? playerIds : ['none']);

  const eloByUserId = new Map<string, number>();
  if (allProfiles) {
    (allProfiles as Array<{ id: string; elo_rating: number | null }>).forEach((p) => {
      if (p.elo_rating !== null) eloByUserId.set(p.id, p.elo_rating);
    });
  }

  // Find current user's player entry in this lobby
  const currentPlayer = (players ?? []).find(
    (p: { display_name: string; user_id: string }) => p.user_id === user.id,
  );
  const currentDisplayName = currentPlayer?.display_name ?? currentProfile?.username ?? null;

  const resultPlayers = (players ?? []).map(
    (p: { display_name: string; id: string; score_total: number; user_id: string }, index: number) => ({
      displayName: p.display_name,
      elo: eloByUserId.get(p.user_id) ?? null,
      isLeading: index === 0,
      rank: index + 1,
      scoreTotal: p.score_total,
      userId: p.user_id,
    }),
  );

  // Compute elo change for current user
  const currentElo = currentProfile?.elo_rating ?? null;

  // We don't have a direct "before" snapshot, so we estimate from the winner's perspective.
  // The winner's elo went up, loser's went down. The current user's elo IS the after value.
  // For simplicity, we report current elo and note if they won or lost.
  const isCurrentWinner = effectiveWinnerUserId === user.id;

  return NextResponse.json({
    currentDisplayName,
    currentUserId: user.id,
    currentElo,
    forfeited: lobby.forfeited ?? false,
    forfeitedMessage: lobby.forfeited
      ? `Opponent has left the match. ${winnerDisplayName ?? 'You'} win!`
      : null,
    isCurrentWinner,
    players: resultPlayers,
    winnerDisplayName,
    winnerUserId: effectiveWinnerUserId,
  });
}