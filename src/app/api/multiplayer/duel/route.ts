import { NextResponse } from 'next/server';

import {
  buildMultiplayerSessionHref,
  createLobbyCode,
  getRandomMultiplayerGames,
  parseMultiplayerSelectionToken,
  serializeMultiplayerSelection,
} from '@/lib/multiplayer/catalog';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

const DUEL_GAME_COUNT = 4;
const MATCH_WINDOW_MS = 5 * 60 * 1000;

async function ensureProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, username: string) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from('profiles').insert({ id: userId, skill_level: 'Candidate', username });

  if (error) {
    if (error.code === '23505') {
      const { error: retryError } = await supabase.from('profiles').insert({
        id: userId,
        skill_level: 'Candidate',
        username: `${username}_${userId.slice(0, 4)}`,
      });
      if (retryError) throw new Error(retryError.message);
      return;
    }
    throw new Error(error.message);
  }
}

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  const rawName =
    (typeof metadata.user_name === 'string' ? metadata.user_name : null) ??
    (typeof metadata.full_name === 'string' ? metadata.full_name : null) ??
    user.email?.split('@')[0] ??
    'Researcher';
  const trimmed = rawName.trim();
  if (trimmed.length < 3) return `User_${trimmed}`;
  if (trimmed.length > 24) return trimmed.slice(0, 24);
  return trimmed;
}

async function lookupDisplayName(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle();
  return data?.username ?? `Player_${userId.slice(0, 6)}`;
}

/** Build the first-game session URL for a player in a duel lobby. */
function buildFirstGameUrl(playerId: string, lobbyCode: string, gameOrder: string[]): string | null {
  const firstToken = gameOrder[0];
  if (!firstToken) return null;
  return buildMultiplayerSessionHref(parseMultiplayerSelectionToken(firstToken), {
    lobbyCode,
    playerId,
    round: 0,
  });
}

// ─── POST: Enter the duel queue or match with an opponent ─────────────────

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const displayName = getDisplayName(user);

  try {
    await ensureProfile(supabase, user.id, displayName);
  } catch (err) {
    console.error('[duel] ensureProfile failed', err);
    return NextResponse.json({ error: 'Could not start a duel.' }, { status: 500 });
  }

  // ── Step 1: Insert ourselves into the queue FIRST ──
  const { error: upsertError } = await supabase
    .from('multiplayer_queue')
    .upsert(
      {
        queue_type: 'duel',
        user_id: user.id,
        status: 'waiting',
        matched_code: null,
        requested_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id, queue_type',
        ignoreDuplicates: false,
      },
    );

  if (upsertError) {
    console.error('[duel] queue upsert failed', upsertError.message, { userId: user.id });
    return NextResponse.json({ error: 'Could not join the duel queue.' }, { status: 500 });
  }

  // ── Step 2: Look for an opponent waiting in the queue (short retry loop) ──
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const { data: opponents } = await supabase
      .from('multiplayer_queue')
      .select('id, user_id')
      .eq('queue_type', 'duel')
      .eq('status', 'waiting')
      .neq('user_id', user.id)
      .order('requested_at', { ascending: true })
      .limit(1);

    const opponent = opponents?.[0] ?? null;

    if (!opponent) {
      // No opponent — return waiting with queue count
      const { count: queueCount } = await supabase
        .from('multiplayer_queue')
        .select('*', { count: 'exact', head: true })
        .eq('queue_type', 'duel')
        .eq('status', 'waiting');

      return NextResponse.json({ status: 'waiting', queueCount: queueCount ?? 0 }, { status: 200 });
    }

    // ── Found an opponent! Create a lobby, seat ourselves, and start the session ──
    // Then redirect both players to the first game directly — no lobby screen.

    const code = createLobbyCode();
    const games = getRandomMultiplayerGames(DUEL_GAME_COUNT);
    const selectedGames = games.map((g) => g.slug);
    const gameOrder = selectedGames.map((slug) => serializeMultiplayerSelection(slug));

    // Create lobby (we are the host) — start as 'live' so both go straight to the game
    const { data: lobby, error: lobbyError } = await supabase
      .from('multiplayer_lobbies')
      .insert({
        code,
        current_game_index: 0,
        game_order: gameOrder,
        host_id: user.id,
        max_players: 2,
        mode: 'duel',
        selected_games: selectedGames,
        status: 'live',
      })
      .select('id')
      .single();

    if (lobbyError || !lobby) {
      console.error('[duel] lobby insert failed', lobbyError?.message ?? 'no data', { code });
      return NextResponse.json({ error: 'Could not create a duel lobby.' }, { status: 500 });
    }

    // Seat ourselves in the lobby
    const { data: mySeat, error: seatSelfError } = await supabase
      .from('multiplayer_lobby_players')
      .insert({
        display_name: displayName,
        lobby_id: lobby.id,
        seat_index: 0,
        user_id: user.id,
      })
      .select('id')
      .single();

    if (seatSelfError || !mySeat) {
      console.error('[duel] seat self failed', seatSelfError?.message ?? 'no data', { lobbyId: lobby.id });
      await supabase.from('multiplayer_lobbies').delete().eq('id', lobby.id);
      return NextResponse.json({ error: 'Could not seat you in the duel lobby.' }, { status: 500 });
    }

    // Mark opponent's queue entry as matched with the lobby code
    const { error: markError } = await supabase
      .from('multiplayer_queue')
      .update({ status: 'matched', matched_code: code })
      .eq('id', opponent.id)
      .eq('queue_type', 'duel');

    if (markError) {
      console.warn('[duel] marking opponent as matched failed, retrying', markError.message, {
        opponentId: opponent.user_id,
      });
      await supabase.from('multiplayer_lobby_players').delete().eq('lobby_id', lobby.id);
      await supabase.from('multiplayer_lobbies').delete().eq('id', lobby.id);
      continue;
    }

    // Mark our own queue entry as matched
    await supabase
      .from('multiplayer_queue')
      .update({ status: 'matched', matched_code: code })
      .eq('user_id', user.id)
      .eq('queue_type', 'duel');

    // Build the first game URL and redirect the matcher directly to the game
    const gameUrl = buildFirstGameUrl(mySeat.id, code, gameOrder);
    if (!gameUrl) {
      console.error('[duel] could not build game URL');
      return NextResponse.json({ error: 'Could not start the duel game.' }, { status: 500 });
    }

    return NextResponse.json({ url: gameUrl }, { status: 200 });
  }

  // All retries exhausted — stay in queue
  const { count: queueCount } = await supabase
    .from('multiplayer_queue')
    .select('*', { count: 'exact', head: true })
    .eq('queue_type', 'duel')
    .eq('status', 'waiting');

  return NextResponse.json({ status: 'waiting', queueCount: queueCount ?? 0 }, { status: 200 });
}

