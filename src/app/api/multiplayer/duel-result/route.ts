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
  if (lobby.winner_user_id) {
    const winnerPlayer = (players ?? []).find(
      (p: { display_name: string; user_id: string }) => p.user_id === lobby.winner_user_id,
    );
    winnerDisplayName = winnerPlayer?.display_name ?? null;
  }

  // If no winner_user_id yet but lobby is finished, the first player is the winner
  if (!lobby.winner_user_id && lobby.status === 'finished') {
    winnerDisplayName = players?.[0]?.display_name ?? null;
  }

  // Get winner's elo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: winnerProfile } = await (supabase as any)
    .from('profiles')
    .select('elo_rating')
    .eq('id', lobby.winner_user_id ?? players?.[0]?.user_id ?? '')
    .maybeSingle();

  // Get current user's elo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentProfile } = await (supabase as any)
    .from('profiles')
    .select('elo_rating, username')
    .eq('id', user.id)
    .maybeSingle();

  // Find current user's player entry in this lobby
  const currentPlayer = (players ?? []).find(
    (p: { display_name: string; user_id: string }) => p.user_id === user.id,
  );
  const currentDisplayName = currentPlayer?.display_name ?? currentProfile?.username ?? null;

  const resultPlayers = (players ?? []).map(
    (p: { display_name: string; id: string; score_total: number; user_id: string }, index: number) => ({
      displayName: p.display_name,
      isLeading: index === 0,
      rank: index + 1,
      scoreTotal: p.score_total,
      userId: p.user_id,
    }),
  );

  return NextResponse.json({
    currentDisplayName,
    currentUserId: user.id,
    currentUserEloBefore: currentProfile?.elo_rating ?? null,
    forfeited: lobby.forfeited ?? false,
    forfeitedMessage: lobby.forfeited
      ? `Opponent has left the match. ${winnerDisplayName ?? 'You'} win!`
      : null,
    players: resultPlayers,
    winnerDisplayName,
    winnerElo: winnerProfile?.elo_rating ?? null,
    winnerUserId: lobby.winner_user_id ?? players?.[0]?.user_id ?? null,
  });
}