import Link from 'next/link';
import {
  Activity,
  BrainCircuit,
  ChevronDown,
  Crosshair,
  Keyboard,
  Medal,
  MousePointer2,
  Orbit,
  ShieldCheck,
  Timer,
  Trophy,
  CalendarDays,
} from 'lucide-react';

import { Suspense } from 'react';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { LeaderboardScroll } from '@/components/leaderboard-scroll';
import type { Database } from '@/lib/supabase/types';
import { ProfilePanel } from '@/components/profile-panel';
import { GameModeCard } from '@/components/game-mode-card';
import { MonitoringRoom } from '@/components/monitoring-room';
const categories = [
  { id: 'reaction', title: 'Reaction Protocol', icon: Activity, desc: 'Signal response analysis', color: 'text-rose-500', bg: 'bg-rose-100' },
  { id: 'aim', title: 'Aim Assessment', icon: Crosshair, desc: 'Targeting and precision drills', color: 'text-blue-500', bg: 'bg-blue-100' },
  { id: 'typing', title: 'Keystroke Test', icon: Keyboard, desc: 'WPM and accuracy metrics', color: 'text-amber-500', bg: 'bg-amber-100' },
  { id: 'mouse', title: 'Mouse Control', icon: MousePointer2, desc: 'Trajectory perfection and tracing', color: 'text-emerald-500', bg: 'bg-emerald-100' },
  { id: 'rhythm', title: 'Rhythm Sync', icon: Timer, desc: 'Internal clock calibration', color: 'text-purple-500', bg: 'bg-purple-100' },
  { id: 'thinking', title: 'Cognitive Review', icon: BrainCircuit, desc: 'Spatial and memory checks', color: 'text-cyan-500', bg: 'bg-cyan-100' },
];

const setupChecklist = [
  'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.',
  'Run supabase/leaderboard-schema.sql in the Supabase SQL editor.',
  'Enable Google and Discord providers and add callback URLs for both http://localhost:3000/auth/callback and https://skillcheck.online/auth/callback.',
];

type SearchParams = Record<string, string | string[] | undefined> & { leaderboard?: string };
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ScoreSubmissionRow = Pick<
  Database['public']['Tables']['score_submissions']['Row'],
  'user_id' | 'test_slug' | 'score'
>;

type ComputedLeaderboardEntry = {
  avatar_url: string | null;
  overall_score: number;
  rank: number;
  tests_completed: number;
  user_id: string;
  username: string | null;
};

type DailyLeaderboardEntry = {
  rank: number;
  username: string | null;
  avatar_url: string | null;
  score: number;
};

function toScoreBucket(testSlug: string) {
  const directBuckets = new Set([
    'reaction-time',
    'audio-reaction',
    'multi-reaction',
    'aim-trainer',
    'aim-moving-targets',
    'aim-tracking-test',
    'aim-perfect-split',
    'mental-rotation',
    'estimation-challenge',
    'sequence-memory',
    'perfect-sync',
    'stop-timer',
    'mouse-cps',
  ]);

  if (directBuckets.has(testSlug)) {
    return testSlug;
  }

  if (testSlug.startsWith('typing-speed')) {
    return 'typing-speed';
  }

  if (testSlug.startsWith('mouse-symbol-tracing')) {
    return 'mouse-symbol-tracing';
  }

  if (testSlug.startsWith('symbol-tracing')) {
    return 'mouse-symbol-tracing';
  }

  return null;
}

