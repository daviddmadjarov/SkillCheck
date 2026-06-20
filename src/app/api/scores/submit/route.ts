import { NextResponse } from 'next/server';

import { getRoundSlugFromGameOrder, resolveSynchronizedRoundIndex } from '@/lib/multiplayer/session';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_TESTS = new Map<string, string>([
  ['aim-trainer', 'aim'],
  ['aim-moving-targets', 'aim'],
  ['aim-tracking-test', 'aim'],
  ['aim-perfect-split', 'aim'],
  ['typing-speed', 'typing'],
  ['mental-rotation', 'thinking'],
  ['estimation-challenge', 'thinking'],
  ['sequence-memory', 'thinking'],
  ['perfect-sync', 'rhythm'],
  ['stop-timer', 'rhythm'],
  ['symbol-tracing', 'mouse'],
  ['mouse-symbol-tracing', 'mouse'],
  ['mouse-cps', 'mouse'],
]);

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
        score?: unknown;
        testSlug?: unknown;
        daily?: unknown;
      }
    | null;

  const testSlug = typeof body?.testSlug === 'string' ? body.testSlug : '';
  const score = Math.round(Number(body?.score));
  const multiplayerGameSlug = typeof body?.multiplayerGameSlug === 'string' ? body.multiplayerGameSlug : null;
  const multiplayerLobbyCode = typeof body?.multiplayerLobbyCode === 'string' ? body.multiplayerLobbyCode : null;
  const multiplayerPlayerId = typeof body?.multiplayerPlayerId === 'string' ? body.multiplayerPlayerId : null;
  const parsedRound = Math.floor(Number(body?.multiplayerRound));
  const multiplayerRound = Number.isFinite(parsedRound) && parsedRound >= 0 ? parsedRound : 0;
  const isSessionSubmission = Boolean(multiplayerLobbyCode && multiplayerGameSlug);
  const isDaily = body?.daily === true || body?.daily === 'true';

  if (!ALLOWED_TESTS.has(testSlug)) {
    return NextResponse.json({ error: 'Invalid test slug.' }, { status: 400 });
  }

  if (!Number.isFinite(score) || score < 0 || score > 1000) {
    return NextResponse.json({ error: 'Invalid score.' }, { status: 400 });
  }

  const category = ALLOWED_TESTS.get(testSlug) as string;

  if (!isSessionSubmission) {
    const { error } = await supabase.from('score_submissions').insert({
      attempts: 1,
      category,
      percentile: null,
      score,
      test_slug: testSlug,
      user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: 'Could not save score.' }, { status: 500 });
    }
  }

  // ── Daily challenge tracking ──
  // Log in daily_challenge_log. The unique (user_id, challenge_date) constraint
  // ensures only one submission per user per day.
  if (isDaily && !isSessionSubmission && hasSupabaseEnv()) {
    const now = new Date();
    const challengeDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dailyError } = await (supabase.from('daily_challenge_log' as any) as any).insert({
      challenge_date: challengeDate,
      game_slug: testSlug,
      score,
      user_id: user.id,
    });

    if (dailyError) {
      // If the unique constraint fails (user already submitted), that's fine
      if (!dailyError.message?.includes('duplicate') && !dailyError.message?.includes('unique')) {
        return NextResponse.json({ error: 'Could not save daily challenge result.' }, { status: 500 });
      }
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

  return NextResponse.json({ ok: true, score, sessionOnly: isSessionSubmission, testSlug, category, daily: isDaily });
}