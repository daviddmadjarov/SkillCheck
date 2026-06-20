'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

// Disable browser scroll restoration at module load time — this runs
// during script evaluation, before the browser fires its scroll
// restoration on page load.  Setting it inside useEffect is too late
// because the browser restores scroll position during the paint cycle
// before React hydration completes.
if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
  // Immediately snap to top so there's no visible shift on reload.
  window.scrollTo(0, 0);
}

/**
 * Once React hydrates, handle the ?leaderboard=daily case by scrolling
 * to the rankings section.  All other page loads stay at the top.
 */
export function LeaderboardScroll() {
  const searchParams = useSearchParams();
  const leaderboardType = searchParams.get('leaderboard');
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (hasScrolledRef.current) return;
    hasScrolledRef.current = true;

    if (leaderboardType === 'daily') {
      const id = setTimeout(() => {
        const el = document.getElementById('rankings');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(id);
    }

    // Re-assert scroll top after hydration in case the module-level
    // scrollTo ran before the DOM was ready.
    window.scrollTo(0, 0);
  }, [leaderboardType]);

  return null;
}