function buildLeaderboard(
  profiles: Pick<ProfileRow, 'id' | 'username' | 'avatar_url' | 'created_at'>[],
  submissions: ScoreSubmissionRow[],
): ComputedLeaderboardEntry[] {
  const userBestByBucket = new Map<string, Map<string, number>>();

  for (const submission of submissions) {
    if (!Number.isFinite(submission.score)) {
      continue;
    }

    const bucket = toScoreBucket(submission.test_slug);
    if (bucket === null) {
      continue;
    }

    const nextScore = Math.round(submission.score);
    const existingBuckets = userBestByBucket.get(submission.user_id) ?? new Map<string, number>();
    const previousBest = existingBuckets.get(bucket) ?? Number.NEGATIVE_INFINITY;
    existingBuckets.set(bucket, Math.max(previousBest, nextScore));
    userBestByBucket.set(submission.user_id, existingBuckets);
  }

  const ranked = profiles.map((profile) => {
    const buckets = userBestByBucket.get(profile.id);
    const bestScores = buckets ? [...buckets.values()] : [];
    const overallScore = bestScores.reduce((sum, score) => sum + score, 0);

    return {
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      overall_score: overallScore,
      tests_completed: bestScores.length,
      user_id: profile.id,
      username: profile.username,
    };
  });

  ranked.sort((a, b) => {
    if (b.overall_score !== a.overall_score) {
      return b.overall_score - a.overall_score;
    }

    return a.created_at.localeCompare(b.created_at);
  });

  let lastScore: number | null = null;
  let currentRank = 0;

  return ranked.slice(0, 8).map((entry, index) => {
    if (lastScore === null || entry.overall_score !== lastScore) {
      currentRank = index + 1;
      lastScore = entry.overall_score;
    }

    return {
      avatar_url: entry.avatar_url,
      overall_score: entry.overall_score,
      rank: currentRank,
      tests_completed: entry.tests_completed,
      user_id: entry.user_id,
      username: entry.username,
    };
  });
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getAuthMessage(searchParams: SearchParams) {
  const auth = getSingleParam(searchParams.auth);
  const reason = getSingleParam(searchParams.reason);

  if (auth === 'email-sent') {
    return {
      tone: 'success' as const,
      title: 'Magic link sent',
      description:
        'Supabase accepted the request. Check your inbox and click the access link to finish login.',
    };
  }

  if (auth === 'email-error') {
    if (reason === 'missing-email' || reason === 'invalid-email') {
      return {
        tone: 'error' as const,
        title: 'Enter a valid email address',
        description:
          'The magic-link form needs a real email address before Supabase can send a login link.',
      };
    }

    if (reason === 'provider-disabled') {
      return {
        tone: 'error' as const,
        title: 'Email login is not enabled yet',
        description:
          'Enable the Email provider in Supabase Authentication before testing magic-link login.',
      };
    }

    if (reason === 'rate-limited') {
      return {
        tone: 'error' as const,
        title: 'Too many requests',
        description:
          'Supabase temporarily rate-limited login emails. Wait a moment and try again.',
      };
    }

    return {
      tone: 'error' as const,
      title: 'Magic link could not be sent',
      description:
        'Supabase rejected the request. Check the Email provider settings and redirect URLs in Supabase Auth.',
    };
  }

  return null;
}

function getProfileMessage(searchParams: SearchParams) {
  const profile = getSingleParam(searchParams.profile);
  const reason = getSingleParam(searchParams.reason);

  if (profile === 'username-updated') {
    return {
      tone: 'success' as const,
      title: 'Username updated',
      description: 'Your public SkillCheck name has been saved and will be used on the leaderboard.',
    };
  }

  if (profile === 'username-error') {
    if (reason === 'too-short') {
      return {
        tone: 'error' as const,
        title: 'Username too short',
        description: 'Choose at least 3 characters for your public SkillCheck name.',
      };
    }

    if (reason === 'too-long') {
      return {
        tone: 'error' as const,
        title: 'Username too long',
        description: 'Keep the username at 24 characters or fewer.',
      };
    }

    if (reason === 'invalid-characters') {
      return {
        tone: 'error' as const,
        title: 'Username contains invalid characters',
        description: 'Use only letters, numbers, spaces, dashes, or underscores.',
      };
    }

    if (reason === 'username-taken') {
      return {
        tone: 'error' as const,
        title: 'Username already taken',
        description: 'That public name is already in use. Try a different variation.',
      };
    }

    if (reason === 'not-signed-in') {
      return {
        tone: 'error' as const,
        title: 'Sign in required',
        description: 'You need an active session before you can update your username.',
      };
    }

    return {
      tone: 'error' as const,
      title: 'Username could not be updated',
      description: 'Supabase rejected the profile update. Try again in a moment.',
    };
  }

  return null;
}

function formatScore(score: number | null) {
  if (score === null) {
    return '--';
  }

  return new Intl.NumberFormat('en-US').format(Math.round(score));
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function sanitizeGeneratedName(name: string | null | undefined) {
  if (!name) {
    return null;
  }

  return name.replace(/-[0-9a-f]{6}$/i, '');
}

function getDisplayName(
  user: Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>['auth']['getUser']>>['data']['user'],
  profile: ProfileRow | null,
) {
  const profileName = sanitizeGeneratedName(profile?.username ?? null);
  if (profileName) {
    return profileName;
  }

  if (!user) {
    return 'Guest Researcher';
  }

  const metadata = user.user_metadata as Record<string, string | undefined> | undefined;

  return metadata?.user_name ?? metadata?.full_name ?? user.email?.split('@')[0] ?? 'Researcher';
}

type EloEntry = {
  elo_rating: number;
  duel_wins: number;
  duel_losses: number;
  rank: number;
  user_id: string;
  username: string | null;
};

async function loadHomeData(leaderboardType: string) {
  if (!hasSupabaseEnv()) {
    return {
      completedProtocols: 0,
      dailyLeaderboard: [] as DailyLeaderboardEntry[],
      dailyLeaderboardError: null,
      eloLeaderboard: [] as EloEntry[],
      hasAnomalousAccess: false,
      leaderboard: [] as ComputedLeaderboardEntry[],
      leaderboardError: null,
      profile: null as ProfileRow | null,
      supabaseReady: false,
      user: null,
    };
  }

  try {
    const supabase = await createClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;

    let dailyLeaderboard: DailyLeaderboardEntry[] = [];
    let dailyLeaderboardError: string | null = null;
    let eloLeaderboard: EloEntry[] = [];
    let leaderboard: ComputedLeaderboardEntry[] = [];
    let leaderboardError: string | null = null;

    // ── Lore: count unique protocols completed ──
    let completedProtocols = 0;
    let hasAnomalousAccess = false;
    if (user) {
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      hasAnomalousAccess = metadata.anomalous_access === true || metadata.anomalous_access === 'true';

      // Count distinct test_slug values in score_submissions for this user
      const { data: distinctTests } = await supabase
        .from('score_submissions')
        .select('test_slug')
        .eq('user_id', user.id);
      if (distinctTests) {
        const unique = new Set(distinctTests.map((r: { test_slug: string }) => r.test_slug));
        completedProtocols = unique.size;
      }
    }

    if (leaderboardType === 'elo') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: eloData } = await (supabase.rpc as any)('get_elo_leaderboard', { p_limit: 8 });
      eloLeaderboard = (eloData ?? []) as EloEntry[];
    } else if (leaderboardType === 'daily') {
      // Fetch today's daily challenge leaderboard
      const now = new Date();
      const challengeDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: dailyData, error: dailyErr } = await (supabase as any)
          .from('daily_challenge_log')
          .select(`
            score,
            user_id,
            profiles!inner (
              username,
              avatar_url
            )
          `)
          .eq('challenge_date', challengeDate)
          .order('score', { ascending: false })
          .limit(8);

        if (dailyErr) {
          dailyLeaderboardError = dailyErr.message;
        } else if (dailyData) {
          dailyLeaderboard = (dailyData as Array<{
            score: number;
            user_id: string;
            profiles: { username: string | null; avatar_url: string | null };
          }>).map((entry, index) => ({
            rank: index + 1,
            username: entry.profiles?.username ?? null,
            avatar_url: entry.profiles?.avatar_url ?? null,
            score: Math.round(entry.score),
          }));
        }
      } catch (err) {
        dailyLeaderboardError = err instanceof Error ? err.message : 'Could not load daily leaderboard.';
      }
    } else {
      const [profilesResult, submissionsResult] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url, created_at'),
        supabase.from('score_submissions').select('user_id, test_slug, score'),
      ]);
      leaderboard = buildLeaderboard(profilesResult.data ?? [], submissionsResult.data ?? []);
      leaderboardError = profilesResult.error?.message ?? submissionsResult.error?.message ?? null;
    }

    const { data: profileResult } = user
      ? await supabase.from('profiles').select('id, username, avatar_url, skill_level, created_at').eq('id', user.id).maybeSingle()
      : { data: null };

    // ── Lore: inject S-042 entry if anomalous access is active ──
    if (hasAnomalousAccess) {
      if (leaderboardType === 'lab') {
        leaderboard = [
          {
            avatar_url: null,
            overall_score: 0,
            rank: 0,
            tests_completed: 0,
            user_id: 's-042',
            username: 'S-042 [CONTAINMENT FAILURE]',
          },
          ...leaderboard,
        ];
      } else if (leaderboardType === 'elo') {
        eloLeaderboard = [
          {
            elo_rating: 0,
            duel_wins: 0,
            duel_losses: 0,
            rank: 0,
            user_id: 's-042',
            username: 'S-042 [CONTAINMENT FAILURE]',
          },
          ...eloLeaderboard,
        ];
      } else if (leaderboardType === 'daily') {
        dailyLeaderboard = [
          {
            rank: 0,
            username: 'S-042 [CONTAINMENT FAILURE]',
            avatar_url: null,
            score: 0,
          },
          ...dailyLeaderboard,
        ];
      }
    }

    return {
      completedProtocols,
      dailyLeaderboard,
      dailyLeaderboardError,
      eloLeaderboard,
      hasAnomalousAccess,
      leaderboard,
      leaderboardError,
      profile: profileResult ?? null,
      supabaseReady: true,
      user,
    };
  } catch (error) {
    return {
      completedProtocols: 0,
      dailyLeaderboard: [] as DailyLeaderboardEntry[],
      dailyLeaderboardError: null,
      eloLeaderboard: [] as EloEntry[],
      hasAnomalousAccess: false,
      leaderboard: [] as ComputedLeaderboardEntry[],
      leaderboardError: error instanceof Error ? error.message : 'Unable to reach Supabase.',
      profile: null as ProfileRow | null,
      supabaseReady: true,
      user: null,
    };
  }
}

