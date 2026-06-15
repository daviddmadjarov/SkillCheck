import { NextResponse } from 'next/server';

import { createLobbyCode, serializeMultiplayerSelection } from '@/lib/multiplayer/catalog';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

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
    return; // profile already exists
  }

  const { error } = await supabase.from('profiles').insert({
    id: userId,
    skill_level: 'Candidate',
    username,
  });

  if (error) {
    // 23505 = unique violation (username taken) — retry with suffix
    if (error.code === '23505') {
      const { error: retryError } = await supabase.from('profiles').insert({
        id: userId,
        skill_level: 'Candidate',
        username: `${username}_${userId.slice(0, 4)}`,
      });
      if (retryError) {
        console.error('[party] profile retry insert failed', retryError);
        throw new Error(retryError.message);
      }
      return;
    }
    console.error('[party] profile insert failed', error);
    throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult, error: authError } = await supabase.auth.getUser();

  if (authError || !userResult?.user) {
    console.error('[party] auth error', authError);
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const user = userResult.user;

  // Parse request body
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const selectedGamesRaw = body.selectedGames;
  const selectedGames = Array.isArray(selectedGamesRaw)
    ? selectedGamesRaw.filter((slug): slug is string => typeof slug === 'string')
    : [];
  const maxPlayers = Math.floor(Number(body.maxPlayers));
  const gameConfigs =
    body.gameConfigs && typeof body.gameConfigs === 'object'
      ? (body.gameConfigs as Record<string, Record<string, string>>)
      : {};

  if (selectedGames.length < 1) {
    return NextResponse.json({ error: 'Select at least one game.' }, { status: 400 });
  }

  if (!Number.isFinite(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) {
    return NextResponse.json({ error: 'Max players must be between 2 and 10.' }, { status: 400 });
  }

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
    console.error('[party] ensureProfile failed', message);
    return NextResponse.json({ error: 'Could not create a party lobby.' }, { status: 500 });
  }

  // Create lobby
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
    .select('id, code')
    .single();

  if (lobbyError || !lobby) {
    console.error('[party] lobby insert failed', lobbyError?.message ?? 'no data', {
      code,
      hostId: user.id,
      maxPlayers,
      userId: user.id,
      hint: lobbyError?.hint,
      details: lobbyError?.details,
    });
    return NextResponse.json({ error: 'Could not create a party lobby.' }, { status: 500 });
  }

  // Insert host as first player
  const { error: playerError } = await supabase.from('multiplayer_lobby_players').insert({
    display_name: displayName,
    is_ready: false,
    lobby_id: lobby.id,
    score_total: 0,
    seat_index: 0,
    user_id: user.id,
  });

  if (playerError) {
    console.error('[party] player insert failed', playerError.message, {
      lobbyId: lobby.id,
      userId: user.id,
      hint: playerError.hint,
      details: playerError.details,
    });
    // Clean up the lobby
    await supabase.from('multiplayer_lobbies').delete().eq('id', lobby.id);
    return NextResponse.json({ error: 'Could not create a party lobby.' }, { status: 500 });
  }

  return NextResponse.json({ url: `/party/${lobby.code}` }, { status: 200 });
}