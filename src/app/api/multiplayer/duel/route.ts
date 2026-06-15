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

function resolveDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  const userName = typeof metadata.user_name === 'string' ? metadata.user_name : null;
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : null;

  return userName ?? fullName ?? user.email?.split('@')[0] ?? 'Researcher';
}

function safeDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < 3) return `User_${trimmed}`;
  if (trimmed.length > 24) return trimmed.slice(0, 24);
  return trimmed;
}

async function ensureProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, displayName: string) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    return;
  }

  const safeName = safeDisplayName(displayName);

  const { error: upsertError } = await supabase.from('profiles').upsert({
    id: userId,
    skill_level: 'Candidate',
    username: safeName,
  }).maybeSingle();

  if (upsertError) {
    if (upsertError.code === '23505') {
      const { error: retryError } = await supabase.from('profiles').insert({
        id: userId,
        skill_level: 'Candidate',
        username: `${safeName}_${userId.slice(0, 4)}`,
      }).maybeSingle();

      if (retryError) {
        console.error('Duel profile create retry failed for', userId, retryError);
      }
    } else {
      console.error('Duel profile upsert failed for', userId, upsertError);
    }
  }
}

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const displayName = safeDisplayName(resolveDisplayName(user));

  // Ensure the user has a profile row before any FK-dependent operations
  await ensureProfile(supabase, user.id, displayName);

  const { data: waitingEntries } = await supabase
    .from('multiplayer_duel_queue')
    .select('id, user_id, display_name')
    .neq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  const opponent = waitingEntries?.[0] ?? null;

  if (opponent) {
    await supabase
      .from('multiplayer_duel_queue')
      .delete()
      .in('user_id', [user.id, opponent.user_id]);

    const code = createLobbyCode();
    const games = getRandomMultiplayerGames(DUEL_GAME_COUNT);
    const selectedGames = games.map((game) => game.slug);
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
        status: 'waiting',
      })
      .select('id')
      .single();

    if (lobbyError || !lobby) {
      console.error('Duel lobby insert failed:', lobbyError?.message ?? 'no data returned', { code, mode: 'duel' });
      return NextResponse.json({ error: 'Could not create a duel lobby.' }, { status: 500 });
    }

    const { error: playersError } = await supabase.from('multiplayer_lobby_players').insert([
      {
        display_name: opponent.display_name,
        lobby_id: lobby.id,
        seat_index: 0,
        user_id: opponent.user_id,
      },
      {
        display_name: displayName,
        lobby_id: lobby.id,
        seat_index: 1,
        user_id: user.id,
      },
    ]);

    if (playersError) {
      console.error('Duel players insert failed:', playersError.message, { lobbyId: lobby.id });
      return NextResponse.json({ error: 'Could not seat duel players.' }, { status: 500 });
    }

    return NextResponse.json({ url: `/party/${code}?mode=duel` }, { status: 200 });
  }

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
    console.error('Duel queue insert failed:', queueError.message, { userId: user.id });
    return NextResponse.json({ error: 'Could not join the duel queue.' }, { status: 500 });
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

  // First check if user is still in the queue
  const { data: queueEntry } = await supabase
    .from('multiplayer_duel_queue')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const matchWindowStart = new Date(Date.now() - MATCH_WINDOW_MS).toISOString();

  // Check if the user has been seated in a duel lobby (by the opponent's POST)
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

  // If the user is no longer in the queue but hasn't been matched, something is inconsistent
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