// ─── GET: Poll queue status — auto-join and redirect to first game ───────

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  // Get current queue info for this user
  const { data: queueEntry } = await supabase
    .from('multiplayer_queue')
    .select('id, status, matched_code')
    .eq('user_id', user.id)
    .eq('queue_type', 'duel')
    .maybeSingle();

  // Check if we're already seated in a duel lobby
  const matchWindowStart = new Date(Date.now() - MATCH_WINDOW_MS).toISOString();
  const { data: seat } = await supabase
    .from('multiplayer_lobby_players')
    .select('id, joined_at, multiplayer_lobbies!inner(code, mode, game_order, status)')
    .eq('user_id', user.id)
    .eq('multiplayer_lobbies.mode', 'duel')
    .gte('joined_at', matchWindowStart)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seat?.multiplayer_lobbies?.code) {
    const lobbyData = seat.multiplayer_lobbies as { code: string; mode: string; game_order: string[]; status: string };

    // If already seated and the lobby is live, go straight to the first game
    if (lobbyData.status === 'live') {
      const gameUrl = buildFirstGameUrl(seat.id, lobbyData.code, lobbyData.game_order);
      if (gameUrl) {
        return NextResponse.json({ status: 'matched', url: gameUrl }, { status: 200 });
      }
    }

    // Otherwise send to lobby page
    return NextResponse.json({
      status: 'matched',
      url: `/party/${lobbyData.code}?mode=duel`,
    }, { status: 200 });
  }

  // If we have a matched_code but aren't seated yet, auto-join the lobby
  if (queueEntry?.status === 'matched' && queueEntry.matched_code) {
    const lobbyCode = queueEntry.matched_code;

    // Look up the lobby
    const { data: lobby } = await supabase
      .from('multiplayer_lobbies')
      .select('id, code, game_order, status')
      .eq('code', lobbyCode)
      .eq('mode', 'duel')
      .maybeSingle();

    if (lobby) {
      // Look up our display name
      const opponentDisplayName = await lookupDisplayName(supabase, user.id);

      // Insert ourselves into the lobby
      const { data: mySeat, error: joinError } = await supabase
        .from('multiplayer_lobby_players')
        .insert({
          display_name: opponentDisplayName,
          lobby_id: lobby.id,
          seat_index: 1,
          user_id: user.id,
        })
        .select('id')
        .single();

      if (!joinError && mySeat) {
        // Clear our queue entry
        await supabase
          .from('multiplayer_queue')
          .delete()
          .eq('id', queueEntry.id);

        // If lobby is already live, redirect straight to the first game
        if (lobby.status === 'live') {
          const gameUrl = buildFirstGameUrl(mySeat.id, lobby.code, lobby.game_order);
          if (gameUrl) {
            return NextResponse.json({ status: 'matched', url: gameUrl }, { status: 200 });
          }
        }

        // Otherwise send to lobby page
        return NextResponse.json({
          status: 'matched',
          url: `/party/${lobby.code}?mode=duel`,
        }, { status: 200 });
      }

      console.warn('[duel] auto-join failed', joinError?.message, { lobbyCode, userId: user.id });
    }
  }

  // No queue entry at all — cancelled
  if (!queueEntry) {
    const { count: queueCount } = await supabase
      .from('multiplayer_queue')
      .select('*', { count: 'exact', head: true })
      .eq('queue_type', 'duel')
      .eq('status', 'waiting');

    return NextResponse.json({ status: 'cancelled', queueCount: queueCount ?? 0 }, { status: 200 });
  }

  // Queue entry exists and is waiting — return queue count
  const { count: queueCount } = await supabase
    .from('multiplayer_queue')
    .select('*', { count: 'exact', head: true })
    .eq('queue_type', 'duel')
    .eq('status', 'waiting');

  return NextResponse.json({ status: 'waiting', queueCount: queueCount ?? 0 }, { status: 200 });
}

// ─── DELETE: Cancel queue ────────────────────────────────────────────────

export async function DELETE() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  await supabase
    .from('multiplayer_queue')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .eq('queue_type', 'duel')
    .eq('status', 'waiting');

  return NextResponse.json({ status: 'cancelled' }, { status: 200 });
}