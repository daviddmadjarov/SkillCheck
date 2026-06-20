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
  const modeParam = searchParams.get('mp_mode');
  const isDuelSession = modeParam === 'duel';

  const isMultiplayer = Boolean(lobbyCode && playerId && gameSlug);
  const shouldForfeitOnLeave = isMultiplayer;
  const forfeitSentRef = useRef(false);

  /**
   * Forfeit flag that auto-clears after 800ms.
   * Set to true when we deliberately navigate to intermission/result,
   * so the same-event pagehide doesn't trigger forfeit.
   * Auto-clears so future popstate (back button) does trigger forfeit.
   */
  const intentionalNavRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setIntentionalNav() {
    if (intentionalNavRef.current) clearTimeout(intentionalNavRef.current);
    intentionalNavRef.current = setTimeout(() => {
      intentionalNavRef.current = null;
    }, 800);
  }

  function isIntentionalNav() {
    return intentionalNavRef.current !== null;
  }

  function sendForfeit() {
    if (forfeitSentRef.current || !lobbyCode) return;
    forfeitSentRef.current = true;

    fetch('/api/multiplayer/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lobbyCode, leave: shouldForfeitOnLeave }),
      keepalive: true,
    }).catch(() => {});
  }

  useEffect(() => {
    if (!isMultiplayer || !lobbyCode || !playerId || !gameSlug) return;

    forfeitSentRef.current = false;
    if (intentionalNavRef.current) {
      clearTimeout(intentionalNavRef.current);
      intentionalNavRef.current = null;
    }

    // ── beforeunload ──
    const handleBeforeUnload = () => {
      sendForfeit();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // ── pagehide ──
    const handlePageHide = () => {
      if (isIntentionalNav()) return;
      if ((window as any).__skillcheck_dnf) return;
      sendForfeit();
    };
    window.addEventListener('pagehide', handlePageHide);

    // ── visibilitychange ──
    // Catches back-button on mobile browsers where pagehide may not fire
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Don't forfeit immediately — the user may just be switching tabs.
        // But if they navigate away (back button), pagehide or popstate will fire.
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── popstate (browser back/forward) ──
    const handlePopState = () => {
      if (isIntentionalNav()) return;
      if ((window as any).__skillcheck_dnf) return;
      sendForfeit();
    };
    window.addEventListener('popstate', handlePopState);

    // ── Intercept <a> clicks ──
    function handleLinkClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href) return;

      if (href.includes('/intermission')) { setIntentionalNav(); return; }
      if (href.includes('/duel/result')) { setIntentionalNav(); return; }

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
          setIntentionalNav();
          router.push(`/party/${lobbyCode}/intermission?${params.toString()}`);
          return;
        }

        if (payload.readyToAdvance) {
          const params = new URLSearchParams();
          params.set('game', gameSlug);
          params.set('player', playerId);
          params.set('round', String(round));
          setIntentionalNav();
          router.push(`/party/${lobbyCode}/intermission?${params.toString()}`);
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleLinkClick, { capture: true });
      window.clearInterval(statusInterval);
      if (intentionalNavRef.current) {
        clearTimeout(intentionalNavRef.current);
        intentionalNavRef.current = null;
      }
    };
  }, [isMultiplayer, lobbyCode, playerId, gameSlug, round, router]);

  return null;
}