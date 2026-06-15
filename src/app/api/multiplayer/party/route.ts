import { NextResponse } from 'next/server';

import { createLobbyCode, serializeMultiplayerSelection } from '@/lib/multiplayer/catalog';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

function resolveDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  const userName = typeof metadata.user_name === 'string' ? metadata.user_name : null;
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : null;

  return userName ?? fullName ?? user.email?.split('@')[0] ?? 'Researcher';
}

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
        gameConfigs?: unknown;
        maxPlayers?: unknown;
        selectedGames?: unknown;
      }
    | null;

  const selectedGames = Array.isArray(body?.selectedGames)
    ? body.selectedGames.filter((slug): slug is string => typeof slug === 'string')
    : [];
  const maxPlayers = Math.floor(Number(body?.maxPlayers));
  const gameConfigs =
    body?.gameConfigs && typeof body.gameConfigs === 'object'
      ? (body.gameConfigs as Record<string, Record<string, string>>)
      : {};

  if (selectedGames.length < 1) {
    return NextResponse.json({ error: 'Select at least one game.' }, { status: 400 });
  }

  if (!Number.isFinite(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) {
    return NextResponse.json({ error: 'Max players must be between 2 and 10.' }, { status: 400 });
  }

  try {
    const code = createLobbyCode();
    const gameOrder = selectedGames.map((slug) => serializeMultiplayerSelection(slug, gameConfigs[slug]));

    const { data: lobby, error: lobbyError } = await supabase
      .from('multiplayer_lobbies')
      .insert({
        code,
        current_game_index: 0,
        game_order: gameOrder,
        host_id: user.id,
        max_players: maxPlayers,
        mode: 'party',
        selected_games: selectedGames,
        status: 'waiting',
      })
      .select('id')
      .single();

    if (lobbyError || !lobby) {
      return NextResponse.json({ error: 'Could not create a party lobby.' }, { status: 500 });
    }

    const displayName = resolveDisplayName(user);

    const { error: playerError } = await supabase.from('multiplayer_lobby_players').insert({
      display_name: displayName,
      is_ready: false,
      lobby_id: lobby.id,
      score_total: 0,
      seat_index: 0,
      user_id: user.id,
    });

    if (playerError) {
      return NextResponse.json({ error: 'Could not create a party lobby.' }, { status: 500 });
    }

    return NextResponse.json({ url: `/party/${code}` }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Could not create a party lobby.' }, { status: 500 });
  }
}
