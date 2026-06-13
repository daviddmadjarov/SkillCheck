import Link from 'next/link';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

import { TypingProtocol } from './typing-protocol';

export const dynamic = 'force-static';

function getDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) {
    return 'Guest Researcher';
  }

  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;

  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

async function loadTypingPageData() {
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

export default async function TypingPage({
  searchParams,
}: {
  searchParams?: Promise<{ duration?: string; language?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { displayName, isSignedIn } = await loadTypingPageData();

  const initialDuration = resolvedSearchParams.duration === '60' ? 60 : 30;
  const initialLanguage = resolvedSearchParams.language === 'german'
    ? 'german'
    : resolvedSearchParams.language === 'spanish'
      ? 'spanish'
      : 'english';

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 sm:gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[1.7rem] border-2 border-slate-200 bg-white px-4 py-4 shadow-[0_6px_0_rgba(226,232,240,1)] sm:items-center sm:px-6">
          <div>
            <p className="status-pill">Typing Category</p>
            <h1 className="mt-2 text-xl font-black tracking-tight text-slate-800 sm:text-2xl">
              Typing Speed Test
            </h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              Monkeytype-style sprint with random words, language selection, and detailed error metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 sm:block">
              {displayName}
            </div>
            <Link className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]" href="/">
              Return to Lab
            </Link>
          </div>
        </div>

        <TypingProtocol
          initialDuration={initialDuration}
          initialLanguage={initialLanguage}
          isSignedIn={isSignedIn}
        />
      </div>
    </main>
  );
}
