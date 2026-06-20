'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * This component mounts inside game pages during multiplayer sessions.
 *
 * It polls session-status to detect when the round has advanced on the server
 * and automatically redirects to the intermission/scoreboard.
 *
 * CRITICAL: Detects navigation away from the game page (clicking footer links,
 * browser back/forward, tab closing) and immediately triggers a full forfeit
 * via the heartbeat endpoint — ending the match and crowning the opponent winner.
 *
 * This is distinct from the round timer DNF (which only gives 0 points for one
 * round and advances to the next).
 */
export function MultiplayerSessionGuard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const lobbyCode = searchParams.get('lobby');
  const playerId = searchParams.get('player');
  const gameSlug = searchParams.get('game');
  const roundRaw = searchParams.get('round');
  const parsedRound = Number(roundRaw);
  const round = Number.isFinite(parsedRound) && parsedRound >= 0 ? Math.floor(parsedRound) : 0;

  const isMultiplayer = Boolean(lobbyCode && playerId && gameSlug);
  const forfeitSentRef = useRef(false);
  const intentionalNavRef = useRef(false); // true when we deliberately redirect to intermission/result

  function sendForfeit() {
    if (forfeitSentRef.current || !lobbyCode) return;
    forfeitSentRef.current = true;

    fetch('/api/multiplayer/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lobbyCode, leave: true }),
      keepalive: true,
    }).catch(() => {});
  }

  useEffect(() => {
    if (!isMultiplayer || !lobbyCode || !playerId || !gameSlug) return;

    forfeitSentRef.current = false;
    intentionalNavRef.current = false;

    // ── beforeunload: fires on tab/window close ──
    const handleBeforeUnload = () => {
      sendForfeit();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // ── pagehide: fires on tab close or navigation away.
    // We check intentionalNavRef — if we deliberately navigated to
    // intermission, this ref is true and we skip forfeit.
    const handlePageHide = () => {
      if (intentionalNavRef.current) return;
      sendForfeit();
    };
    window.addEventListener('pagehide', handlePageHide);

    // ── popstate: fires on browser back/forward buttons ──
    const handlePopState = () => {
      if (intentionalNavRef.current) return;
      sendForfeit();
    };
    window.addEventListener('popstate', handlePopState);

    // ── Intercept clicks on <a> tags that navigate away ──
    function handleLinkClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href) return;

      // Allowed destinations — do not forfeit
      if (href.includes('/intermission')) { intentionalNavRef.current = true; return; }
      if (href.includes('/duel/result')) { intentionalNavRef.current = true; return; }

      sendForfeit();
    }
    document.addEventListener('click', handleLinkClick, { capture: true });

    // ── Poll session status every 2s ──
    const statusInterval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/multiplayer/session-status?lobby=${encodeURIComponent(lobbyCode)}&round=${round}`,
          { cache: 'no-store' },
        );
        if (!response.ok) return;

        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          forfeited?: boolean;
          forfeitedMessage?: string;
          readyToAdvance?: boolean;
        } | null;

        if (!payload) return;

        if (payload.forfeited) {
          const params = new URLSearchParams();
          if (gameSlug) params.set('game', gameSlug);
          if (playerId) params.set('player', playerId);
          params.set('round', String(round));
          params.set('forfeited', '1');
          if (payload.forfeitedMessage) {
            params.set('message', payload.forfeitedMessage);
          }
          intentionalNavRef.current = true;
          router.push(`/party/${lobbyCode}/intermission?${params.toString()}`);
          return;
        }

        if (payload.readyToAdvance) {
          const params = new URLSearchParams();
          params.set('game', gameSlug);
          params.set('player', playerId);
          params.set('round', String(round));
          intentionalNavRef.current = true;
          router.push(`/party/${lobbyCode}/intermission?${params.toString()}`);
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleLinkClick, { capture: true });
      window.clearInterval(statusInterval);
    };
  }, [isMultiplayer, lobbyCode, playerId, gameSlug, round, router]);

  return null;
}