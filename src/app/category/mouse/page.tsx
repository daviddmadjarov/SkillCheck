import Link from 'next/link';
import { Suspense } from 'react';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { DuelRoundTimerWrapper } from '@/components/duel-round-timer-wrapper';
import { DailyGameBadge } from '@/components/daily-game-banner';
import { CategoryModeTabs } from '@/components/category-mode-tabs';
import { GameStatistics } from '@/components/game-statistics';

import { MouseProtocols } from './mouse-protocols';
import { MultiplayerSessionGuard } from '@/components/multiplayer-session-guard';

type SearchParams = { duration?: string; mode?: string; traceMode?: string; lobby?: string; game?: string; player?: string; round?: string; mp_mode?: string; daily?: string };
type MouseMode = 'symbol' | 'cps' | 'tracking';

function getMouseMode(v: string | undefined): MouseMode {
  if (v === 'cps') return 'cps';
  if (v === 'tracking') return 'tracking';
  return 'symbol';
}

export default async function MousePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const r = (await searchParams) ?? {};
  const mode = getMouseMode(r.mode);
  const initialTraceMode = r.traceMode === 'memory' ? 'memory' : 'assist';
  const initialCpsDuration = r.duration === '5' ? 5 : r.duration === '15' ? 15 : 10;
  const isSignedIn = hasSupabaseEnv() ? (await (await createClient()).auth.getUser()).data.user !== null : false;
  const isMultiplayer = Boolean(r.lobby);
  const isDuel = r.mp_mode === 'duel';
  const isDaily = r.daily === 'true' && !isMultiplayer;

  const nav = !isMultiplayer && !isDaily ? (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1.5">
      <Link data-return-to-lab className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-3 py-1.5 font-bold text-[11px] text-white shadow-[0_3px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)] no-underline" href="/">← Lab</Link>
      <div className="flex-1 flex justify-center">
        <CategoryModeTabs modes={[
          { id: 'symbol', label: 'Symbol Tracing', href: '/category/mouse?mode=symbol' },
          { id: 'tracking', label: 'Tracking Test', href: '/category/mouse?mode=tracking' },
          { id: 'cps', label: 'CPS Tester', href: '/category/mouse?mode=cps' },
        ]} activeMode={mode} />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{isSignedIn ? 'Online' : 'Guest'}</span>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-end gap-2 px-1 py-1.5">
      <Suspense fallback={null}><DuelRoundTimerWrapper /></Suspense>
      {isMultiplayer ? <div className={`rounded-2xl border-2 px-3 py-1 text-xs font-bold ${isDuel ? 'border-rose-300 bg-rose-50 text-rose-600' : 'border-cyan-300 bg-cyan-50 text-cyan-700'}`}>{isDuel ? 'Duel' : 'Party'}</div> : isDaily ? <DailyGameBadge /> : null}
      <Link data-return-to-lab className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-3 py-1.5 font-bold text-[11px] text-white shadow-[0_3px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)] no-underline" href="/">← Lab</Link>
    </div>
  );

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      {isMultiplayer ? <MultiplayerSessionGuard /> : null}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4">
        <div className="divide-y divide-slate-200 rounded-[2rem] border-2 border-slate-200 bg-white shadow-[0_6px_0_rgba(226,232,240,1)]">
          <div className="px-3 py-2">{nav}</div>
          <MouseProtocols mode={mode} isSignedIn={isSignedIn} initialCpsDuration={initialCpsDuration} initialTraceMode={initialTraceMode} />
        </div>
        {!isMultiplayer && !isDaily ? <Suspense fallback={null}><GameStatistics testSlug={mode === 'cps' ? 'mouse-cps' : mode === 'tracking' ? 'aim-tracking-test' : 'mouse-symbol-tracing'} visible={true} /></Suspense> : null}
      </div>
    </main>
  );
}