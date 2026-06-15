'use client';

import { useRouter } from 'next/navigation';
import { DoorOpen, Play, Copy, Check } from 'lucide-react';
import { useState } from 'react';

type LobbyActionsProps = {
  isHost: boolean;
  isJoined: boolean;
  lobbyCode: string;
  lobbyStatus: string;
  mode: string;
};

export function LobbyActions({ isHost, isJoined, lobbyCode, lobbyStatus, mode }: LobbyActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLive = lobbyStatus === 'live';

  async function handleStartSession() {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch('/api/multiplayer/party/start', {
        body: JSON.stringify({ code: lobbyCode }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(payload?.error ?? 'Could not start session.');
        return;
      }

      router.refresh();
    } catch {
      setError('Could not start session.');
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(lobbyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className="space-y-3">
      {!isJoined && !isLive ? (
        <a
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-cyan-700 bg-cyan-500 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(14,116,144,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-cyan-400 hover:shadow-[0_8px_0_rgba(14,116,144,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(14,116,144,1)] sm:w-auto"
          href="/party/join"
        >
          <DoorOpen className="h-4 w-4" />
          Join a Lobby
        </a>
      ) : null}

      {isHost && !isLive ? (
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-500 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(5,150,105,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-emerald-400 hover:shadow-[0_8px_0_rgba(5,150,105,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(5,150,105,1)] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          disabled={isStarting}
          onClick={handleStartSession}
          type="button"
        >
          <Play className="h-4 w-4" />
          {isStarting ? 'Starting…' : 'Start Session'}
        </button>
      ) : null}

      {isHost && !isLive ? (
        <>
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 shadow-[0_4px_0_rgba(226,232,240,1)] transition-all duration-150 hover:-translate-y-1 hover:shadow-[0_8px_0_rgba(226,232,240,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(226,232,240,1)] sm:w-auto"
            onClick={handleCopyCode}
            type="button"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Code
              </>
            )}
          </button>

          <p className="rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            Share the code above with friends so they can join. When everyone is ready, start the session.
          </p>
        </>
      ) : null}

      {error ? (
        <p className="rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}