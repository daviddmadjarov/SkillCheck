import { NextResponse } from 'next/server';

import {
  createLobbyCode,
  getMultiplayerGamesBySlug,
  getRandomMultiplayerGames,
  serializeMultiplayerSelection,
  shuffleMultiplayerGames,
} from '@/lib/multiplayer/catalog';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

function createPreferredDisplayName(email?: string | null, metadata?: Record<string, unknown>) {
  const options = [
    typeof metadata?.user_name === 'string' ? metadata.user_name : null,
    typeof metadata?.full_name === 'string' ? metadata.full_name : null,
    typeof email === 'string' ? email.split('@')[0] : null,
  ];

  const name = options.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? 'Host';
  return name.slice(0, 32);
}

function createFallbackUsername(userId: string, preferredDisplayName: string) {
  const candidates = [
    preferredDisplayName,
    'host',
  ];

  const base = (candidates.find((value) => typeof value === 'string' && value.trim().length > 0) ?? 'host')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 14);

  const seed = userId.replace(/-/g, '').slice(0, 6).toLowerCase();
  const username = `${base || 'host'}-${seed}`.slice(0, 24);
  return username.length >= 3 ? username : `host-${seed}`;
}

function sanitizeDisplayName(profileUsername: string | null | undefined, preferredDisplayName: string) {
  if (typeof profileUsername === 'string' && profileUsername.trim().length > 0 && !/-[0-9a-f]{6}$/i.test(profileUsername)) {
    return profileUsername.trim().slice(0, 32);
  }

  return preferredDisplayName;
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

  const metadata = (user.user_metadata as Record<string, unknown> | undefined) ?? undefined;
  const preferredDisplayName = createPreferredDisplayName(user.email, metadata);

  const fallbackUsername = createFallbackUsername(
    user.id,
    preferredDisplayName,
  );

  const { data: profileResult, error: profileLookupError } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  if (profileLookupError) {
    return NextResponse.json(
      { error: `Could not read player profile: ${profileLookupError.message}` },
      { status: 500 },
    );
  }

  if (!profileResult) {
    const { error: ensureProfileError } = await supabase.from('profiles').insert({
      avatar_url: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null,
      id: user.id,
      username: fallbackUsername,
    });

    if (ensureProfileError) {
      return NextResponse.json(
        { error: `Could not initialize player profile: ${ensureProfileError.message}` },
        { status: 500 },
      );
    }
  }

  const body = (await request.json().catch(() => null)) as
    | {
        gameConfigs?: unknown;
        maxPlayers?: unknown;
        selectedGames?: unknown;
      }
    | null;

  const selectedGames = Array.isArray(body?.selectedGames)
    ? body.selectedGames.filter((value): value is string => typeof value === 'string')
    : [];
  const maxPlayers = Number.isFinite(Number(body?.maxPlayers))
    ? Math.min(10, Math.max(2, Math.round(Number(body?.maxPlayers))))
    : 6;
  const rawGameConfigs =
    body?.gameConfigs && typeof body.gameConfigs === 'object' && !Array.isArray(body.gameConfigs)
      ? (body.gameConfigs as Record<string, unknown>)
      : {};

  const gameConfigs = Object.fromEntries(
    Object.entries(rawGameConfigs).map(([slug, value]) => {
      const nextConfig =
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value as Record<string, unknown>)
                .filter(([, optionValue]) => typeof optionValue === 'string')
                .map(([optionKey, optionValue]) => [optionKey, optionValue as string]),
            )
          : {};

      return [slug, nextConfig];
    }),
  ) as Record<string, Record<string, string>>;

  const chosenGames = selectedGames.length > 0 ? getMultiplayerGamesBySlug(selectedGames) : getRandomMultiplayerGames(4);
  const lobbyCode = createLobbyCode();
  const shuffledGames = shuffleMultiplayerGames(chosenGames);
  const serializedOrder = shuffledGames.map((game) => serializeMultiplayerSelection(game.slug, gameConfigs[game.slug]));

  const { data: lobby, error: lobbyError } = await supabase
    .from('multiplayer_lobbies')
    .insert({
      code: lobbyCode,
      current_game_index: 0,
      game_order: serializedOrder,
      host_id: user.id,
      max_players: maxPlayers,
      mode: 'party',
      selected_games: chosenGames.map((game) => game.slug),
      status: 'lobby',
    })
    .select('id, code')
    .maybeSingle();

  if (lobbyError || !lobby) {
    if (lobbyError?.message.includes("Could not find the table 'public.multiplayer_lobbies'")) {
      return NextResponse.json(
        {
          error:
            'Multiplayer tables are not deployed in Supabase yet. Run supabase/leaderboard-schema.sql in your Supabase SQL editor, then retry.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: `Could not create party lobby: ${lobbyError?.message ?? 'unknown error'}` },
      { status: 500 },
    );
  }

  const displayName = sanitizeDisplayName(profileResult?.username, preferredDisplayName);

  const { error: playerError } = await supabase.from('multiplayer_lobby_players').insert({
    display_name: displayName,
    is_ready: true,
    lobby_id: lobby.id,
    score_total: 0,
    user_id: user.id,
  });

  if (playerError) {
    return NextResponse.json(
      { error: `Could not register lobby host: ${playerError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, code: lobby.code, url: `/party/${lobby.code}` });
}
