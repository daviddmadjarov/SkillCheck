import { NextRequest, NextResponse } from 'next/server';

import { getRoundSlugFromGameOrder, getRoundTimeLimitSeconds, resolveSynchronizedRoundIndex } from '@/lib/multiplayer/session';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const lobbyCode = searchParams.get('lobby');
  const roundRaw = searchParams.get('round');
  const parsedRound = Number(roundRaw);
  const round = Number.isFinite(parsedRound) && parsedRound >= 0 ? Math.floor(parsedRound) : 0;

  if (!lobbyCode) {
    return NextResponse.json({ error: 'Missing lobby parameter.' }, { status: 400 });
  }

  const supabase = await createClient();

  // Check if lobby is forfeited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lobby } = await (supabase as any)
    .from('multiplayer_lobbies')
    .select('id, code, game_order, status, forfeited, winner_user_id')
    .eq('code', lobbyCode)
    .maybeSingle();

  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found.' }, { status: 404 });
  }

  // ── Forfeit detection ──
  if (lobby.forfeited || lobby.status === 'finished') {
    // Get the winner info
    const { data: winnerPlayer } = await supabase
      .from('multiplayer_lobby_players')
      .select('display_name, user_id')
      .eq('lobby_id', lobby.id)
      .eq('user_id', lobby.winner_user_id)
      .maybeSingle();

    // Get all players with scores for final standings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: players } = await (supabase as any)
      .from('multiplayer_lobby_players')
      .select('id, display_name, user_id, score_total, forfeited')
      .eq('lobby_id', lobby.id)
      .order('score_total', { ascending: false })
      .order('joined_at', { ascending: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: eloResult } = await (supabase as any)
      .from('profiles')
      .select('elo_rating')
      .eq('id', lobby.winner_user_id)
      .maybeSingle();

    const forfeitedStandings = (players ?? []).map((p: { display_name: string; forfeited: boolean; id: string; score_total: number; user_id: string }, index: number) => ({
      displayName: p.display_name,
      forfeited: p.forfeited,
      isLeading: index === 0,
      playerId: p.id,
      rank: index + 1,
      scoreTotal: p.score_total,
      userId: p.user_id,
    }));

    return NextResponse.json({
      forfeited: true,
      forfeitedMessage: lobby.forfeited
        ? `Opponent has left the match. ${winnerPlayer?.display_name ?? 'You'} win!`
        : 'Match has ended.',
      isSessionFinished: true,
      playersCount: players?.length ?? 0,
      readyToAdvance: true,
      standings: forfeitedStandings,
      submittedCount: 0,
      totalRounds: lobby.game_order.length,
      winnerDisplayName: winnerPlayer?.display_name ?? null,
      winnerElo: eloResult?.elo_rating ?? null,
    });
  }

  // ── Normal round synchronization ──
  // Get players with their cumulative scores
  const { data: players } = await supabase
    .from('multiplayer_lobby_players')
    .select('id, display_name, user_id, score_total')
    .eq('lobby_id', lobby.id)
    .order('score_total', { ascending: false })
    .order('joined_at', { ascending: true });

  const playerIds = new Set((players ?? []).map((p) => p.id));
  const playersCount = playerIds.size;

  const resolvedRound = await resolveSynchronizedRoundIndex({
    gameOrder: lobby.game_order,
    lobbyCode: lobby.code,
    lobbyId: lobby.id,
    supabase,
  });

  const readyToAdvance = resolvedRound > round;
  const isSessionFinished = resolvedRound >= lobby.game_order.length;

  // Count submissions for the current round
  const currentRoundSlug = getRoundSlugFromGameOrder(lobby.game_order, round);
  let submittedCount = 0;
  let deadlineAt: string | null = null;

  if (currentRoundSlug) {
    const { data: roundResults } = await supabase
      .from('multiplayer_game_results')
      .select('player_id, submitted_at, score')
      .eq('lobby_code', lobby.code)
      .eq('game_slug', currentRoundSlug)
      .order('submitted_at', { ascending: true });

    if (roundResults) {
      const validResults = roundResults.filter(
        (row) => row.player_id !== null && playerIds.has(row.player_id),
      );
      submittedCount = new Set(validResults.map((row) => row.player_id as string)).size;

      const firstSubmittedAt = validResults[0]?.submitted_at ?? null;
      if (firstSubmittedAt) {
        deadlineAt = new Date(
          new Date(firstSubmittedAt).getTime() + getRoundTimeLimitSeconds(currentRoundSlug) * 1000,
        ).toISOString();
      }
    }
  }

  // Build the standings array (already sorted by score_total DESC)
  const standings = (players ?? []).map((p, index) => ({
    displayName: p.display_name,
    forfeited: false,
    isLeading: index === 0,
    playerId: p.id,
    rank: index + 1,
    scoreTotal: p.score_total,
    userId: p.user_id,
  }));

  return NextResponse.json({
    deadlineAt,
    forfeited: false,
    isSessionFinished,
    playersCount,
    readyToAdvance,
    standings,
    submittedCount,
    totalRounds: lobby.game_order.length,
  });
}