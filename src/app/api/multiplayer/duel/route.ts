import { NextResponse } from 'next/server';

import {
  createLobbyCode,
  getRandomMultiplayerGames,
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

// ─── POST: Enter the duel queue or find an opponent ──────────────────────

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

  // Retry loop to handle race conditions
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Look for an opponent waiting in the queue
    const { data: opponents } = await supabase
      .from('multiplayer_queue')
      .select('id, user_id')
      .eq('queue_type', 'duel')
      .eq('status', 'waiting')
      .neq('user_id', user.id)
      .order('requested_at', { ascending: true })
      .limit(1);

    const opponent = opponents?.[0] ?? null;

    if (opponent) {
      // ── Found an opponent! Try to create a lobby and seat both players ──
      // RLS prevents us from deleting/updating the opponent's queue entry,
      // but it allows us (as host) to seat them in a lobby.

      const code = createLobbyCode();
      const games = getRandomMultiplayerGames(DUEL_GAME_COUNT);
      const selectedGames = games.map((g) => g.slug);
      const gameOrder = selectedGames.map((slug) => serializeMultiplayerSelection(slug));

      // Create lobby (we are the host)
      const { data: lobby, error: lobbyError } = await supabase
        .from('multiplayer_lobbies')
        .insert({
          code,
          game_order: gameOrder,
          host_id: user.id,
          max_players: 2,
          mode: 'duel',
          selected_games: selectedGames,
        })
        .select('id')
        .single();

      if (lobbyError || !lobby) {
        console.error('[duel] lobby insert failed', lobbyError?.message ?? 'no data', { code });
        return NextResponse.json({ error: 'Could not create a duel lobby.' }, { status: 500 });
      }

      // Look up opponent's display name
      const opponentDisplayName = await lookupDisplayName(supabase, opponent.user_id);

      // Seat opponent first using "hosts can seat players" RLS policy
      const { error: seatOpponentError } = await supabase.from('multiplayer_lobby_players').insert({
        display_name: opponentDisplayName,
        lobby_id: lobby.id,
        seat_index: 0,
        user_id: opponent.user_id,
      });

      if (seatOpponentError) {
        console.error('[duel] seat opponent failed', seatOpponentError.message, { lobbyId: lobby.id });
        await supabase.from('multiplayer_lobbies').delete().eq('id', lobby.id);
        // Opponent might have been claimed already — retry
        continue;
      }

      // Seat ourselves using "users can join multiplayer lobbies" RLS policy
      const { error: seatSelfError } = await supabase.from('multiplayer_lobby_players').insert({
        display_name: displayName,
        lobby_id: lobby.id,
        seat_index: 1,
        user_id: user.id,
      });

      if (seatSelfError) {
        console.error('[duel] seat self failed', seatSelfError.message, { lobbyId: lobby.id });
        await supabase.from('multiplayer_lobbies').delete().eq('id', lobby.id);
        return NextResponse.json({ error: 'Could not seat duel players.' }, { status: 500 });
      }

      // Mark our own queue entry as matched
      await supabase
        .from('multiplayer_queue')
        .update({ status: 'matched', matched_code: code })
        .eq('user_id', user.id)
        .eq('queue_type', 'duel');

      // Clean up opponent's queue entry (this may fail RLS silently, but that's OK)
      await supabase
        .from('multiplayer_queue')
        .update({ status: 'matched', matched_code: code })
        .eq('user_id', opponent.user_id)
        .eq('queue_type', 'duel');

      return NextResponse.json({ url: `/party/${code}?mode=duel` }, { status: 200 });
    }

    // ── No opponent found ── Insert ourselves into the queue on last attempt
    if (attempt === 2) {
      const { data: existingEntry } = await supabase
        .from('multiplayer_queue')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('queue_type', 'duel')
        .maybeSingle();

      if (existingEntry) {
        // Already have an entry — refresh the timestamp (keep waiting status)
        await supabase
          .from('multiplayer_queue')
          .update({ requested_at: new Date().toISOString(), status: 'waiting', matched_code: null })
          .eq('id', existingEntry.id);
      } else {
        const { error: insertError } = await supabase.from('multiplayer_queue').insert({
          queue_type: 'duel',
          user_id: user.id,
        });

        if (insertError) {
          console.error('[duel] queue insert failed', insertError.message, { userId: user.id });
          return NextResponse.json({ error: 'Could not join the duel queue.' }, { status: 500 });
        }
      }
    }
  }

  return NextResponse.json({ status: 'waiting' }, { status: 200 });
}

// ─── GET: Poll queue status ──────────────────────────────────────────────

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  // 1) Check if we have a waiting queue entry
  const { data: queueEntry } = await supabase
    .from('multiplayer_queue')
    .select('id')
    .eq('user_id', user.id)
    .eq('queue_type', 'duel')
    .eq('status', 'waiting')
    .maybeSingle();

  // 2) Check if we're seated in a recent duel lobby
  const matchWindowStart = new Date(Date.now() - MATCH_WINDOW_MS).toISOString();
  const { data: seat } = await supabase
    .from('multiplayer_lobby_players')
    .select('joined_at, multiplayer_lobbies!inner(code, mode)')
    .eq('user_id', user.id)
    .eq('multiplayer_lobbies.mode', 'duel')
    .gte('joined_at', matchWindowStart)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seat?.multiplayer_lobbies?.code) {
    return NextResponse.json({
      status: 'matched',
      url: `/party/${seat.multiplayer_lobbies.code}?mode=duel`,
    }, { status: 200 });
  }

  if (!queueEntry) {
    return NextResponse.json({ status: 'cancelled' }, { status: 200 });
  }

  return NextResponse.json({ status: 'waiting' }, { status: 200 });
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