// Run this SQL in the Supabase SQL editor to create the duel matchmaking queue:
//
// create table if not exists public.multiplayer_duel_queue (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid not null references auth.users (id) on delete cascade,
//   display_name text not null,
//   created_at timestamptz not null default now(),
//   unique (user_id)
// );
//
// alter table public.multiplayer_duel_queue enable row level security;
//
// -- Authenticated users can read the queue so they can find an opponent.
// drop policy if exists "duel queue is readable by authenticated users" on public.multiplayer_duel_queue;
// create policy "duel queue is readable by authenticated users"
//   on public.multiplayer_duel_queue
//   for select
//   using (auth.role() = 'authenticated');
//
// drop policy if exists "users can queue themselves for duels" on public.multiplayer_duel_queue;
// create policy "users can queue themselves for duels"
//   on public.multiplayer_duel_queue
//   for insert
//   with check (auth.uid() = user_id);
//
// drop policy if exists "users can update their duel queue row" on public.multiplayer_duel_queue;
// create policy "users can update their duel queue row"
//   on public.multiplayer_duel_queue
//   for update
//   using (auth.uid() = user_id)
//   with check (auth.uid() = user_id);
//
// -- The matched player removes both queue entries, so any authenticated user may delete.
// drop policy if exists "authenticated users can clear duel queue rows" on public.multiplayer_duel_queue;
// create policy "authenticated users can clear duel queue rows"
//   on public.multiplayer_duel_queue
//   for delete
//   using (auth.role() = 'authenticated');

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

  const displayName = resolveDisplayName(user);

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

  const matchWindowStart = new Date(Date.now() - MATCH_WINDOW_MS).toISOString();

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
