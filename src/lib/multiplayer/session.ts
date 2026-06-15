import { parseMultiplayerSelectionToken } from '@/lib/multiplayer/catalog';

const ROUND_TIME_LIMIT_SECONDS_BY_SLUG: Record<string, number> = {
  'aim-moving-targets': 90,
  'aim-perfect-split': 90,
  'aim-trainer': 75,
  'aim-tracking-test': 35,
  'audio-reaction': 45,
  'estimation-challenge': 75,
  'mental-rotation': 75,
  'mouse-cps': 30,
  'mouse-symbol-tracing': 120,
  'multi-reaction': 45,
  'perfect-sync': 90,
  'reaction-time': 45,
  'sequence-memory': 90,
  'stop-timer': 90,
  'typing-speed': 70,
};

const DEFAULT_ROUND_TIME_LIMIT_SECONDS = 75;

type MultiplayerResultRow = {
  game_slug: string;
  player_id: string | null;
  submitted_at: string;
};

type ResolveRoundOptions = {
  gameOrder: string[];
  lobbyCode: string;
  lobbyId: string;
  supabase: any;
};

export function getRoundTimeLimitSeconds(slug: string) {
  return ROUND_TIME_LIMIT_SECONDS_BY_SLUG[slug] ?? DEFAULT_ROUND_TIME_LIMIT_SECONDS;
}

export function getRoundSlugFromGameOrder(gameOrder: string[], round: number) {
  const safeRound = Number.isFinite(round) && round >= 0 ? Math.floor(round) : 0;
  const token = gameOrder[safeRound] ?? null;
  if (!token) {
    return null;
  }

  return parseMultiplayerSelectionToken(token).slug;
}

export async function resolveSynchronizedRoundIndex({
  gameOrder,
  lobbyCode,
  lobbyId,
  supabase,
}: ResolveRoundOptions) {
  const [{ data: players, error: playersError }, { data: results, error: resultsError }] = await Promise.all([
    supabase
      .from('multiplayer_lobby_players')
      .select('id')
      .eq('lobby_id', lobbyId),
    supabase
      .from('multiplayer_game_results')
      .select('game_slug, player_id, submitted_at')
      .eq('lobby_code', lobbyCode),
  ]);

  if (playersError) {
    throw new Error(`Could not load lobby players: ${playersError.message}`);
  }

  if (resultsError) {
    throw new Error(`Could not load session results: ${resultsError.message}`);
  }

  const playerIds = new Set((players ?? []).map((player: { id: string }) => player.id));
  const playerCount = playerIds.size;

  if (playerCount === 0) {
    return 0;
  }

  const nowMs = Date.now();
  const multiplayerResults = (results ?? []) as MultiplayerResultRow[];
  let resolvedRound = 0;

  for (let roundIndex = 0; roundIndex < gameOrder.length; roundIndex += 1) {
    const roundSlug = getRoundSlugFromGameOrder(gameOrder, roundIndex);
    if (!roundSlug) {
      break;
    }

    const roundResults = multiplayerResults.filter((row) => row.game_slug === roundSlug && row.player_id !== null && playerIds.has(row.player_id));

    const submittedPlayers = new Set(roundResults.map((row) => row.player_id as string));
    if (submittedPlayers.size >= playerCount) {
      resolvedRound = roundIndex + 1;
      continue;
    }

    if (submittedPlayers.size > 0) {
      let earliestSubmissionMs = Number.POSITIVE_INFINITY;
      roundResults.forEach((row) => {
        const timestamp = Date.parse(row.submitted_at);
        if (Number.isFinite(timestamp)) {
          earliestSubmissionMs = Math.min(earliestSubmissionMs, timestamp);
        }
      });

      if (Number.isFinite(earliestSubmissionMs)) {
        const elapsedSeconds = (nowMs - earliestSubmissionMs) / 1000;
        const limitSeconds = getRoundTimeLimitSeconds(roundSlug);

        if (elapsedSeconds >= limitSeconds) {
          resolvedRound = roundIndex + 1;
          continue;
        }
      }
    }

    break;
  }

  return resolvedRound;
}
