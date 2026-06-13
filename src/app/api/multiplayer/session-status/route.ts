import { NextResponse } from 'next/server';

import { getRoundSlugFromGameOrder, getRoundTimeLimitSeconds, resolveSynchronizedRoundIndex } from '@/lib/multiplayer/session';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const url = new URL(request.url);
  const lobbyCode = url.searchParams.get('lobby');
  const roundRaw = url.searchParams.get('round');
  const parsedRound = Number(roundRaw);
  const round = Number.isFinite(parsedRound) && parsedRound >= 0 ? Math.floor(parsedRound) : 0;

  if (!lobbyCode) {
    return NextResponse.json({ error: 'Missing lobby parameter.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const { data: lobby } = await supabase
    .from('multiplayer_lobbies')
    .select('id, code, game_order')
    .eq('code', lobbyCode)
    .maybeSingle();

  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found.' }, { status: 404 });
  }

  const currentRoundSlug = getRoundSlugFromGameOrder(lobby.game_order, round);
  const resolvedRound = await resolveSynchronizedRoundIndex({
    gameOrder: lobby.game_order,
    lobbyCode: lobby.code,
    lobbyId: lobby.id,
    supabase,
  });

  if (!currentRoundSlug) {
    return NextResponse.json({
      allSubmitted: true,
      deadlineAt: null,
      playersCount: 0,
      readyToAdvance: true,
      resolvedRound,
      submittedCount: 0,
      timedOut: false,
    });
  }

  const { data: players } = await supabase
    .from('multiplayer_lobby_players')
    .select('id')
    .eq('lobby_id', lobby.id);

  const playersCount = players?.length ?? 0;
  const playerIds = new Set((players ?? []).map((player) => player.id));

  const { data: resultRows } = await supabase
    .from('multiplayer_game_results')
    .select('player_id, submitted_at')
    .eq('lobby_code', lobby.code)
    .eq('game_slug', currentRoundSlug)
    .order('submitted_at', { ascending: true });

  const uniquePlayers = new Set(
    (resultRows ?? [])
      .map((row) => row.player_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0 && playerIds.has(value)),
  );

  const submittedCount = uniquePlayers.size;
  const firstSubmittedAt = resultRows?.[0]?.submitted_at ?? null;

  let deadlineAt: string | null = null;
  let timedOut = false;

  if (firstSubmittedAt) {
    const firstMs = new Date(firstSubmittedAt).getTime();
    const deadlineMs = firstMs + getRoundTimeLimitSeconds(currentRoundSlug) * 1000;
    deadlineAt = new Date(deadlineMs).toISOString();
    timedOut = Date.now() >= deadlineMs;
  }

  const allSubmitted = playersCount > 0 && submittedCount >= playersCount;

  return NextResponse.json({
    allSubmitted,
    deadlineAt,
    playersCount,
    readyToAdvance: resolvedRound > round,
    resolvedRound,
    submittedCount,
    timedOut,
  });
}
