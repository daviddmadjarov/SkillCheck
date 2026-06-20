'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * This component mounts inside game pages during multiplayer sessions.
 *
 * It polls session-status to detect when the round has advanced on the server
 * (meaning the opponent finished or the timer ran out), and automatically
 * redirects to the intermission/scoreboard.
 *
 * CRITICAL: Detects navigation away from the game page (browser back/forward,
 * clicking footer links, etc.) and immediately triggers a full forfeit via
 * the heartbeat endpoint — this ends the entire match and crowns the opponent
 * the winner. This is distinct from the round timer DNF (which only gives
 * 0 points for one round and advances to the next).
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
  const mountedRef = useRef(true);
  const tabClosingRef = useRef(false);
  const forfeitSentRef = useRef(false);

  /**
   * Sends a forfeit signal via the heartbeat endpoint with leave: true.
   * This triggers process_duel_forfeit on the server which ends the match
   * and awards victory to the opponent. Only fires once per mount.
   */
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

    mountedRef.current = true;
    tabClosingRef.current = false;

    // Track tab/window close via beforeunload
    const handleBeforeUnload = () => {
      tabClosingRef.current = true;
      sendForfeit();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // ── Browser back/forward navigation (popstate) ──
    // Fires when the user clicks browser back/forward or uses swipe gestures.
    // Triggers an instant full forfeit.
    const handlePopState = () => {
      if (!mountedRef.current || forfeitSentRef.current) return;
      sendForfeit();
    };
    window.addEventListener('popstate', handlePopState);

    // ── Intercept clicks on <a> tags that navigate away ──
    // Catches footer links (Imprint, TOS, Privacy, etc.) and any other
    // internal navigation that leaves the game page.
    function handleLinkClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href) return;

      // Allow navigation to intermission (game completed normally)
      if (href.includes('/intermission')) return;

      // Allow navigation to duel result page
      if (href.includes('/duel/result')) return;

      // For any other link click, trigger forfeit
      if (!forfeitSentRef.current) {
        sendForfeit();
      }
    }
    document.addEventListener('click', handleLinkClick, { capture: true });

    // ── Poll session status every 2s (round advancement) ──
    const statusInterval = window.setInterval(async () => {
      if (!mountedRef.current) return;

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

        // ── Forfeit detected (opponent left) ──
        if (payload.forfeited) {
          const params = new URLSearchParams();
          if (gameSlug) params.set('game', gameSlug);
          if (playerId) params.set('player', playerId);
          params.set('round', String(round));
          params.set('forfeited', '1');
          if (payload.forfeitedMessage) {
            params.set('message', payload.forfeitedMessage);
          }

          router.push(`/party/${lobbyCode}/intermission?${params.toString()}`);
          return;
        }

        // ── Round advance (normal) ──
        if (payload.readyToAdvance) {
          const params = new URLSearchParams();
          params.set('game', gameSlug);
          params.set('player', playerId);
          params.set('round', String(round));

          router.push(`/party/${lobbyCode}/intermission?${params.toString()}`);
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleLinkClick, { capture: true });
      window.clearInterval(statusInterval);

      // Only signal forfeit if the tab/window is actually closing,
      // NOT during normal app navigation (e.g., routing to intermission).
      // The popstate and click handlers already handle non-tab abandonment.
      if (tabClosingRef.current && lobbyCode && !forfeitSentRef.current) {
        sendForfeit();
      }
    };
  }, [isMultiplayer, lobbyCode, playerId, gameSlug, round, router]);

  return null;
}