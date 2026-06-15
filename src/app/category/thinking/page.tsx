import Link from 'next/link';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

import { CognitiveProtocols } from './cognitive-protocols';

type ThinkingMode = 'rotation' | 'estimation' | 'sequence';

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) return 'Guest Researcher';
  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;
  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

async function loadData() {
  if (!hasSupabaseEnv()) return { displayName: 'Guest Researcher', isSignedIn: false };
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user) return { displayName: 'Guest Researcher', isSignedIn: false };
  return { displayName: getDisplayName(user), isSignedIn: true };
}

function getMode(value: string | undefined): ThinkingMode {
  if (value === 'estimation') return 'estimation';
  if (value === 'sequence') return 'sequence';
  return 'rotation';
}

function tabClass(isActive: boolean) {
  return isActive
    ? 'rounded-full border-2 border-cyan-300 bg-cyan-100 px-4 py-2 text-sm font-bold text-cyan-800'
    : 'rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50';
}

export default async function ThinkingPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  const resolved = (await searchParams) ?? {};
  const mode = getMode(resolved.mode);
  const { displayName, isSignedIn } = await loadData();

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 sm:gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-4 shadow-[0_6px_0_rgba(226,232,240,1)] sm:items-center sm:px-6">
          <div>
            <p className="status-pill">Cognitive Category</p>
            <h1 className="mt-2 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
              Cognitive Review
            </h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              Spatial reasoning, perceptual precision and working memory across three modes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 sm:block">
              {displayName}
            </div>
            <Link
              className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
              href="/"
            >
              Return to Lab
            </Link>
          </div>
        </div>

        <section className="lab-card p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            <Link className={tabClass(mode === 'rotation')} href="/category/thinking?mode=rotation">
              Mental Rotation
            </Link>
            <Link className={tabClass(mode === 'estimation')} href="/category/thinking?mode=estimation">
              Estimation Challenge
            </Link>
            <Link className={tabClass(mode === 'sequence')} href="/category/thinking?mode=sequence">
              Sequence Memory
            </Link>
          </div>
        </section>

        <CognitiveProtocols isSignedIn={isSignedIn} mode={mode} />
      </div>
    </main>
  );
}
