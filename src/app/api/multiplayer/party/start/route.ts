import { NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

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
  const lobbyCode = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';

  if (lobbyCode.length < 4) {
    return NextResponse.json({ error: 'Invalid lobby code.' }, { status: 400 });
  }

  const { data: lobby } = await supabase
    .from('multiplayer_lobbies')
    .select('id, code, host_id, status')
    .eq('code', lobbyCode)
    .maybeSingle();

  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found.' }, { status: 404 });
  }

  if (lobby.host_id !== user.id) {
    return NextResponse.json({ error: 'Only the host can start the session.' }, { status: 403 });
  }

  if (lobby.status !== 'waiting' && lobby.status !== 'lobby') {
    return NextResponse.json({ error: 'Session has already started or finished.' }, { status: 410 });
  }

  const { error: updateError } = await supabase
    .from('multiplayer_lobbies')
    .update({ status: 'live', updated_at: new Date().toISOString() })
    .eq('id', lobby.id);

  if (updateError) {
    console.error('Start session failed:', updateError.message, { lobbyId: lobby.id });
    return NextResponse.json({ error: 'Could not start session.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}