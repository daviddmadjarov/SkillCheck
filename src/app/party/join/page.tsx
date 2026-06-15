'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, DoorOpen } from 'lucide-react';

import { hasSupabaseEnv } from '@/lib/supabase/config';

export default function JoinPartyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError('Enter a valid lobby code.');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const response = await fetch('/api/multiplayer/party/join', {
        body: JSON.stringify({ code: trimmed }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;

      if (!response.ok || !payload?.url) {
        setError(payload?.error ?? 'Could not join lobby.');
        return;
      }

      router.push(payload.url);
    } catch {
      setError('Could not join lobby.');
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <section className="rounded-[2rem] border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-6 shadow-[0_8px_0_rgba(165,243,252,1)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl space-y-4">
              <p className="status-pill">Join Party</p>
              <h1 className="text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
                Enter a room code.
              </h1>
              <p className="max-w-xl text-base font-medium leading-7 text-slate-600">
                Got a code from a friend? Enter it here to join their private lobby.
              </p>
            </div>

            <a
              className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
              href="/"
            >
              <ArrowLeft className="mr-2 inline-block h-4 w-4" />
              Return to Lab
            </a>
          </div>

          <div className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-600" htmlFor="lobby-code">
                Lobby Code
              </label>
              <input
                className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-center text-3xl font-black tracking-[0.3em] text-slate-800 outline-none transition focus:border-cyan-400"
                id="lobby-code"
                maxLength={6}
                placeholder="______"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleJoin();
                  }
                }}
              />
            </div>

            <button
              className="w-full rounded-2xl border-2 border-cyan-700 bg-cyan-500 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(14,116,144,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-cyan-400 hover:shadow-[0_8px_0_rgba(14,116,144,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(14,116,144,1)] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isJoining || code.trim().length < 4}
              onClick={handleJoin}
              type="button"
            >
              {isJoining ? 'Joining…' : 'Join Lobby'}
            </button>

            {error ? (
              <p className="rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-[1.8rem] border-2 border-slate-200 bg-white p-5 shadow-[0_6px_0_rgba(226,232,240,1)]">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-600">
              <DoorOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Quick tips</p>
              <h2 className="text-xl font-black tracking-tight text-slate-800">How joining works</h2>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm font-medium leading-6 text-slate-500">
            <li>• Codes are 6 characters long (letters and numbers).</li>
            <li>• The lobby must still be in "waiting" status to accept new players.</li>
            <li>• You must be signed in to join a lobby.</li>
            <li>• Once the host starts the session, no new players can join.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}