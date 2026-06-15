import { NextResponse } from 'next/server';

import {
  buildMultiplayerSessionHref,
  getMultiplayerGame,
  getRandomMultiplayerGames,
  parseMultiplayerSelectionToken,
  serializeMultiplayerSelection,
} from '@/lib/multiplayer/catalog';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

const DUEL_GAME_COUNT = 4;

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  const rawName =
    (typeof metadata.user_name === 'string' ? metadata.user_name : null) ??
    (typeof metadata.full_name === 'string' ? metadata.full_name : null) ??
    user.email?.split('@')[0] ??
    'Researcher';
  const trimmed = rawName.trim();
  if (trimmed.length < 3) return `User_${trimmed}`;
  if (trimmed.length > 24) return trimmed.slice(0, 24);
  return trimmed;
}

async function ensureProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, username: string) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from('profiles').insert({ id: userId, skill_level: 'Candidate', username });

  if (error) {
    if (error.code === '23505') {
      const { error: retryError } = await supabase.from('profiles').insert({
        id: userId,
        skill_level: 'Candidate',
        username: `${username}_${userId.slice(0, 4)}`,
      });
      if (retryError) throw new Error(retryError.message);
      return;
    }
    throw new Error(error.message);
  }
}

/**
 * Generate the randomized game order and store it on the lobby.
 * Called once after a match is created.
 */
async function assignGamesToLobby(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lobbyCode: string,
): Promise<string[]> {
  const games = getRandomMultiplayerGames(DUEL_GAME_COUNT);
  const selectedGames = games.map((g) => g.slug);
  const gameOrder = selectedGames.map((slug) => serializeMultiplayerSelection(slug));

  await supabase
    .from('multiplayer_lobbies')
    .update({
      game_order: gameOrder,
      selected_games: selectedGames,
    })
    .eq('code', lobbyCode)
    .eq('mode', 'duel');

  return gameOrder;
}

function buildGameUrl(playerId: string, lobbyCode: string, gameOrder: string[]): string | null {
  const slug = gameOrder[0] ?? null;
  if (!slug) return null;
  return buildMultiplayerSessionHref(parseMultiplayerSelectionToken(slug), {
    lobbyCode,
    playerId,
    round: 0,
  });
}

// ─── POST: Queue for duel or trigger matchmaking ───────────────────────

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const displayName = getDisplayName(user);

  try {
    await ensureProfile(supabase, user.id, displayName);
  } catch (err) {
    console.error('[duel] ensureProfile failed', err);
    return NextResponse.json({ error: 'Could not start a duel.' }, { status: 500 });
  }

  // ── Call the atomic matchmaking RPC ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('atomic_matchmake_duel', {
    p_user_id: user.id,
    p_display_name: displayName,
  });

  if (rpcError) {
    console.error('[duel] atomic_matchmake_duel RPC failed', rpcError.message, { userId: user.id });
    return NextResponse.json({ error: 'Could not join the duel queue.' }, { status: 500 });
  }

  const result = rpcResult as {
    action: string;
    status: string;
    lobby_code?: string;
    player_id?: string;
    opponent_id?: string;
    opponent_name?: string;
  };

  // ── If matched: assign games to the lobby and redirect ──
  if (result.action === 'matched' && result.lobby_code && result.player_id) {
    const gameOrder = await assignGamesToLobby(supabase, result.lobby_code);
    const gameUrl = buildGameUrl(result.player_id, result.lobby_code, gameOrder);

    if (!gameUrl) {
      return NextResponse.json({ error: 'Could not start the duel game.' }, { status: 500 });
    }

    return NextResponse.json({
      lobbyCode: result.lobby_code,
      opponentName: result.opponent_name ?? 'Unknown',
      status: 'matched',
      url: gameUrl,
    }, { status: 200 });
  }

  // ── Already waiting or newly queued ──
  return NextResponse.json({ status: 'waiting' }, { status: 200 });
}

// ─── GET: Poll queue status — discover match, get live stats ──────────

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  // ── Fetch live stats ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stats } = await (supabase.rpc as any)('get_duel_queue_stats');
  const statsData = (stats ?? {}) as { waiting?: number; playing?: number };

  // ── Check our queue status ──
  const { data: queueEntry } = await supabase
    .from('multiplayer_queue')
    .select('id, status, matched_code')
    .eq('user_id', user.id)
    .eq('queue_type', 'duel')
    .maybeSingle();

  // ── If matched: find our seat and redirect ──
  if (queueEntry?.status === 'matched' && queueEntry.matched_code) {
    const lobbyCode = queueEntry.matched_code;

    // Find our seat in the lobby
    const { data: lobby } = await supabase
      .from('multiplayer_lobbies')
      .select('id, code, game_order, status')
      .eq('code', lobbyCode)
      .eq('mode', 'duel')
      .maybeSingle();

    if (lobby) {
      const { data: seat } = await supabase
        .from('multiplayer_lobby_players')
        .select('id')
        .eq('lobby_id', lobby.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (seat) {
        // Clean up our queue entry now that we've joined
        await supabase
          .from('multiplayer_queue')
          .delete()
          .eq('id', queueEntry.id);

        // Make sure games are assigned (race: both players might call this)
        let gameOrder = lobby.game_order as string[];
        if (!gameOrder || gameOrder.length === 0) {
          gameOrder = await assignGamesToLobby(supabase, lobbyCode);
        }

        const gameUrl = buildGameUrl(seat.id, lobbyCode, gameOrder);
        if (gameUrl) {
          return NextResponse.json({
            lobbyCode,
            playingCount: statsData.playing ?? 0,
            queueCount: statsData.waiting ?? 0,
            status: 'matched',
            url: gameUrl,
          }, { status: 200 });
        }
      }
    }
  }

  // ── Not queued at all ──
  if (!queueEntry) {
    return NextResponse.json({
      playingCount: statsData.playing ?? 0,
      queueCount: statsData.waiting ?? 0,
      status: 'cancelled',
    }, { status: 200 });
  }

  // ── Still waiting ──
  return NextResponse.json({
    playingCount: statsData.playing ?? 0,
    queueCount: statsData.waiting ?? 0,
    status: 'waiting',
  }, { status: 200 });
}

// ─── DELETE: Cancel queue ─────────────────────────────────────────────

export async function DELETE() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult?.user;
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  // Remove from queue entirely
  await supabase
    .from('multiplayer_queue')
    .delete()
    .eq('user_id', user.id)
    .eq('queue_type', 'duel');

  return NextResponse.json({ status: 'cancelled' }, { status: 200 });
}