import { NextRequest, NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/multiplayer/heartbeat
 *
 * Called by MultiplayerSessionGuard every 10 seconds during a duel.
 * Updates the player's last_heartbeat_at timestamp and checks for
 * forfeits from the opponent.
 *
 * If the opponent has been absent for >30 seconds, the forfeit is
 * processed server-side and the caller receives a forfeit notification.
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
  } | null;

  const lobbyCode = body?.lobbyCode;
  if (!lobbyCode) {
    return NextResponse.json({ error: 'Missing lobby code.' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase.rpc as any)('process_duel_forfeit', {
    p_lobby_code: lobbyCode,
    p_checking_user_id: user.id,
  });

  if (error) {
    // Function might not exist yet — silently succeed
    if (error.message?.includes('Could not find the function')) {
      return NextResponse.json({ action: 'heartbeat_ok' }, { status: 200 });
    }
    return NextResponse.json({ error: 'Heartbeat failed.' }, { status: 500 });
  }

  const data = result as {
    action?: string;
    winner_user_id?: string;
    winner_display_name?: string;
    loser_display_name?: string;
    elo_result?: { winner_new_elo?: number; loser_new_elo?: number; elo_delta?: number };
  };

  return NextResponse.json({
    action: data.action ?? 'heartbeat_ok',
    eloDelta: data.elo_result?.elo_delta,
    eloResult: data.elo_result,
    forfeited: data.action === 'forfeited',
    loserDisplayName: data.loser_display_name,
    winnerDisplayName: data.winner_display_name,
    winnerUserId: data.winner_user_id,
  }, { status: 200 });
}