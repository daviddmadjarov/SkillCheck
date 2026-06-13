import { NextResponse } from 'next/server';

import { createLobbyCode, getRandomMultiplayerGames } from '@/lib/multiplayer/catalog';
import { createAdminClient, hasSupabaseServiceRoleEnv } from '@/lib/supabase/admin';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

function createPreferredDisplayName(email?: string | null, metadata?: Record<string, unknown>) {
  const options = [
    typeof metadata?.user_name === 'string' ? metadata.user_name : null,
    typeof metadata?.full_name === 'string' ? metadata.full_name : null,
    typeof email === 'string' ? email.split('@')[0] : null,
  ];

  const name = options.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() ?? 'Player';
  return name.slice(0, 32);
}

function createFallbackUsername(userId: string, preferredDisplayName: string) {
  const candidates = [
    preferredDisplayName,
    'player',
  ];

  const base = (candidates.find((value) => typeof value === 'string' && value.trim().length > 0) ?? 'player')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 14);

  const seed = userId.replace(/-/g, '').slice(0, 6).toLowerCase();
  const username = `${base || 'player'}-${seed}`.slice(0, 24);
  return username.length >= 3 ? username : `player-${seed}`;
}

function sanitizeDisplayName(profileUsername: string | null | undefined, preferredDisplayName: string) {
  if (typeof profileUsername === 'string' && profileUsername.trim().length > 0 && !/-[0-9a-f]{6}$/i.test(profileUsername)) {
    return profileUsername.trim().slice(0, 32);
  }

  return preferredDisplayName;
}

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json(
      {
        error:
          'Missing SUPABASE_SERVICE_ROLE_KEY. Set it on the server so duel matchmaking can update both players safely.',
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const admin = createAdminClient();
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

  const displayName = sanitizeDisplayName(profileResult?.username, preferredDisplayName);

  const { data: activeQueueRows, error: activeQueueError } = await supabase
    .from('multiplayer_queue')
    .select('id, matched_code, status')
    .eq('user_id', user.id)
    .in('status', ['waiting', 'matched'])
    .order('requested_at', { ascending: false })
    .limit(1);

  if (activeQueueError) {
    return NextResponse.json(
      { error: `Could not access duel queue: ${activeQueueError.message}` },
      { status: 500 },
    );
  }

  const activeQueue = activeQueueRows?.[0] ?? null;

  if (activeQueue?.status === 'matched' && activeQueue.matched_code) {
    return NextResponse.json({ ok: true, status: 'matched', url: `/party/${activeQueue.matched_code}?mode=duel` });
  }

  let currentQueueId = activeQueue?.id ?? null;
  if (!currentQueueId) {
    const { data: queueInsert, error: queueInsertError } = await supabase
      .from('multiplayer_queue')
      .insert({ queue_type: 'duel', status: 'waiting', user_id: user.id })
      .select('id')
      .maybeSingle();

    if (queueInsertError || !queueInsert) {
      return NextResponse.json(
        { error: `Could not join duel queue: ${queueInsertError?.message ?? 'unknown error'}` },
        { status: 500 },
      );
    }

    currentQueueId = queueInsert.id;
  }

  const { data: opponentRows, error: opponentQueueError } = await supabase
    .from('multiplayer_queue')
    .select('id, user_id')
    .eq('status', 'waiting')
    .neq('user_id', user.id)
    .order('requested_at', { ascending: true })
    .limit(1);

  if (opponentQueueError) {
    return NextResponse.json(
      { error: `Could not find a duel opponent: ${opponentQueueError.message}` },
      { status: 500 },
    );
  }

  const opponentQueue = opponentRows?.[0] ?? null;
  if (!opponentQueue) {
    return NextResponse.json({ ok: true, status: 'waiting' });
  }

  const games = getRandomMultiplayerGames(4);
  const lobbyCode = createLobbyCode();

  const { data: lobby, error: lobbyError } = await supabase
    .from('multiplayer_lobbies')
    .insert({
      code: lobbyCode,
      current_game_index: 0,
      game_order: games.map((game) => game.slug),
      host_id: user.id,
      max_players: 2,
      mode: 'duel',
      selected_games: games.map((game) => game.slug),
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
      { error: `Could not create duel lobby: ${lobbyError?.message ?? 'unknown error'}` },
      { status: 500 },
    );
  }

  const { data: opponentProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', opponentQueue.user_id)
    .maybeSingle();

  const opponentDisplayName = sanitizeDisplayName(
    opponentProfile?.username,
    'Opponent',
  );

  const { error: playerError } = await admin.from('multiplayer_lobby_players').insert([
    {
      display_name: displayName,
      is_ready: true,
      lobby_id: lobby.id,
      score_total: 0,
      user_id: user.id,
    },
    {
      display_name: opponentDisplayName,
      is_ready: true,
      lobby_id: lobby.id,
      score_total: 0,
      user_id: opponentQueue.user_id,
    },
  ]);

  if (playerError) {
    return NextResponse.json(
      { error: `Could not register duel host: ${playerError.message}` },
      { status: 500 },
    );
  }

  const { error: queueUpdateError } = await admin
    .from('multiplayer_queue')
    .update({ matched_code: lobby.code, status: 'matched' })
    .in('id', [currentQueueId, opponentQueue.id]);

  if (queueUpdateError) {
    return NextResponse.json(
      { error: `Could not finalize duel match: ${queueUpdateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, status: 'matched', url: `/party/${lobby.code}?mode=duel` });
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

  const { data: queueRows, error: queueError } = await supabase
    .from('multiplayer_queue')
    .select('matched_code, status')
    .eq('user_id', user.id)
    .in('status', ['waiting', 'matched'])
    .order('requested_at', { ascending: false })
    .limit(1);

  if (queueError) {
    return NextResponse.json({ error: `Could not read duel queue: ${queueError.message}` }, { status: 500 });
  }

  const queue = queueRows?.[0] ?? null;
  if (!queue) {
    return NextResponse.json({ ok: true, status: 'idle' });
  }

  if (queue.status === 'matched' && queue.matched_code) {
    return NextResponse.json({ ok: true, status: 'matched', url: `/party/${queue.matched_code}?mode=duel` });
  }

  return NextResponse.json({ ok: true, status: 'waiting' });
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

  const { error } = await supabase
    .from('multiplayer_queue')
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .eq('status', 'waiting');

  if (error) {
    return NextResponse.json({ error: `Could not cancel duel queue: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
