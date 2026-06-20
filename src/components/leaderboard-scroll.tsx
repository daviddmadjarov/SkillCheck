'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Scrolls to the leaderboard section once, only when the user arrives
 * from the /daily page with ?leaderboard=daily. Tab switches within the
 * home page already have scroll={false} and don't trigger scrolling.
 * Regular reloads with ?leaderboard=lab or ?leaderboard=elo stay at top.
 */
export function LeaderboardScroll() {
  const searchParams = useSearchParams();
  const leaderboardType = searchParams.get('leaderboard');
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    // Only scroll when navigating from /daily (?leaderboard=daily).
    // The lab and elo tabs are already visible on the home page and should
    // not trigger any scroll — doing so would shift the page down on reload
    // or tab switch.
    if (leaderboardType !== 'daily') return;
    if (hasScrolledRef.current) return;

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
