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
    .select('id, code, game_order, status, mode, forfeited, winner_user_id')
    .eq('code', lobbyCode)
    .maybeSingle();

  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found.' }, { status: 404 });
  }

  // ── Finished / forfeited detection ──
  if (lobby.forfeited || lobby.status === 'finished') {
    // Get all players with scores for final standings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: finishedPlayers } = await (supabase as any)
      .from('multiplayer_lobby_players')
      .select('id, display_name, user_id, score_total, forfeited')
      .eq('lobby_id', lobby.id)
      .order('score_total', { ascending: false })
      .order('joined_at', { ascending: true });

    const finishedStandings = (finishedPlayers ?? []).map(
      (p: { display_name: string; forfeited: boolean; id: string; score_total: number; user_id: string }, index: number) => ({
        displayName: p.display_name,
        forfeited: p.forfeited,
        isLeading: index === 0,
        playerId: p.id,
        rank: index + 1,
        scoreTotal: p.score_total,
        userId: p.user_id,
      }),
    );

    // For actual forfeits, get winner info
    let winnerDisplayName: string | null = null;
    let winnerElo: number | null = null;

    if (lobby.forfeited && lobby.winner_user_id) {
      const { data: winnerPlayer } = await supabase
        .from('multiplayer_lobby_players')
        .select('display_name, user_id')
        .eq('lobby_id', lobby.id)
        .eq('user_id', lobby.winner_user_id)
        .maybeSingle();
      winnerDisplayName = winnerPlayer?.display_name ?? null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: eloData } = await (supabase as any)
        .from('profiles')
        .select('elo_rating')
        .eq('id', lobby.winner_user_id)
        .maybeSingle();
      winnerElo = eloData?.elo_rating ?? null;
    }

    // For normal match completion (not forfeited), return readyToAdvance without forfeited flag
    if (lobby.status === 'finished' && !lobby.forfeited) {
      return NextResponse.json({
        forfeited: false,
        isSessionFinished: true,
        playersCount: finishedPlayers?.length ?? 0,
        readyToAdvance: true,
        standings: finishedStandings,
        submittedCount: finishedPlayers?.length ?? 0,
        totalRounds: lobby.game_order.length,
      });
    }

    // Actual forfeit
    return NextResponse.json({
      forfeited: true,
      forfeitedMessage: `Opponent has left the match. ${winnerDisplayName ?? 'You'} win!`,
      isSessionFinished: true,
      playersCount: finishedPlayers?.length ?? 0,
      readyToAdvance: true,
      standings: finishedStandings,
      submittedCount: 0,
      totalRounds: lobby.game_order.length,
      winnerDisplayName,
      winnerElo,
    });
  }

  // ── Normal round synchronization ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessionPlayers } = await (supabase as any)
    .from('multiplayer_lobby_players')
    .select('id, display_name, user_id, score_total')
    .eq('lobby_id', lobby.id)
    .order('score_total', { ascending: false })
    .order('joined_at', { ascending: true });

  const playerIds = new Set((sessionPlayers ?? []).map((p: { id: string }) => p.id));
  const playersCount = playerIds.size;

  const resolvedRound = await resolveSynchronizedRoundIndex({
    gameOrder: lobby.game_order,
    lobbyCode: lobby.code,
    lobbyId: lobby.id,
    supabase,
  });

  const readyToAdvance = resolvedRound > round;
  const isSessionFinished = resolvedRound >= lobby.game_order.length;

  // ── Normal match completion for duel: all rounds resolved, trigger Elo processing ──
  if (isSessionFinished && lobby.status === 'live' && lobby.mode === 'duel' && !lobby.winner_user_id) {
    const duelPlayers = sessionPlayers ?? [];

    // ── Check for tie: both players have the same total score ──
    const isTie = duelPlayers.length >= 2 && duelPlayers[0].score_total === duelPlayers[1].score_total;

    if (isTie) {
      // Tie: mark lobby as finished but don't call process_duel_completion (no Elo change)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('multiplayer_lobbies')
        .update({ status: 'finished', updated_at: new Date().toISOString() })
        .eq('id', lobby.id);

      lobby.status = 'finished';

      const tieStandings = duelPlayers.map(
        (p: { display_name: string; id: string; score_total: number; user_id: string }, index: number) => ({
          displayName: p.display_name,
          forfeited: false,
          isLeading: false,
          playerId: p.id,
          rank: 1, // both rank 1 in a tie
          scoreTotal: p.score_total,
          userId: p.user_id,
        }),
      );

      return NextResponse.json({
        forfeited: false,
        isSessionFinished: true,
        isTie: true,
        playersCount: duelPlayers.length,
        readyToAdvance: true,
        standings: tieStandings,
        submittedCount: duelPlayers.length,
        totalRounds: lobby.game_order.length,
      });
    }

    if (duelPlayers.length >= 2) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: completionResult } = await (supabase.rpc as any)('process_duel_completion', {
        p_lobby_id: lobby.id,
        p_winner_user_id: duelPlayers[0].user_id,
      });

      // Reload lobby to get the new winner_user_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedLobby } = await (supabase as any)
        .from('multiplayer_lobbies')
        .select('status, forfeited, winner_user_id')
        .eq('id', lobby.id)
        .maybeSingle();

      if (updatedLobby) {
        lobby.status = updatedLobby.status;
        lobby.forfeited = updatedLobby.forfeited;
        lobby.winner_user_id = updatedLobby.winner_user_id;
      }

      // If completion was processed, return finished response
      if (completionResult && updatedLobby?.status === 'finished') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: eloData } = await (supabase as any)
          .from('profiles')
          .select('elo_rating')
          .eq('id', duelPlayers[0].user_id)
          .maybeSingle();

        const completionStandings = duelPlayers.map(
          (p: { display_name: string; id: string; score_total: number; user_id: string }, index: number) => ({
            displayName: p.display_name,
            forfeited: false,
            isLeading: index === 0,
            playerId: p.id,
            rank: index + 1,
            scoreTotal: p.score_total,
            userId: p.user_id,
          }),
        );

        return NextResponse.json({
          forfeited: false,
          forfeitedMessage: `Match complete! ${duelPlayers[0].display_name} wins!`,
          isSessionFinished: true,
          playersCount: duelPlayers.length,
          readyToAdvance: true,
          standings: completionStandings,
          submittedCount: playersCount,
          totalRounds: lobby.game_order.length,
          winnerDisplayName: duelPlayers[0].display_name,
          winnerElo: eloData?.elo_rating ?? null,
        });
      }
    }
  }

  // ── Normal match completion for party: all rounds resolved, mark finished (no Elo) ──
  if (isSessionFinished && lobby.status === 'live' && lobby.mode === 'party' && !lobby.winner_user_id) {
    const partyPlayers = sessionPlayers ?? [];

    // Mark lobby as finished (no Elo processing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('multiplayer_lobbies')
      .update({ status: 'finished', updated_at: new Date().toISOString() })
      .eq('id', lobby.id);

    lobby.status = 'finished';

    // Determine winner (highest score wins, tie = first player)
    const winner = partyPlayers[0] ?? null;

    const partyStandings = partyPlayers.map(
      (p: { display_name: string; id: string; score_total: number; user_id: string }, index: number) => ({
        displayName: p.display_name,
        forfeited: false,
        isLeading: index === 0,
        playerId: p.id,
        rank: index + 1,
        scoreTotal: p.score_total,
        userId: p.user_id,
      }),
    );

    return NextResponse.json({
      forfeited: false,
      isPartyMode: true,
      isSessionFinished: true,
      playersCount: partyPlayers.length,
      readyToAdvance: true,
      standings: partyStandings,
      submittedCount: partyPlayers.length,
      totalRounds: lobby.game_order.length,
      winnerDisplayName: winner?.display_name ?? null,
    });
  }

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
  const standings = (sessionPlayers ?? []).map(
    (p: { display_name: string; id: string; score_total: number; user_id: string }, index: number) => ({
      displayName: p.display_name,
      forfeited: false,
      isLeading: index === 0,
      playerId: p.id,
      rank: index + 1,
      scoreTotal: p.score_total,
      userId: p.user_id,
    }),
  );

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