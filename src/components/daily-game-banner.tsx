'use client';

import { useSearchParams } from 'next/navigation';

/**
 * Shows a "Daily Challenge" amber badge when the current game is a daily challenge.
 * Also suppresses the "Return to Lab" button / category tabs.
 */
export function useDailyGameCheck() {
  const searchParams = useSearchParams();
  return searchParams.get('daily') === 'true' && !searchParams.get('lobby');
}

export function DailyGameBadge() {
  const isDaily = useDailyGameCheck();

  if (!isDaily) return null;

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-6 py-3 text-sm font-bold text-amber-700">
      Daily Challenge
    </div>
  );
}