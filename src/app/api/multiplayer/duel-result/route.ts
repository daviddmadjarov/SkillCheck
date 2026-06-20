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
    .select('id, display_name, user_id, score_total, forfeited')
    .eq('lobby_id', lobby.id)
    .order('score_total', { ascending: false })
    .order('joined_at', { ascending: true });

  // Determine the winner:
  // 1. If lobby has a winner_user_id, use that (set by process_duel_completion)
  // 2. If lobby is forfeited, the winner is the player NOT marked as forfeited
  // 3. Never fallback to players[0] — that's ambiguous when scores are tied
  let effectiveWinnerUserId: string | null = null;

  if (lobby.winner_user_id) {
    effectiveWinnerUserId = lobby.winner_user_id;
  } else if (lobby.forfeited) {
    // Find the non-forfeited player — they're the winner
    const nonForfeited = (players ?? []).find(
      (p: { forfeited: boolean }) => !p.forfeited,
    );
    effectiveWinnerUserId = nonForfeited?.user_id ?? null;
  }

  // Get the winner's display name
  let winnerDisplayName: string | null = null;
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
    (p: { display_name: string; id: string; score_total: number; user_id: string; forfeited?: boolean }, index: number) => ({
      displayName: p.display_name,
      elo: eloByUserId.get(p.user_id) ?? null,
      forfeited: p.forfeited ?? false,
      isLeading: index === 0,
      rank: index + 1,
      scoreTotal: p.score_total,
      userId: p.user_id,
    }),
  );

  // Compute elo change for current user
  const currentElo = currentProfile?.elo_rating ?? null;
  const isCurrentWinner = effectiveWinnerUserId === user.id;

  // Calculate elo delta by reverse-engineering from both players' after-match elo.
  // The Elo function: delta = round(K * (1 - 1/(1 + 10^((loser_before - winner_before)/400))))
  // After match: winner_after = winner_before + delta, loser_after = loser_before - delta
  // So: loser_before - winner_before = (loser_after + delta) - (winner_after - delta)
  //                                   = loser_after - winner_after + 2*delta
  // We solve iteratively: delta starts at 16 (K/2) and converges in ~3 iterations.
  let computedDelta: number | null = null;
  const winnerAfter = resultPlayers[0]?.elo ?? null;
  const loserAfter = resultPlayers[1]?.elo ?? null;
  if (winnerAfter !== null && loserAfter !== null) {
    const K = 32;
    let delta = K / 2;
    for (let i = 0; i < 5; i++) {
      const ratingDiff = (loserAfter - winnerAfter + 2 * delta) / 400;
      const expected = 1.0 / (1.0 + Math.pow(10, ratingDiff));
      const newDelta = Math.round(K * (1.0 - expected));
      if (newDelta === delta) break;
      delta = newDelta;
    }
    computedDelta = delta;
  }

  // Get the current user's elo delta
  const userEloDelta = isCurrentWinner ? computedDelta : (computedDelta !== null ? -computedDelta : null);

  return NextResponse.json({
    currentDisplayName,
    currentUserId: user.id,
    currentElo,
    eloDelta: userEloDelta,
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