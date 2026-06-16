
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Crown, Trophy } from 'lucide-react';

import { buildMultiplayerSessionHref, parseMultiplayerSelectionToken } from '@/lib/multiplayer/catalog';
import { getRoundSlugFromGameOrder, getRoundTimeLimitSeconds, resolveSynchronizedRoundIndex } from '@/lib/multiplayer/session';
import { createClient } from '@/lib/supabase/server';

import { IntermissionCountdown } from './intermission-countdown';
import { IntermissionHeartbeat } from './intermission-heartbeat';

type IntermissionPageProps = {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IntermissionPage({ params, searchParams }: IntermissionPageProps) {
  const { code } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const playerId = Array.isArray(resolvedSearchParams.player) ? resolvedSearchParams.player[0] : resolvedSearchParams.player;
  const gameSlug = Array.isArray(resolvedSearchParams.game) ? resolvedSearchParams.game[0] : resolvedSearchParams.game;
  const roundRaw = Array.isArray(resolvedSearchParams.round) ? resolvedSearchParams.round[0] : resolvedSearchParams.round;
  const parsedRound = Number(roundRaw);
  const roundIndex = Number.isFinite(parsedRound) && parsedRound >= 0 ? Math.floor(parsedRound) : 0;

  if (!playerId || !gameSlug) {
    notFound();
  }

  const supabase = await createClient();

  const { data: lobby } = await supabase
    .from('multiplayer_lobbies')
    .select('id, code, game_order, mode')
    .eq('code', code)
    .maybeSingle();

  if (!lobby) {
    notFound();
  }

  const { data: players } = await supabase
    .from('multiplayer_lobby_players')
    .select('display_name, score_total, user_id, id')
    .eq('lobby_id', lobby.id)
    .order('score_total', { ascending: false })
    .order('joined_at', { ascending: true });

  const currentRoundSlug = getRoundSlugFromGameOrder(lobby.game_order, roundIndex);
  const resolvedRound = await resolveSynchronizedRoundIndex({
    gameOrder: lobby.game_order,
    lobbyCode: lobby.code,
    lobbyId: lobby.id,
    supabase,
  });

  const { data: roundResults } = currentRoundSlug
    ? await supabase
      .from('multiplayer_game_results')
      .select('player_id, submitted_at')
      .eq('lobby_code', lobby.code)
      .eq('game_slug', currentRoundSlug)
      .order('submitted_at', { ascending: true })
    : { data: [] as Array<{ player_id: string | null; submitted_at: string }> };

  const playerIds = new Set((players ?? []).map((player) => player.id));
  const submittedIds = new Set(
    (roundResults ?? [])
      .map((row) => row.player_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0 && playerIds.has(value)),
  );

  const firstSubmittedAt = roundResults?.[0]?.submitted_at ?? null;
  const initialDeadlineAt = currentRoundSlug && firstSubmittedAt
    ? new Date(new Date(firstSubmittedAt).getTime() + getRoundTimeLimitSeconds(currentRoundSlug) * 1000).toISOString()
    : null;
  const initialReadyToAdvance = resolvedRound > roundIndex;

  const nextRound = roundIndex + 1;
  const nextToken = lobby.game_order[nextRound] ?? null;
  const nextHref = nextToken
    ? buildMultiplayerSessionHref(parseMultiplayerSelectionToken(nextToken), {
      lobbyCode: lobby.code,
      playerId,
      round: nextRound,
    })
    : null;

  // ── Forfeit check ──
  const forfeitedRaw = Array.isArray(resolvedSearchParams.forfeited)
    ? resolvedSearchParams.forfeited[0]
    : resolvedSearchParams.forfeited;
  const forfeitedMessage = Array.isArray(resolvedSearchParams.message)
    ? resolvedSearchParams.message[0]
    : resolvedSearchParams.message;
  const isForfeit = forfeitedRaw === '1';

  // When a forfeit happens, end the entire session immediately — don't advance to next round
  const finalNextHref = isForfeit ? null : nextHref;
  const isSessionFinished = finalNextHref === null;

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className={`rounded-[2rem] border-2 p-6 shadow-[0_8px_0_rgba(165,243,252,1)] sm:p-8 ${isForfeit ? 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50' : 'border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50'}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="status-pill">{isForfeit ? 'Match Forfeited' : 'Session Leaderboard'}</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-800">{lobby.code}</h1>
              {isForfeit && forfeitedMessage ? (
                <p className="mt-2 max-w-2xl rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-2 text-base font-bold leading-7 text-rose-700">
                  {forfeitedMessage}
                </p>
              ) : (
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                  {isSessionFinished
                    ? 'Final session standings are locked in. Great run.'
                    : initialReadyToAdvance
                      ? `Round ${roundIndex + 1} completed. Updated standings before the next game.`
                      : `Round ${roundIndex + 1} submitted. Waiting for remaining players or round timeout.`}
                </p>
              )}
            </div>
            <Link
              className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
              href={`/party/${lobby.code}${lobby.mode === 'duel' ? '?mode=duel' : ''}`}
            >
              View Lobby
            </Link>
          </div>
        </section>

        <section className="rounded-[1.8rem] border-2 border-slate-200 bg-white p-5 shadow-[0_6px_0_rgba(226,232,240,1)]">
          <div className="flex items-center gap-2 text-slate-700">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-bold">Current session ranking</span>
          </div>
          <div className="mt-4 space-y-3">
            {(players ?? []).map((entry, index) => {
              const isCurrent = entry.id === playerId;

              return (
                <div
                  key={`${entry.user_id}-${index}`}
                  className={`flex items-center justify-between rounded-[1.2rem] border-2 px-4 py-3 ${
                    index === 0
                      ? 'border-amber-200 bg-amber-50'
                      : isCurrent
                        ? 'border-cyan-200 bg-cyan-50'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-black ${index === 0 ? 'border-amber-300 bg-amber-100 text-amber-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-black text-slate-800">{entry.display_name}</p>
                      <p className="text-sm font-medium text-slate-500">
                        {index === 0 ? 'Currently leading' : isCurrent ? 'You' : 'In session'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-full border-2 border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700">
                    {index === 0 ? <Crown className="h-4 w-4 text-amber-500" /> : null}
                    {entry.score_total}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <IntermissionHeartbeat lobbyCode={lobby.code} />
        <IntermissionCountdown
          fallbackHref={`/party/${lobby.code}${lobby.mode === 'duel' ? '?mode=duel' : ''}`}
          gameSlug={currentRoundSlug ?? gameSlug}
          initialDeadlineAt={initialDeadlineAt}
          initialPlayersCount={players?.length ?? 0}
          initialReadyToAdvance={initialReadyToAdvance}
          initialSubmittedCount={submittedIds.size}
          lobbyCode={lobby.code}
          nextHref={finalNextHref}
          round={roundIndex}
        />
      </div>
    </main>
  );
}