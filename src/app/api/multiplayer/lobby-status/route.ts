import { NextRequest, NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/multiplayer/lobby-status?lobby=XYZ
 *
 * Lightweight endpoint that returns just the lobby status and game URL info.
 * Used by PartyAutoStart to detect when the host starts a party session.
 */
export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const lobbyCode = searchParams.get('lobby');

  if (!lobbyCode) {
    return NextResponse.json({ error: 'Missing lobby parameter.' }, { status: 400 });
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lobby } = await (supabase as any)
    .from('multiplayer_lobbies')
    .select('status, mode, game_order')
    .eq('code', lobbyCode)
    .maybeSingle();

  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found.' }, { status: 404 });
  }

  return NextResponse.json({
    status: lobby.status,
    mode: lobby.mode,
    hasGameOrder: Array.isArray(lobby.game_order) && lobby.game_order.length > 0,
  });
}