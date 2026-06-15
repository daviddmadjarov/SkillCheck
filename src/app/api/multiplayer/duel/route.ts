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

/** Ensure the auth user has a matching row in `public.profiles`. Throws on error. */
async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  username: string,
) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { error } = await supabase.from('profiles').insert({
    id: userId,
    skill_level: 'Candidate',
    username,
  });

  if (error) {
    if (error.code === '23505') {
      const { error: retryError } = await supabase.from('profiles').insert({
        id: userId,
        skill_level: 'Candidate',
        username: `${username}_${userId.slice(0, 4)}`,
      });
      if (retryError) {
        throw new Error(retryError.message);
      }
      return;
    }
    throw new Error(error.message);
  }
}

/** Look up a user's display name from their auth metadata. */
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

/** Fetch display name from the profiles table for a given user id. */
async function lookupDisplayName(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  return data?.username ?? `Player_${userId.slice(0, 6)}`;
}

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult, error: authError } = await supabase.auth.getUser();

  if (authError || !userResult?.user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const user = userResult.user;
  const displayName = getDisplayName(user);

  // Ensure profile exists
  try {
    await ensureProfile(supabase, user.id, displayName);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown profile error';
    console.error('[duel] ensureProfile failed', message);
    return NextResponse.json({ error: 'Could not start a duel.' }, { status: 500 });
  }

  // Try up to 3 times to find an opponent using the existing multiplayer_queue table
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: waitingEntries } = await supabase
      .from('multiplayer_queue')
      .select('id, user_id')
      .eq('queue_type', 'duel')
      .eq('status', 'waiting')
      .neq('user_id', user.id)
      .order('requested_at', { ascending: true })
      .limit(1);

    const opponent = waitingEntries?.[0] ?? null;

    if (opponent) {
      // Atomically claim the opponent's queue entry
      const { data: deleted } = await supabase
        .from('multiplayer_queue')
        .delete()
        .eq('id', opponent.id)
        .eq('status', 'waiting')
        .select('user_id');

      if (!deleted || deleted.length === 0) {
        // Opponent was already claimed — retry
        continue;
      }

      // Delete our own queue entry if we had one
      await supabase
        .from('multiplayer_queue')
        .delete()
        .eq('user_id', user.id)
        .eq('queue_type', 'duel');

      // Look up opponent's display name from profiles
      const opponentDisplayName = await lookupDisplayName(supabase, opponent.user_id);

      // Create lobby with status 'waiting' (only value the DB constraint allows)
      const code = createLobbyCode();
      const games = getRandomMultiplayerGames(DUEL_GAME_COUNT);
      const selectedGames = games.map((g) => g.slug);
      const gameOrder = selectedGames.map((slug) => serializeMultiplayerSelection(slug));

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

      // Mark opponent's queue entry as matched
      await supabase
        .from('multiplayer_queue')
        .update({ status: 'matched', matched_code: code })
        .eq('user_id', opponent.user_id)
        .eq('queue_type', 'duel');

      // Seat both players
      const { error: playersError } = await supabase.from('multiplayer_lobby_players').insert([
        { display_name: opponentDisplayName, lobby_id: lobby.id, seat_index: 0, user_id: opponent.user_id },
        { display_name: displayName, lobby_id: lobby.id, seat_index: 1, user_id: user.id },
      ]);

      if (playersError) {
        console.error('[duel] players insert failed', playersError.message, { lobbyId: lobby.id });
        // Clean up lobby
        await supabase.from('multiplayer_lobbies').delete().eq('id', lobby.id);
        return NextResponse.json({ error: 'Could not seat duel players.' }, { status: 500 });
      }

      return NextResponse.json({ url: `/party/${code}?mode=duel` }, { status: 200 });
    }

    // No opponent this attempt — insert into queue on final attempt
    if (attempt === 2) {
      const { error: queueError } = await supabase.from('multiplayer_queue').upsert(
        {
          queue_type: 'duel',
          requested_at: new Date().toISOString(),
          status: 'waiting',
          user_id: user.id,
        },
        { onConflict: 'user_id, queue_type' },
      );

      if (queueError) {
        console.error('[duel] queue insert failed', queueError.message, { userId: user.id });
        return NextResponse.json({ error: 'Could not join the duel queue.' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ status: 'waiting' }, { status: 200 });
}

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  // Check if user is still in the queue
  const { data: queueEntry } = await supabase
    .from('multiplayer_queue')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('queue_type', 'duel')
    .eq('status', 'waiting')
    .maybeSingle();

  const matchWindowStart = new Date(Date.now() - MATCH_WINDOW_MS).toISOString();

  // Check if the user has been seated in a duel lobby
  const { data: seat } = await supabase
    .from('multiplayer_lobby_players')
    .select('joined_at, multiplayer_lobbies!inner(code, mode, status)')
    .eq('user_id', user.id)
    .eq('multiplayer_lobbies.mode', 'duel')
    .eq('multiplayer_lobbies.status', 'waiting')
    .gte('joined_at', matchWindowStart)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lobbyCode = seat?.multiplayer_lobbies?.code ?? null;

  if (lobbyCode) {
    return NextResponse.json({ status: 'matched', url: `/party/${lobbyCode}?mode=duel` }, { status: 200 });
  }

  if (!queueEntry) {
    return NextResponse.json({ status: 'cancelled' }, { status: 200 });
  }

  return NextResponse.json({ status: 'waiting' }, { status: 200 });
}

export async function DELETE() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  await supabase
    .from('multiplayer_queue')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .eq('queue_type', 'duel')
    .eq('status', 'waiting');

  return NextResponse.json({ status: 'cancelled' }, { status: 200 });
}