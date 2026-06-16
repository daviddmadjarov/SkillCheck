'use client';

import { useEffect, useRef } from 'react';

type IntermissionHeartbeatProps = {
  lobbyCode: string;
};

/**
 * Sends heartbeat pings while the player is on the intermission page.
 * Without this, a player who finishes all their games and waits at
 * intermission would stop sending heartbeats and appear AFK to the
 * forfeit system, potentially losing a match they already won.
 */
export function IntermissionHeartbeat({ lobbyCode }: IntermissionHeartbeatProps) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const intervalId = window.setInterval(async () => {
      if (!mountedRef.current) return;

      try {
        await fetch('/api/multiplayer/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyCode }),
        });
      } catch {
        // silently continue
      }
    }, 3000);

    // Send immediate first heartbeat
    fetch('/api/multiplayer/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lobbyCode }),
    }).catch(() => {});

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [lobbyCode]);

  return null;
}