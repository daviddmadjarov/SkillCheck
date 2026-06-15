import { NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

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
        console.error('Join profile create retry failed for', userId, retryError);
      }
    } else {
      console.error('Join profile upsert failed for', userId, upsertError);
    }
  }
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

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const joinCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

  if (joinCode.length < 4) {
    return NextResponse.json({ error: 'Invalid lobby code.' }, { status: 400 });
  }

  const displayName = safeDisplayName(resolveDisplayName(user));

  // Ensure the user has a profile row before any FK-dependent operations
  await ensureProfile(supabase, user.id, displayName);

  // Load the lobby
  const { data: lobby, error: lobbyError } = await supabase
    .from('multiplayer_lobbies')
    .select('id, code, max_players, mode, status')
    .eq('code', joinCode)
    .maybeSingle();

  if (lobbyError || !lobby) {
    return NextResponse.json({ error: 'Lobby not found.' }, { status: 404 });
  }

  if (lobby.status !== 'waiting') {
    return NextResponse.json({ error: 'This lobby is no longer accepting players.' }, { status: 410 });
  }

  // Check if the user is already in this lobby
  const { data: existingMembership } = await supabase
    .from('multiplayer_lobby_players')
    .select('id')
    .eq('lobby_id', lobby.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMembership) {
    return NextResponse.json({ url: `/party/${lobby.code}${lobby.mode === 'duel' ? '?mode=duel' : ''}` }, { status: 200 });
  }

  // Count current players
  const { data: currentPlayers } = await supabase
    .from('multiplayer_lobby_players')
    .select('id', { count: 'exact', head: true })
    .eq('lobby_id', lobby.id);

  const playerCount = currentPlayers?.length ?? 0;
  if (playerCount >= lobby.max_players) {
    return NextResponse.json({ error: 'Lobby is full.' }, { status: 410 });
  }

  // Determine the next seat index
  const { data: existingPlayers } = await supabase
    .from('multiplayer_lobby_players')
    .select('seat_index')
    .eq('lobby_id', lobby.id)
    .order('seat_index', { ascending: true, nullsFirst: true });

  const usedSeats = new Set((existingPlayers ?? []).map((p) => p.seat_index));
  let nextSeat = playerCount;
  for (let i = 0; i < lobby.max_players; i += 1) {
    if (!usedSeats.has(i)) {
      nextSeat = i;
      break;
    }
  }

  const { error: joinError } = await supabase.from('multiplayer_lobby_players').insert({
    display_name: displayName,
    is_ready: false,
    lobby_id: lobby.id,
    score_total: 0,
    seat_index: nextSeat,
    user_id: user.id,
  });

  if (joinError) {
    console.error('Join lobby insert failed:', joinError.message, { lobbyId: lobby.id, userId: user.id });
    return NextResponse.json({ error: 'Could not join lobby.' }, { status: 500 });
  }

  return NextResponse.json({ url: `/party/${lobby.code}${lobby.mode === 'duel' ? '?mode=duel' : ''}` }, { status: 200 });
}