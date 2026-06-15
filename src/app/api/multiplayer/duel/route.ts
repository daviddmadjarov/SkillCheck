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
      // unique violation — retry with suffix
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

  // Resolve display name
  const metadata = user.user_metadata ?? {};
  const rawName =
    (typeof metadata.user_name === 'string' ? metadata.user_name : null) ??
    (typeof metadata.full_name === 'string' ? metadata.full_name : null) ??
    user.email?.split('@')[0] ??
    'Researcher';

  const displayName = (() => {
    const trimmed = rawName.trim();
    if (trimmed.length < 3) return `User_${trimmed}`;
    if (trimmed.length > 24) return trimmed.slice(0, 24);
    return trimmed;
  })();

  // Ensure profile exists
  try {
    await ensureProfile(supabase, user.id, displayName);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown profile error';
    console.error('[duel] ensureProfile failed', message);
    return NextResponse.json({ error: 'Could not start a duel.' }, { status: 500 });
  }

  // Try up to 3 times to find an opponent
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: waitingEntries } = await supabase
      .from('multiplayer_duel_queue')
      .select('id, user_id, display_name')
      .neq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    const opponent = waitingEntries?.[0] ?? null;

    if (opponent) {
      // Atomically claim both users from the queue
      const { data: deleted } = await supabase
        .from('multiplayer_duel_queue')
        .delete()
        .in('user_id', [user.id, opponent.user_id])
        .select('user_id');

      const deletedIds = new Set((deleted ?? []).map((r) => r.user_id));
      if (!deletedIds.has(opponent.user_id) || !deletedIds.has(user.id)) {
        // Opponent was already claimed — re-insert ourselves if needed and retry
        if (!deletedIds.has(user.id)) {
          await supabase
            .from('multiplayer_duel_queue')
            .upsert(
              { created_at: new Date().toISOString(), display_name: displayName, user_id: user.id },
              { onConflict: 'user_id' },
            );
        }
        continue;
      }

      // Create lobby
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
          status: 'lobby',
        })
        .select('id')
        .single();

      if (lobbyError || !lobby) {
        console.error('[duel] lobby insert failed', lobbyError?.message ?? 'no data', { code });
        return NextResponse.json({ error: 'Could not create a duel lobby.' }, { status: 500 });
      }

      // Seat both players
      const { error: playersError } = await supabase.from('multiplayer_lobby_players').insert([
        { display_name: opponent.display_name, lobby_id: lobby.id, seat_index: 0, user_id: opponent.user_id },
        { display_name: displayName, lobby_id: lobby.id, seat_index: 1, user_id: user.id },
      ]);

      if (playersError) {
        console.error('[duel] players insert failed', playersError.message, { lobbyId: lobby.id });
        return NextResponse.json({ error: 'Could not seat duel players.' }, { status: 500 });
      }

      return NextResponse.json({ url: `/party/${code}?mode=duel` }, { status: 200 });
    }

    // No opponent this attempt — insert into queue on final attempt
    if (attempt === 2) {
      const { error: queueError } = await supabase
        .from('multiplayer_duel_queue')
        .upsert(
          {
            created_at: new Date().toISOString(),
            display_name: displayName,
            user_id: user.id,
          },
          { onConflict: 'user_id' },
        );

      if (queueError) {
        console.error('[duel] queue insert failed', queueError.message);
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
    .from('multiplayer_duel_queue')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const matchWindowStart = new Date(Date.now() - MATCH_WINDOW_MS).toISOString();

  // Check if the user has been seated in a duel lobby
  const { data: seat } = await supabase
    .from('multiplayer_lobby_players')
    .select('joined_at, multiplayer_lobbies!inner(code, mode, status)')
    .eq('user_id', user.id)
    .eq('multiplayer_lobbies.mode', 'duel')
    .eq('multiplayer_lobbies.status', 'lobby')
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

  await supabase.from('multiplayer_duel_queue').delete().eq('user_id', user.id);

  return NextResponse.json({ status: 'cancelled' }, { status: 200 });
}