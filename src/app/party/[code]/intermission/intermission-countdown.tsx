'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type IntermissionCountdownProps = {
  fallbackHref: string;
  gameSlug: string;
  lobbyCode: string;
  nextHref: string | null;
  /** When set, overrides fallbackHref for finished duels */
  duelResultHref?: string | null;
  round: number;
  initialPlayersCount: number;
  initialSubmittedCount: number;
  initialReadyToAdvance: boolean;
  initialDeadlineAt: string | null;
  isDuel?: boolean;
  seconds?: number;
};

export function IntermissionCountdown({
  fallbackHref,
  gameSlug,
  lobbyCode,
  nextHref,
  duelResultHref,
  round,
  initialPlayersCount,
  initialSubmittedCount,
  initialReadyToAdvance,
  initialDeadlineAt,
  isDuel = false,
  seconds = 4,
}: IntermissionCountdownProps) {
  const router = useRouter();
  const [playersCount, setPlayersCount] = useState(initialPlayersCount);
  const [submittedCount, setSubmittedCount] = useState(initialSubmittedCount);
  const [readyToAdvance, setReadyToAdvance] = useState(initialReadyToAdvance);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(initialDeadlineAt);
  const [remaining, setRemaining] = useState(seconds);

  // Live deadline countdown — ticks every second while waiting
  const [deadlineRemainingSeconds, setDeadlineRemainingSeconds] = useState<number | null>(
    initialDeadlineAt ? Math.max(0, Math.ceil((new Date(initialDeadlineAt).getTime() - Date.now()) / 1000)) : null,
  );

  // Tick the deadline timer every second — only when waiting
  useEffect(() => {
    if (readyToAdvance) {
      setDeadlineRemainingSeconds(null);
      return;
    }

    // If we have a deadline, tick it down live
    if (deadlineAt) {
      const tick = () => {
        const remainingSecs = Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000));
        setDeadlineRemainingSeconds(remainingSecs);
      };
      tick();
      const tickId = window.setInterval(tick, 1000);
      return () => window.clearInterval(tickId);
    }

    setDeadlineRemainingSeconds(null);
  }, [deadlineAt, readyToAdvance]);

  useEffect(() => {
    if (readyToAdvance) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/multiplayer/session-status?lobby=${encodeURIComponent(lobbyCode)}&round=${round}`, {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json().catch(() => null)) as
          | {
            deadlineAt?: string | null;
            playersCount?: number;
            readyToAdvance?: boolean;
            submittedCount?: number;
          }
          | null;

        if (!payload) {
          return;
        }

        setPlayersCount(typeof payload.playersCount === 'number' ? payload.playersCount : 0);
        setSubmittedCount(typeof payload.submittedCount === 'number' ? payload.submittedCount : 0);
        setDeadlineAt(typeof payload.deadlineAt === 'string' ? payload.deadlineAt : null);

        if (payload.readyToAdvance) {
          setReadyToAdvance(true);
        }
      } catch {
        // keep polling
      }
    }, 1200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [lobbyCode, readyToAdvance, round]);

  useEffect(() => {
    if (!readyToAdvance) {
      return;
    }

    setRemaining(seconds);

    const intervalId = window.setInterval(() => {
      setRemaining((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fallbackHref, nextHref, readyToAdvance, router, seconds]);

  useEffect(() => {
    if (!readyToAdvance || remaining > 0) {
      return;
    }

    // Priority: nextHref → duelResultHref → fallbackHref
    const target = nextHref ?? duelResultHref ?? fallbackHref;
    router.replace(target);
  }, [fallbackHref, nextHref, duelResultHref, readyToAdvance, remaining, router]);

  return (
    <div className="rounded-[1.4rem] border-2 border-cyan-200 bg-cyan-50 p-4 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Intermission</p>
      <p className="mt-2 text-base font-semibold text-slate-700">
        {readyToAdvance
          ? nextHref
            ? `Next game starts in ${remaining}s`
            : `Session complete. Returning in ${remaining}s`
          : `Waiting for players: ${submittedCount}/${playersCount}`}
      </p>

      {/* Live deadline timer — visible while waiting */}
      {!readyToAdvance && deadlineRemainingSeconds !== null && (
        <div className="mt-2">
          <span
            className={`inline-block rounded-full border-2 px-3 py-1 text-sm font-bold ${
              deadlineRemainingSeconds <= 10
                ? 'border-rose-300 bg-rose-100 text-rose-700 animate-pulse'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            ⏱ Round timer: {deadlineRemainingSeconds}s
          </span>
        </div>
      )}

      {!readyToAdvance && deadlineRemainingSeconds === null && (
        <p className="mt-2 text-sm font-medium text-slate-600">
          Round timer starts when the first player submits.
        </p>
      )}

      {!isDuel ? (
        <button
          className="mt-4 rounded-xl border-2 border-cyan-700 bg-cyan-500 px-4 py-2 text-sm font-bold text-white shadow-[0_3px_0_rgba(14,116,144,1)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-cyan-400 hover:shadow-[0_6px_0_rgba(14,116,144,1)] active:translate-y-0.5 active:shadow-[0_0px_0_rgba(14,116,144,1)]"
          onClick={() => {
            if (!readyToAdvance) {
              return;
            }

            router.replace(nextHref ?? fallbackHref);
          }}
          type="button"
        >
          {readyToAdvance ? (nextHref ? 'Continue now' : 'Back to lobby') : 'Waiting for all players'}
        </button>
      ) : null}
    </div>
  );
}