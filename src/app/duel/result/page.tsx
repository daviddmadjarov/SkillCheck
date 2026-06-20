'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Swords, Trophy, RotateCcw, Home } from 'lucide-react';

type PlayerInfo = {
  displayName: string;
  isLeading: boolean;
  rank: number;
  scoreTotal: number;
  userId: string;
};

type DuelResult = {
  winnerDisplayName: string | null;
  winnerUserId: string | null;
  winnerElo: number | null;
  players: PlayerInfo[];
  forfeited: boolean;
  forfeitedMessage: string | null;
  currentUserId: string | null;
  currentUserEloBefore: number | null;
  currentDisplayName: string | null;
};

export default function DuelResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lobbyCode = searchParams.get('lobby');

  const [result, setResult] = useState<DuelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lobbyCode) {
      setError('No lobby specified.');
      setLoading(false);
      return;
    }

    async function loadResult() {
      try {
        const response = await fetch(`/api/multiplayer/duel-result?lobby=${encodeURIComponent(lobbyCode ?? '')}`);
        if (!response.ok) {
          const err = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(err?.error ?? 'Could not load duel result.');
          setLoading(false);
          return;
        }

        const payload = (await response.json()) as DuelResult;
        setResult(payload);
      } catch {
        setError('Could not load duel result.');
      } finally {
        setLoading(false);
      }
    }

    loadResult();
  }, [lobbyCode]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-black text-slate-800">Loading result...</p>
        </div>
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-[2rem] border-2 border-rose-200 bg-rose-50 p-8 text-center shadow-[0_8px_0_rgba(254,202,202,1)]">
          <p className="text-lg font-bold text-rose-700">{error ?? 'Could not load duel result.'}</p>
          <button className="mt-6 rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white" onClick={() => router.push('/duel')} type="button">
            Back to Duel Queue
          </button>
        </div>
      </main>
    );
  }

  const { winnerDisplayName, players, forfeited, forfeitedMessage } = result;
  const winner = players[0];
  const runnerUp = players[1];
  const isWinner = result.currentUserId === result.winnerUserId;

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <section className={`rounded-[2rem] border-2 p-6 shadow-[0_8px_0_rgba(165,243,252,1)] sm:p-8 ${forfeited ? 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50' : 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50'}`}>
          <div className="text-center">
            <p className="status-pill">{forfeited ? 'Match Forfeited' : 'Duel Complete'}</p>

            <div className="mt-6 flex justify-center">
              <div className="rounded-2xl bg-amber-100 p-4 text-amber-700">
                <Trophy className="h-12 w-12" />
              </div>
            </div>

            <h1 className="mt-4 text-5xl font-black tracking-tight text-slate-800">
              {winnerDisplayName ?? 'Unknown'} Wins!
            </h1>

            {forfeited && forfeitedMessage ? (
              <p className="mt-3 rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-2 text-base font-bold leading-7 text-rose-700">
                {forfeitedMessage}
              </p>
            ) : (
              <p className="mt-3 text-base font-medium leading-6 text-slate-500">
                {isWinner ? 'Great performance — you won the duel!' : 'Tough match — better luck next time.'}
              </p>
            )}
          </div>
        </section>

        {/* Players comparison */}
        <section className="rounded-[1.8rem] border-2 border-slate-200 bg-white p-5 shadow-[0_6px_0_rgba(226,232,240,1)]">
          <div className="flex items-center gap-2 text-slate-700">
            <Swords className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-bold">Match results</span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Winner card */}
            {winner && (
              <div className={`rounded-[1.4rem] border-2 p-5 ${isWinner ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Winner</p>
                <p className="mt-2 text-2xl font-black text-slate-800">{winner.displayName}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {winner.displayName === result.currentDisplayName ? '(You)' : ''} — {winner.scoreTotal} pts
                </p>
              </div>
            )}

            {/* Runner-up card */}
            {runnerUp && (
              <div className={`rounded-[1.4rem] border-2 p-5 ${!isWinner && runnerUp.userId === result.currentUserId ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Runner-up</p>
                <p className="mt-2 text-2xl font-black text-slate-800">{runnerUp.displayName}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {runnerUp.displayName === result.currentDisplayName ? '(You)' : ''} — {runnerUp.scoreTotal} pts
                </p>
              </div>
            )}
          </div>

          {/* Elo changes */}
          {result.winnerElo !== null && (
            <div className="mt-4 rounded-[1.2rem] border-2 border-cyan-200 bg-cyan-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Elo Rating</p>
              <p className="mt-2 text-lg font-bold text-slate-800">
                Winner's new Elo: <span className="text-emerald-600">{result.winnerElo}</span>
                {result.currentUserEloBefore !== null && !isWinner && (
                  <span className="ml-4 text-rose-600">
                    (was: {result.currentUserEloBefore})
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {isWinner
                  ? `Your Elo is now ${result.winnerElo}. Keep dueling to climb the ranks!`
                  : `The winner's Elo is now ${result.winnerElo}. Queue again to improve your rating.`}
              </p>
            </div>
          )}
        </section>

        {/* Action buttons */}
        <section className="flex flex-wrap gap-4">
          <button
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-rose-700 bg-rose-500 px-6 py-4 font-bold text-white shadow-[0_4px_0_rgba(190,24,93,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-rose-400 hover:shadow-[0_8px_0_rgba(190,24,93,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(190,24,93,1)]"
            onClick={() => router.push('/duel')}
            type="button"
          >
            <RotateCcw className="h-5 w-5" />
            Play Again
          </button>
          <button
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-4 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
            onClick={() => router.push('/')}
            type="button"
          >
            <Home className="h-5 w-5" />
            Return to Lab
          </button>
        </section>
      </div>
    </main>
  );
}