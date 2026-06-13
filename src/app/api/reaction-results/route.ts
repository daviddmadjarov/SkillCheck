import { NextResponse } from 'next/server';

import { getRoundSlugFromGameOrder, resolveSynchronizedRoundIndex } from '@/lib/multiplayer/session';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { isValidReactionMs, reactionMsToLeaderboardScore } from '@/lib/scoring/reaction';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_TEST_SLUGS = new Set(['reaction-time', 'audio-reaction', 'multi-reaction']);

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        multiplayerGameSlug?: unknown;
        multiplayerLobbyCode?: unknown;
        multiplayerPlayerId?: unknown;
        multiplayerRound?: unknown;
        reactionMs?: unknown;
        testSlug?: unknown;
      }
    | null;
  const reactionMs = typeof body?.reactionMs === 'number' ? body.reactionMs : Number.NaN;
  const testSlug = typeof body?.testSlug === 'string' ? body.testSlug : 'reaction-time';
  const multiplayerGameSlug = typeof body?.multiplayerGameSlug === 'string' ? body.multiplayerGameSlug : null;
  const multiplayerLobbyCode = typeof body?.multiplayerLobbyCode === 'string' ? body.multiplayerLobbyCode : null;
  const multiplayerPlayerId = typeof body?.multiplayerPlayerId === 'string' ? body.multiplayerPlayerId : null;
  const parsedRound = Math.floor(Number(body?.multiplayerRound));
  const multiplayerRound = Number.isFinite(parsedRound) && parsedRound >= 0 ? parsedRound : 0;
  const isSessionSubmission = Boolean(multiplayerLobbyCode && multiplayerGameSlug);

  if (!isValidReactionMs(reactionMs)) {
    return NextResponse.json({ error: 'Invalid reaction time.' }, { status: 400 });
  }

  if (!ALLOWED_TEST_SLUGS.has(testSlug)) {
    return NextResponse.json({ error: 'Invalid reaction test slug.' }, { status: 400 });
  }

  const score = reactionMsToLeaderboardScore(reactionMs);
  if (!isSessionSubmission) {
    const { error } = await supabase.from('score_submissions').insert({
      attempts: 1,
      category: 'reaction',
      percentile: null,
      score,
      test_slug: testSlug,
      user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: 'Could not save result.' }, { status: 500 });
    }
  }

  if (isSessionSubmission && multiplayerLobbyCode && multiplayerGameSlug) {
    if (!multiplayerPlayerId) {
      return NextResponse.json({ error: 'Missing multiplayer player metadata.' }, { status: 400 });
    }

    const { data: lobby, error: lobbyError } = await supabase
      .from('multiplayer_lobbies')
      .select('id, code, game_order')
      .eq('code', multiplayerLobbyCode)
      .maybeSingle();

    if (lobbyError || !lobby) {
      return NextResponse.json({ error: 'Could not load multiplayer lobby.' }, { status: 404 });
    }

    const resolvedRound = await resolveSynchronizedRoundIndex({
      gameOrder: lobby.game_order,
      lobbyCode: lobby.code,
      lobbyId: lobby.id,
      supabase,
    });

    if (resolvedRound > multiplayerRound) {
      return NextResponse.json({ error: 'Round is already closed.' }, { status: 409 });
    }

    const expectedRoundSlug = getRoundSlugFromGameOrder(lobby.game_order, multiplayerRound);
    if (expectedRoundSlug === null || expectedRoundSlug !== multiplayerGameSlug) {
      return NextResponse.json({ error: 'Submission does not match active session round.' }, { status: 409 });
    }

    const { data: existingResult } = await supabase
      .from('multiplayer_game_results')
      .select('id')
      .eq('lobby_code', multiplayerLobbyCode)
      .eq('game_slug', multiplayerGameSlug)
      .eq('player_id', multiplayerPlayerId)
      .maybeSingle();

    if (existingResult) {
      return NextResponse.json({ error: 'Round score already submitted.' }, { status: 409 });
    }

    const { error: multiplayerError } = await supabase.from('multiplayer_game_results').insert({
      game_slug: multiplayerGameSlug,
      lobby_code: multiplayerLobbyCode,
      player_id: multiplayerPlayerId,
      score,
      user_id: user.id,
    });

    if (multiplayerError) {
      return NextResponse.json({ error: 'Could not save multiplayer result.' }, { status: 500 });
    }

    if (multiplayerPlayerId) {
      const { data: playerRow, error: playerLookupError } = await supabase
        .from('multiplayer_lobby_players')
        .select('score_total')
        .eq('id', multiplayerPlayerId)
        .maybeSingle();

      if (playerLookupError) {
        return NextResponse.json({ error: 'Could not update multiplayer score.' }, { status: 500 });
      }

      const nextScoreTotal = (playerRow?.score_total ?? 0) + score;
      const { error: playerUpdateError } = await supabase
        .from('multiplayer_lobby_players')
        .update({ score_total: nextScoreTotal })
        .eq('id', multiplayerPlayerId);

      if (playerUpdateError) {
        return NextResponse.json({ error: 'Could not update multiplayer score.' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, reactionMs, score, sessionOnly: isSessionSubmission, testSlug });
}