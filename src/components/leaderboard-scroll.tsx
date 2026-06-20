'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Scrolls to the leaderboard section once, only when the user arrives
 * from the /daily page with ?leaderboard=daily. Tab switches within the
 * home page already have scroll={false} and don't trigger scrolling.
 */
export function LeaderboardScroll() {
  const searchParams = useSearchParams();
  const leaderboardType = searchParams.get('leaderboard');
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (hasScrolledRef.current) return;
    if (!leaderboardType) return;

    hasScrolledRef.current = true;

    const id = setTimeout(() => {
      const el = document.getElementById('rankings');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    return () => clearTimeout(id);
  }, [leaderboardType]);

  return null;
}