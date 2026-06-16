import Link from 'next/link';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

import { MouseProtocols } from './mouse-protocols';
import { MultiplayerSessionGuard } from '@/components/multiplayer-session-guard';

type SearchParams = { duration?: string; mode?: string; traceMode?: string; lobby?: string; game?: string; player?: string; round?: string };

type MouseMode = 'symbol' | 'cps' | 'tracking';

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) {
    return 'Guest Researcher';
  }

  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;

  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

async function loadMousePageData() {
  if (!hasSupabaseEnv()) {
    return {
      displayName: 'Guest Researcher',
      isSignedIn: false,
    };
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return {
      displayName: 'Guest Researcher',
      isSignedIn: false,
    };
  }

  return {
    displayName: getDisplayName(user),
    isSignedIn: true,
  };
}

function getMouseMode(value: string | undefined): MouseMode {
  if (value === 'cps') {
    return 'cps';
  }

  if (value === 'tracking') {
    return 'tracking';
  }

  return 'symbol';
}

function tabClass(isActive: boolean) {
  if (isActive) {
    return 'rounded-full border-2 border-cyan-300 bg-cyan-100 px-4 py-2 text-sm font-bold text-cyan-800';
  }

  return 'rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50';
}

export default async function MousePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const mode = getMouseMode(resolvedSearchParams.mode);
  const initialTraceMode = resolvedSearchParams.traceMode === 'memory' ? 'memory' : 'assist';
  const initialCpsDuration = resolvedSearchParams.duration === '5'
    ? 5
    : resolvedSearchParams.duration === '15'
      ? 15
      : 10;
  const { displayName, isSignedIn } = await loadMousePageData();
  const isMultiplayerSession = Boolean(resolvedSearchParams.lobby);

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      {isMultiplayerSession ? <MultiplayerSessionGuard /> : null}
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 sm:gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-4 shadow-[0_6px_0_rgba(226,232,240,1)] sm:items-center sm:px-6">
          <div>
            <p className="status-pill">Mouse Category</p>
            <h1 className="mt-2 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
              Mouse Control
            </h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              Choose a mode: symbol tracing, tracking test, or CPS tester.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 sm:block">
              {displayName}
            </div>
            {isMultiplayerSession ? (
              <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-6 py-3 text-sm font-bold text-rose-600">
                In Duel — Cannot leave
              </div>
            ) : (
              <Link className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]" href="/">
                Return to Lab
              </Link>
            )}
          </div>
        </div>

        {isMultiplayerSession ? null : (
          <section className="lab-card p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              <Link className={tabClass(mode === 'symbol')} href="/category/mouse?mode=symbol">
                Symbol Tracing
              </Link>
              <Link className={tabClass(mode === 'tracking')} href="/category/mouse?mode=tracking">
                Tracking Test
              </Link>
              <Link className={tabClass(mode === 'cps')} href="/category/mouse?mode=cps">
                CPS Tester
              </Link>
            </div>
          </section>
        )}

        <MouseProtocols
          initialCpsDuration={initialCpsDuration}
          initialTraceMode={initialTraceMode}
          isSignedIn={isSignedIn}
          mode={mode}
        />
      </div>
    </main>
  );
}