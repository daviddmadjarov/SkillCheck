import { NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

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

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult, error: authError } = await supabase.auth.getUser();

  if (authError || !userResult?.user) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const user = userResult.user;

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const joinCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

  if (joinCode.length < 4) {
    return NextResponse.json({ error: 'Invalid lobby code.' }, { status: 400 });
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
    console.error('[join] ensureProfile failed', message);
    return NextResponse.json({ error: 'Could not join lobby.' }, { status: 500 });
  }

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

  // Check if user is already in this lobby
  const { data: existingMembership } = await supabase
    .from('multiplayer_lobby_players')
    .select('id')
    .eq('lobby_id', lobby.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMembership) {
    return NextResponse.json(
      { url: `/party/${lobby.code}${lobby.mode === 'duel' ? '?mode=duel' : ''}` },
      { status: 200 },
    );
  }

  // Count current players
  const { count: playerCount } = await supabase
    .from('multiplayer_lobby_players')
    .select('*', { count: 'exact', head: true })
    .eq('lobby_id', lobby.id);

  if (playerCount !== null && playerCount >= lobby.max_players) {
    return NextResponse.json({ error: 'Lobby is full.' }, { status: 410 });
  }

  // Find next open seat
  const { data: existingPlayers } = await supabase
    .from('multiplayer_lobby_players')
    .select('seat_index')
    .eq('lobby_id', lobby.id)
    .order('seat_index', { ascending: true, nullsFirst: true });

  const usedSeats = new Set((existingPlayers ?? []).map((p) => p.seat_index));
  let nextSeat = playerCount ?? 0;
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
    console.error('[join] insert failed', joinError.message, {
      lobbyId: lobby.id,
      userId: user.id,
      hint: joinError.hint,
      details: joinError.details,
    });
    return NextResponse.json({ error: 'Could not join lobby.' }, { status: 500 });
  }

  return NextResponse.json(
    { url: `/party/${lobby.code}${lobby.mode === 'duel' ? '?mode=duel' : ''}` },
    { status: 200 },
  );
}