function tabButtonClass(isActive: boolean, accent: string) {
  const base = 'rounded-full border-2 px-4 py-2 text-sm font-bold transition';
  if (isActive) {
    return `${base} ${accent === 'amber' ? 'border-amber-300 bg-amber-100 text-amber-800' : 'border-cyan-300 bg-cyan-100 text-cyan-800'}`;
  }
  return `${base} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const leaderboardType = typeof resolvedSearchParams.leaderboard === 'string' ? resolvedSearchParams.leaderboard : 'lab';
  const { completedProtocols, dailyLeaderboard, dailyLeaderboardError, eloLeaderboard, hasAnomalousAccess, leaderboard, leaderboardError, profile, supabaseReady, user } = await loadHomeData(leaderboardType);
  const displayName = getDisplayName(user, profile);
  const initials = getInitials(displayName || 'SC');
  const authMessage = getAuthMessage(resolvedSearchParams);
  const profileMessage = getProfileMessage(resolvedSearchParams);

  // ── Render the Aethelgard Monitoring Room when anomalous access is active ──
  if (hasAnomalousAccess && user) {
    return <MonitoringRoom />;
  }

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
        <header className="flex min-h-[104px] flex-wrap items-center justify-between gap-4 rounded-[2rem] border-2 border-slate-200 bg-white px-4 py-4 shadow-[0_6px_0_rgba(226,232,240,1)] sm:px-6 sm:py-5">
          <Link href="/" className="flex shrink-0 items-center gap-4 cursor-pointer transition-transform hover:scale-105">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-cyan-500 text-white shadow-[0_4px_0_rgba(14,116,144,1)]">
              <Activity className="h-7 w-7" strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800 sm:text-[2rem]">
                SkillCheck
              </h1>
            </div>
          </Link>

          <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
            <Link
              className="flex cursor-pointer list-none items-center gap-3 rounded-full border-2 border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition-all duration-150 hover:-translate-y-1 hover:bg-white hover:shadow-[0_6px_0_rgba(226,232,240,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(226,232,240,1)]"
              href="/lab-results"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500 text-white shadow-[0_3px_0_rgba(14,116,144,1)]">
                <Trophy className="h-5 w-5" />
              </div>
              <span className="hidden text-sm font-bold text-slate-700 sm:block">Lab Results</span>
            </Link>

            <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full border-2 border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition-all duration-150 hover:-translate-y-1 hover:bg-white hover:shadow-[0_6px_0_rgba(226,232,240,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(226,232,240,1)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500 text-sm font-black text-white shadow-[0_3px_0_rgba(14,116,144,1)]">
                {initials || 'SC'}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  {user ? 'Profile' : 'Login'}
                </p>
                <p className="max-w-32 truncate text-sm font-bold text-slate-700">
                  {user ? displayName : 'Guest mode'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>

            <div className="absolute right-0 z-20 mt-3 w-[min(25rem,calc(100vw-2rem))] rounded-[1.8rem] border-2 border-slate-200 bg-white p-4 shadow-[0_10px_0_rgba(226,232,240,1)]">
              {user ? (
                <ProfilePanel
                  completedProtocols={completedProtocols}
                  displayName={displayName}
                  email={user.email ?? null}
                  hasAnomalousAccess={hasAnomalousAccess}
                  profileMessage={profileMessage}
                  username={profile?.username ?? ''}
                />
              ) : supabaseReady ? (
                <div className="space-y-4">
                  {authMessage ? (
                    <div
                      className={`rounded-[1.4rem] border-2 p-4 ${
                        authMessage.tone === 'success'
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-rose-200 bg-rose-50'
                      }`}
                    >
                      <p
                        className={`text-xs font-bold uppercase tracking-[0.2em] ${
                          authMessage.tone === 'success' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {authMessage.title}
                      </p>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                        {authMessage.description}
                      </p>
                    </div>
                  ) : null}

                  <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-bold">Sign in to keep your scores</span>
                    </div>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                      Use Google, Discord or a magic link. Once signed in, your leaderboard name and future results stay attached to your profile.
                    </p>
                  </div>

                  <a className="lab-button flex items-center justify-center" href="/auth/login?provider=google">
                    Continue with Google
                  </a>
                  <a className="lab-button-secondary flex items-center justify-center" href="/auth/login?provider=discord">
                    Continue with Discord
                  </a>
                  <form action="/auth/email" className="space-y-3" method="post">
                    <label className="block text-sm font-bold text-slate-600" htmlFor="email">
                      Or send a magic link
                    </label>
                    <input className="lab-input" id="email" name="email" placeholder="scientist@skillcheck.dev" type="email" />
                    <button className="lab-button w-full" type="submit">
                      Send Access Link
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[1.4rem] border-2 border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
                      Setup Required
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                      Supabase is wired into the app, but the local project still needs credentials and schema setup before login can go live.
                    </p>
                  </div>
                  <ol className="space-y-3 text-sm font-medium text-slate-600">
                    {setupChecklist.map((step, index) => (
                      <li className="flex gap-3" key={step}>
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            </details>
          </div>
        </header>

        <section className="grid items-stretch gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="flex flex-col gap-6">
            <section className="lab-card p-5 sm:p-6 lg:p-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                  6 CATEGORIES
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {categories.map((cat) => (
                  <GameModeCard
                    key={cat.id}
                    href={`/category/${cat.id}`}
                    iconKey={cat.id}
                    title={cat.title}
                    desc={cat.desc}
                    color={cat.color}
                    bg={cat.bg}
                    hasAnomalousAccess={hasAnomalousAccess}
                  />
                ))}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <Link href="/duel" data-pitched-hover className="rounded-[1.8rem] border-2 border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-5 shadow-[0_6px_0_rgba(254,202,202,1)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_0_rgba(254,202,202,1)]">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-500">
                  DUEL
                </p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-3xl font-black text-slate-800">1v1 Match</p>
                    <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-slate-500">
                      Jump straight into a head-to-head lobby and race through a shared game order.
                    </p>
                  </div>
                  <div className="rounded-3xl border-2 border-white bg-rose-100 px-6 py-3 shadow-sm flex flex-col items-center justify-center min-w-[5rem]">
                    <span className="block text-sm font-bold uppercase tracking-[0.15em] text-rose-600 leading-tight">Fast</span>
                    <span className="block text-sm font-bold uppercase tracking-[0.15em] text-rose-600 leading-tight">Queue</span>
                  </div>
                </div>
              </Link>

              <Link href="/party/create" data-pitched-hover className="rounded-[1.8rem] border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-[0_6px_0_rgba(165,243,252,1)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_0_rgba(165,243,252,1)]">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-500">
                  Create Party
                </p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-3xl font-black text-slate-800">Private Lobby</p>
                    <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-slate-500">
                      Build a code-based room, invite friends, and choose the games you want to play.
                    </p>
                  </div>
                  <div className="rounded-3xl border-2 border-white bg-cyan-100 px-6 py-3 shadow-sm flex flex-col items-center justify-center min-w-[5rem]">
                    <span className="block text-sm font-bold uppercase tracking-[0.15em] text-cyan-600 leading-tight">Share</span>
                    <span className="block text-sm font-bold uppercase tracking-[0.15em] text-cyan-600 leading-tight">Code</span>
                  </div>
                </div>
              </Link>
              <Link href="/daily" data-pitched-hover className="rounded-[1.8rem] border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50 p-5 shadow-[0_6px_0_rgba(253,230,138,1)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_0_rgba(253,230,138,1)]">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">
                  DAILY
                </p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-3xl font-black text-slate-800">Challenge</p>
                    <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-slate-500">
                      One shot per day. Compete on today's curated test.
                    </p>
                  </div>
                  <div className="rounded-3xl border-2 border-white bg-amber-100 px-6 py-3 shadow-sm flex flex-col items-center justify-center min-w-[5rem]">
                    <span className="block text-sm font-bold uppercase tracking-[0.15em] text-amber-600 leading-tight">Daily</span>
                    <span className="block text-sm font-bold uppercase tracking-[0.15em] text-amber-600 leading-tight">Today</span>
                  </div>
                </div>
              </Link>
              <Link href="/party/join" data-pitched-hover className="rounded-[1.8rem] border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-[0_6px_0_rgba(167,243,208,1)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_0_rgba(167,243,208,1)]">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500">
                  Join Party
                </p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-3xl font-black text-slate-800">Enter Code</p>
                    <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-slate-500">
                      Got a friend's lobby code? Jump into their party and play together.
                    </p>
                  </div>
                  <div className="rounded-3xl border-2 border-white bg-emerald-100 px-6 py-3 shadow-sm flex flex-col items-center justify-center min-w-[5rem]">
                    <span className="block text-sm font-bold uppercase tracking-[0.15em] text-emerald-600 leading-tight">Join</span>
                    <span className="block text-sm font-bold uppercase tracking-[0.15em] text-emerald-600 leading-tight">Quick</span>
                  </div>
                </div>
              </Link>
            </section>
          </div>

            <Suspense fallback={null}><LeaderboardScroll /></Suspense>
            <aside className="lab-card p-5 sm:p-6 xl:min-h-[680px]" id="rankings">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  Global Board
                </p>
                <h2 className="text-2xl font-black tracking-tight text-slate-800">
                  Rankings
                </h2>
              </div>
            </div>

            {/* ── Tab switcher ── */}
            <div className="mb-4 flex flex-wrap gap-2">
              <Link
                className={tabButtonClass(leaderboardType === 'lab', 'amber')}
                href="/?leaderboard=lab"
                scroll={false}
              >
                Lab Points
              </Link>
              <Link
                className={tabButtonClass(leaderboardType === 'elo', 'cyan')}
                href="/?leaderboard=elo"
                scroll={false}
              >
                Elo Rankings
              </Link>
              <Link
                className={tabButtonClass(leaderboardType === 'daily', 'amber')}
                href="/?leaderboard=daily"
                scroll={false}
              >
                Daily
              </Link>
            </div>

            {leaderboardType === 'lab' ? (
              <>
                {leaderboard.length > 0 ? (
                  <ol className="space-y-3">
                    {leaderboard.map((entry, index) => (
                      <li className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 px-4 py-3 sm:flex-nowrap" key={`lab-${entry.user_id}-${index}`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-[0_3px_0_rgba(226,232,240,1)]">
                            {index < 3 ? <Medal className="h-5 w-5 text-amber-500" /> : <Orbit className="h-5 w-5 text-cyan-500" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-800">
                              {sanitizeGeneratedName(entry.username) ?? 'Unnamed Researcher'}
                            </p>
                            <p className="text-sm font-medium text-slate-500">
                              {entry.tests_completed ?? 0} recorded protocols
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                            Rank #{entry.rank ?? index + 1}
                          </p>
                          <p className="text-2xl font-black text-slate-800">
                            {formatScore(entry.overall_score)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : supabaseReady ? (
                  <div className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-medium leading-6 text-slate-600">
                      {leaderboardError
                        ? `Supabase is reachable, but the leaderboard view is not ready yet: ${leaderboardError}`
                        : 'No leaderboard entries yet. As soon as users sign in and score submissions are stored, ranks will appear here.'}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-medium leading-6 text-slate-600">
                      Leaderboard data will appear here once the Supabase project is configured and the SQL schema has been applied.
                    </p>
                  </div>
                )}
              </>
            ) : leaderboardType === 'elo' ? (
              <>
                {eloLeaderboard.length > 0 ? (
                  <ol className="space-y-3">
                    {eloLeaderboard.map((entry, index) => {
                      const displayName = sanitizeGeneratedName(entry.username) ?? 'Unnamed Player';
                      const totalGames = (entry.duel_wins ?? 0) + (entry.duel_losses ?? 0);
                      const winRate = totalGames > 0 ? Math.round((entry.duel_wins ?? 0) / totalGames * 100) : 0;
                      return (
                        <li className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 px-4 py-3 sm:flex-nowrap" key={`elo-${entry.user_id}-${index}`}>
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-[0_3px_0_rgba(226,232,240,1)]">
                              {index < 3 ? <Medal className="h-5 w-5 text-amber-500" /> : <Orbit className="h-5 w-5 text-cyan-500" />}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-black text-slate-800">{displayName}</p>
                              <p className="text-sm font-medium text-slate-500">
                                {entry.duel_wins ?? 0}W / {entry.duel_losses ?? 0}L ({winRate}%)
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                              Rank #{entry.rank}
                            </p>
                            <p className="text-2xl font-black text-slate-800">
                              {entry.elo_rating}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-medium leading-6 text-slate-600">
                      No duel rankings yet. Play a duel to appear on this leaderboard.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {dailyLeaderboard.length > 0 ? (
                  <ol className="space-y-3">
                    {dailyLeaderboard.map((entry, index) => (
                      <li className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 px-4 py-3 sm:flex-nowrap" key={`daily-${entry.username ?? index}-${index}`}>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-[0_3px_0_rgba(226,232,240,1)]">
                            {index < 3 ? <Medal className="h-5 w-5 text-amber-500" /> : <Orbit className="h-5 w-5 text-cyan-500" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-800">
                              {sanitizeGeneratedName(entry.username) ?? 'Unnamed Player'}
                            </p>
                            <p className="text-sm font-medium text-slate-500">
                              Today's score
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                            Rank #{entry.rank}
                          </p>
                          <p className="text-2xl font-black text-slate-800">
                            {formatScore(entry.score)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : supabaseReady ? (
                  <div className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-medium leading-6 text-slate-600">
                      {dailyLeaderboardError
                        ? `Could not load daily leaderboard: ${dailyLeaderboardError}`
                        : 'No one has played today\'s challenge yet. Be the first!'}
                    </p>
                    <Link
                      className="mt-3 inline-block rounded-2xl border-2 border-amber-300 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800 transition hover:-translate-y-0.5"
                      href="/daily"
                    >
                      Play Today's Challenge
                    </Link>
                  </div>
                ) : (
                  <div className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-medium leading-6 text-slate-600">
                      Daily leaderboard data will appear here once the Supabase project is configured.
                    </p>
                  </div>
                )}
              </>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}