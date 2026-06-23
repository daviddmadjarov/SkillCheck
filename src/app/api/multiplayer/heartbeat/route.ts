import { NextRequest, NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/multiplayer/heartbeat
 *
 * Now simplified: only handles explicit player leave/disconnect.
 * Does NOT perform periodic AFK detection or forfeit checks.
 *
 * When a player leaves (close tab, navigate away, sign out):
 *   { lobbyCode: "...", leave: true }
 *
 * Sets the leaver as forfeited and awards victory to the opponent.
 * Idle players who are still on the page are NEVER forfeited.
 */
export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    lobbyCode?: string;
    leave?: boolean;
  } | null;

  const lobbyCode = body?.lobbyCode;
  if (!lobbyCode) {
    return NextResponse.json({ error: 'Missing lobby code.' }, { status: 400 });
  }

  // Look up lobby mode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lobbyInfo } = await (supabase as any)
    .from('multiplayer_lobbies')
    .select('mode')
    .eq('code', lobbyCode)
    .maybeSingle();

  const isMultiplayerLobby = lobbyInfo?.mode === 'duel' || lobbyInfo?.mode === 'party';

  // ── Player is leaving — forfeit for any multiplayer lobby (duel or party) ──
  if (body?.leave) {
    if (!isMultiplayerLobby) {
      return NextResponse.json({ action: 'left' }, { status: 200 });
    }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: leaveResult, error: leaveError } = await (supabase.rpc as any)('process_duel_forfeit', {
        p_lobby_code: lobbyCode,
        p_checking_user_id: null,
        p_leaving_user_id: user.id,
      });

    if (leaveError) {
      return NextResponse.json({ action: 'left' }, { status: 200 });
    }

    return NextResponse.json(leaveResult, { status: 200 });
  }

  // ── Normal heartbeat keepalive (no forfeit checking) ──
  // Just confirm the player is still present. Never auto-forfeit.
  return NextResponse.json({ action: 'heartbeat_ok' }, { status: 200 });
}