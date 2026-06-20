'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Scrolls to the leaderboard section when the daily leaderboard tab is active.
 * This ensures mobile users see the leaderboard after navigation from the daily page.
 */
export function LeaderboardScroll() {
  const searchParams = useSearchParams();
  const leaderboardType = searchParams.get('leaderboard');

  useEffect(() => {
    if (leaderboardType) {
      // Small delay to let the DOM render
      const id = setTimeout(() => {
        const el = document.getElementById('rankings');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(id);
    }
  }, [leaderboardType]);

  return null;
}