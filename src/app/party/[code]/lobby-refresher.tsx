'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client component that periodically refreshes the lobby page
 * so players see updated rosters and status changes.
 */
export function LobbyRefresher({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [router, intervalMs]);

  // This component doesn't render anything visible
  return null;
}