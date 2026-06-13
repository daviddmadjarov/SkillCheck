
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, ArrowLeft, CircleUserRound, Copy, Play } from 'lucide-react';

import { buildMultiplayerSessionHref, parseMultiplayerSelectionToken } from '@/lib/multiplayer/catalog';
import { resolveSynchronizedRoundIndex } from '@/lib/multiplayer/session';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-static';

type PartyPageProps = {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PartyLobbyPage({ params, searchParams }: PartyPageProps) {
  const { code } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const modeParam = Array.isArray(resolvedSearchParams.mode) ? resolvedSearchParams.mode[0] : resolvedSearchParams.mode;
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  const { data: lobby } = await supabase
    .from('multiplayer_lobbies')
    .select('id, code, created_at, current_game_index, game_order, max_players, mode, selected_games, status, winner_user_id')
    .eq('code', code)
    .maybeSingle();

  if (!lobby) {
    notFound();
  }

  const isDuel = modeParam === 'duel' || lobby.mode === 'duel';
  const gameSelections = lobby.game_order.map((token) => parseMultiplayerSelectionToken(token));

  const { data: players } = await supabase
    .from('multiplayer_lobby_players')
    .select('display_name, id, is_ready, score_total, seat_index, user_id')
    .eq('lobby_id', lobby.id)
    .order('seat_index', { ascending: true, nullsFirst: true })
    .order('joined_at', { ascending: true });

  const currentPlayer = (players ?? []).find((player) => player.user_id === user?.id) ?? null;

  const nextRound = await resolveSynchronizedRoundIndex({
    gameOrder: lobby.game_order,
    lobbyCode: lobby.code,
    lobbyId: lobby.id,
    supabase,
  });
  const nextToken = lobby.game_order[nextRound] ?? null;
  const nextGameHref = currentPlayer && nextToken
    ? buildMultiplayerSessionHref(parseMultiplayerSelectionToken(nextToken), {
      lobbyCode: lobby.code,
      playerId: currentPlayer.id,
      round: nextRound,
    })
    : null;

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-[2rem] border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-6 shadow-[0_8px_0_rgba(165,243,252,1)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="status-pill">Lobby</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-800">{lobby.code}</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                {isDuel
                  ? 'Matched duel lobby. Both players can start immediately once the game order is loaded.'
                  : 'Share this code with friends. Once everyone is here, you can move into the selected multiplayer set.'}
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
              href="/"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Lab
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[1.4rem] border-2 border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Mode</p>
              <p className="mt-2 text-2xl font-black text-slate-800">{lobby.mode}</p>
            </div>
            <div className="rounded-[1.4rem] border-2 border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Status</p>
              <p className="mt-2 text-2xl font-black text-slate-800">{lobby.status}</p>
            </div>
            <div className="rounded-[1.4rem] border-2 border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Players</p>
              <p className="mt-2 text-2xl font-black text-slate-800">{players?.length ?? 0} / {lobby.max_players}</p>
            </div>
            <div className="rounded-[1.4rem] border-2 border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Games</p>
              <p className="mt-2 text-2xl font-black text-slate-800">{lobby.selected_games.length}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.8rem] border-2 border-slate-200 bg-white p-5 shadow-[0_6px_0_rgba(226,232,240,1)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-rose-100 p-3 text-rose-600">
                <Copy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{isDuel ? 'Duel Match' : 'Room Code'}</p>
                <h2 className="text-2xl font-black tracking-tight text-slate-800">{isDuel ? 'Random queue matched' : 'Invite and play'}</h2>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium leading-6 text-slate-500">
              {isDuel
                ? 'This 1v1 lobby was created automatically from the duel queue. No invite code is needed.'
                : 'Current game order is locked in for this lobby, so everyone plays the same set in the same order.'}
            </p>
            {!isDuel ? (
              <div className="mt-4 rounded-[1.4rem] border-2 border-rose-200 bg-rose-50 p-4 text-center text-3xl font-black tracking-[0.3em] text-slate-800">
                {lobby.code}
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.8rem] border-2 border-slate-200 bg-white p-5 shadow-[0_6px_0_rgba(226,232,240,1)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
                <CircleUserRound className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Players</p>
                <h2 className="text-2xl font-black tracking-tight text-slate-800">Lobby roster</h2>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(players ?? []).map((player, index) => (
                <div key={`${player.user_id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-[1.2rem] border-2 border-slate-200 bg-slate-50 px-4 py-3 sm:flex-nowrap">
                  <div>
                    <p className="font-black text-slate-800">{player.display_name}</p>
                    <p className="text-sm font-medium text-slate-500">{player.is_ready ? 'Ready' : 'Waiting'}</p>
                  </div>
                  <div className="rounded-full border-2 border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700">
                    {player.score_total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[1.8rem] border-2 border-slate-200 bg-white p-5 shadow-[0_6px_0_rgba(226,232,240,1)]">
          {nextGameHref ? (
            <div className="mb-4 rounded-[1.4rem] border-2 border-cyan-200 bg-cyan-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Session Flow</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                {nextRound === 0
                  ? 'Start game mode 1 to begin session scoring.'
                  : `Continue at game mode ${nextRound + 1}. Session rankings update after every completed game.`}
              </p>
              <Link
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-cyan-700 bg-cyan-500 px-5 py-2 font-bold text-white shadow-[0_4px_0_rgba(14,116,144,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-cyan-400 hover:shadow-[0_8px_0_rgba(14,116,144,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(14,116,144,1)] sm:w-auto"
                href={nextGameHref}
              >
                <Play className="h-4 w-4" />
                {nextRound === 0 ? 'Start Session' : 'Continue Session'}
              </Link>
            </div>
          ) : (
            <div className="mb-4 rounded-[1.4rem] border-2 border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Session Complete</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                All configured game modes are completed for this player. Final standings are shown in the roster.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 text-slate-700">
            <BadgeCheck className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-bold">Selected games</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {gameSelections.map((selection, index) => {
              const configText = Object.entries(selection.config)
                .map(([key, value]) => `${key}: ${value}`)
                .join(' · ');

              return (
                <span
                  key={`${selection.slug}-${index}`}
                  className="rounded-full border-2 border-slate-200 bg-slate-50 px-3 py-1 text-sm font-bold text-slate-700"
                >
                  {selection.slug}{configText ? ` (${configText})` : ''}
                </span>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
export function generateStaticParams() {
  return [];
}