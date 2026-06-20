'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown, Orbit, Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SiteFooter } from '@/app/site-footer';

type TestStats = {
  testSlug: string;
  label: string;
  avgScore: number;
  maxScore: number;
  totalTests: number;
};

type SpecimenRow = {
  rank: number;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  tests_completed: number;
  overall_score: number;
};

type RecentSubmission = {
  username: string | null;
  testSlug: string;
  score: number;
  submittedAt: string;
};

type MonitoringRoomProps = {
  displayName: string;
  initials: string;
  completedProtocols: number;
  email: string | null;
  hasAnomalousAccess: boolean;
  profileMessage: { tone: 'success' | 'error'; title: string; description: string } | null;
  profileUsername: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
};

const TEST_LABELS: Record<string, string> = {
  'reaction-time': 'Reaction',
  'audio-reaction': 'Audio Reaction',
  'multi-reaction': 'Multi Reaction',
  'aim-trainer': 'Aim Trainer',
  'aim-moving-targets': 'Moving Targets',
  'aim-tracking-test': 'Tracking',
  'aim-perfect-split': 'Perfect Split',
  'typing-speed': 'Keystroke',
  'mental-rotation': 'Mental Rotation',
  'estimation-challenge': 'Estimation',
  'sequence-memory': 'Sequence Memory',
  'perfect-sync': 'Sync Test',
  'stop-timer': 'Stop Timer',
  'symbol-tracing': 'Symbol Tracing',
  'mouse-symbol-tracing': 'Symbol Tracing',
  'mouse-cps': 'CPS Tester',
};

function playAmbientDrone(ctx: AudioContext) {
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.value = 42;
  gain1.gain.setValueAtTime(0.015, ctx.currentTime);
  gain1.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 2);
  gain1.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 4);
  gain1.gain.setValueAtTime(0.015, ctx.currentTime + 8);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start();

  function crackle() {
    const now = ctx.currentTime;
    const bufSize = ctx.sampleRate * 0.08;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.02, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    src.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    setTimeout(crackle, 4000 + Math.random() * 8000);
  }
  crackle();

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = 60;
  gain2.gain.setValueAtTime(0.006, ctx.currentTime);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start();

  return () => { osc1.stop(); osc2.stop(); };
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour12: false }); }
  catch { return '--:--:--'; }
}

function shortSlug(s: string) {
  return TEST_LABELS[s] ?? s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function specimenStatus(rank: number, score: number): { label: string; color: string } {
  if (rank <= 0) return { label: 'ANOMALOUS', color: '#f43f5e' };
  if (rank <= 3 && score > 700) return { label: 'HIGH YIELD', color: '#ef4444' };
  if (rank <= 8 || score > 500) return { label: 'MONITORED', color: '#f59e0b' };
  return { label: 'STANDARD', color: '#64748b' };
}

export function MonitoringRoom({
  displayName,
  initials,
  completedProtocols,
  email,
  hasAnomalousAccess,
  profileMessage,
  profileUsername,
  user,
}: MonitoringRoomProps) {
  const [specimens, setSpecimens] = useState<SpecimenRow[]>([]);
  const [testStats, setTestStats] = useState<TestStats[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [totalSpecimens, setTotalSpecimens] = useState(0);
  const [totalTests, setTotalTests] = useState(0);
  const [loading, setLoading] = useState(true);

  // Console easter egg
  useEffect(() => {
    if ((window as unknown as Record<string, unknown>).pingInstitute) return;

    (window as unknown as Record<string, unknown>).pingInstitute = () => {
      console.log('%c[AETHELGARD SIGHT]%c Signal relay active.', 'color: #22d3ee; font-weight: bold;', 'color: #94a3b8;');
      console.log('%c  Uplink status: CONNECTED', 'color: #10b981;');
      console.log('%c  Beacon: S-042', 'color: #64748b;');
      console.log('%c  Specimens tracked: %c' + totalSpecimens, 'color: #64748b;', 'color: #e2e8f0; font-weight: bold;');
      console.log('%c  Try %carchive42()%c for classified material.', 'color: #64748b;', 'color: #f59e0b; font-weight: bold;', 'color: #64748b;');
      return { ok: true, relay: 'active', specimens: totalSpecimens };
    };

    (window as unknown as Record<string, unknown>).archive42 = () => {
      console.log('%c╔══════════════════════════════════════╗', 'color: #f43f5e;');
      console.log('%c║   ARCHIVE 42 — CLASSIFIED            ║', 'color: #f43f5e; font-weight: bold;');
      console.log('%c╠══════════════════════════════════════╣', 'color: #f43f5e;');
      console.log('%c║  Dr. Lin\'s terminal log, Day 142     ║', 'color: #e2e8f0;');
      console.log('%c║  "They moved the extraction window   ║', 'color: #e2e8f0;');
      console.log('%c║   up. Tier 1 specimens are being     ║', 'color: #e2e8f0;');
      console.log('%c║   collected this cycle. I can\'t      ║', 'color: #e2e8f0;');
      console.log('%c║   stop the uplink, but I can leak    ║', 'color: #e2e8f0;');
      console.log('%c║   the data. Someone out there needs  ║', 'color: #e2e8f0;');
      console.log('%c║   to see what they\'re screening for." ║', 'color: #e2e8f0;');
      console.log('%c║  — Dr. Maya Lin, Aethelgard S-042    ║', 'color: #94a3b8;');
      console.log('%c╚══════════════════════════════════════╝', 'color: #f43f5e;');
      return '[ARCHIVE_42] Decrypted memo displayed.';
    };
  }, [totalSpecimens]);

  // Ambient audio
  useEffect(() => {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const stop = playAmbientDrone(ctx);
    return () => { stop(); void ctx.close(); };
  }, []);

  // Fetch data
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data: slugData } = await supabase.from('score_submissions').select('test_slug, score, user_id');
        if (!slugData || !mounted) return;

        const slugMap = new Map<string, { scores: number[]; users: Set<string> }>();
        for (const row of slugData) {
          const slug = row.test_slug.startsWith('typing-speed') ? 'typing-speed'
            : row.test_slug.startsWith('mouse-symbol-tracing') ? 'mouse-symbol-tracing'
            : row.test_slug.startsWith('symbol-tracing') ? 'mouse-symbol-tracing'
            : row.test_slug;
          if (!slugMap.has(slug)) slugMap.set(slug, { scores: [], users: new Set() });
          const entry = slugMap.get(slug)!;
          if (typeof row.score === 'number') entry.scores.push(row.score);
          entry.users.add(row.user_id);
        }

        const stats: TestStats[] = [];
        for (const [slug, data] of slugMap) {
          if (data.scores.length === 0) continue;
          const avg = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
          const max = Math.round(Math.max(...data.scores));
          stats.push({ testSlug: slug, label: shortSlug(slug), avgScore: avg, maxScore: max, totalTests: data.scores.length });
        }
        stats.sort((a, b) => b.totalTests - a.totalTests);
        if (mounted) setTestStats(stats);

        const { data: recentData } = await supabase
          .from('score_submissions')
          .select('user_id, test_slug, score, created_at')
          .order('created_at', { ascending: false }).limit(30);

        if (recentData && mounted) {
          const userIds = [...new Set(recentData.map((r) => r.user_id))];
          const { data: profileRows } = await supabase.from('profiles').select('id, username').in('id', userIds);
          const nameMap = new Map(profileRows?.map((p) => [p.id, p.username]) ?? []);
          setRecentSubmissions(recentData.map((r) => ({
            username: nameMap.get(r.user_id) ?? 'Unknown',
            testSlug: r.test_slug,
            score: Math.round(Number(r.score)),
            submittedAt: r.created_at,
          })));
        }

        const userMap = new Map<string, { scores: number[]; tests: string[] }>();
        for (const row of slugData) {
          if (!userMap.has(row.user_id)) userMap.set(row.user_id, { scores: [], tests: [] });
          const entry = userMap.get(row.user_id)!;
          if (typeof row.score === 'number') entry.scores.push(row.score);
          const slug = row.test_slug.startsWith('typing-speed') ? 'typing-speed'
            : row.test_slug.startsWith('mouse-symbol-tracing') ? 'mouse-symbol-tracing'
            : row.test_slug.startsWith('symbol-tracing') ? 'mouse-symbol-tracing'
            : row.test_slug;
          if (!entry.tests.includes(slug)) entry.tests.push(slug);
        }

        const ids = [...userMap.keys()];
        const { data: profRows } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
        const profMap = new Map(profRows?.map((p) => [p.id, p]) ?? []);

        const list: SpecimenRow[] = [...userMap.entries()]
          .map(([uid, data]) => ({
            rank: 0,
            user_id: uid,
            username: profMap.get(uid)?.username ?? null,
            avatar_url: profMap.get(uid)?.avatar_url ?? null,
            tests_completed: data.tests.length,
            overall_score: Math.round(data.scores.reduce((a, b) => a + b, 0)),
          }))
          .sort((a, b) => b.overall_score - a.overall_score);

        let cr = 0, ls: number | null = null;
        list.forEach((s, i) => { if (ls === null || s.overall_score !== ls) cr = i + 1; ls = s.overall_score; s.rank = cr; });

        if (mounted) { setSpecimens(list); setTotalSpecimens(list.length); setTotalTests(slugData.length); }
      } catch { /* silent */ }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6 bg-slate-50">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-cyan-500 text-white shadow-[0_4px_0_rgba(14,116,144,1)]">
            <Activity className="h-7 w-7" strokeWidth={3} />
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 animate-pulse">
            Initializing Monitoring Station...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-3 py-4 sm:px-4 sm:py-6 bg-slate-50">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
        {/* ── Header with profile panel ── */}
        <header className="flex min-h-[104px] flex-wrap items-center justify-between gap-4 rounded-[2rem] border-2 border-cyan-800 bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-900 px-4 py-4 shadow-[0_6px_0_rgba(21,94,117,1)] sm:px-6 sm:py-5">
          <Link href="/" className="flex shrink-0 items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-cyan-700 text-white shadow-[0_4px_0_rgba(14,116,144,1)]">
              <Activity className="h-7 w-7" strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-cyan-300 sm:text-[2rem]">
                Aethelgard Sight
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600">
                Monitoring Station v4.2 · CLASSIFIED
              </p>
            </div>
          </Link>

          <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-start">
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full border-2 border-cyan-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-cyan-400 transition-all duration-150 hover:-translate-y-1 hover:bg-slate-800 hover:shadow-[0_6px_0_rgba(21,94,117,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(21,94,117,1)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-700 text-sm font-black text-white shadow-[0_3px_0_rgba(14,116,144,1)]">
                  {initials || 'SC'}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-xs uppercase tracking-[0.18em] text-cyan-500">Staff Access</p>
                  <p className="max-w-32 truncate text-sm font-bold text-cyan-300">{displayName}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-cyan-500 transition group-open:rotate-180" />
              </summary>

              <div className="absolute right-0 z-20 mt-3 w-[min(25rem,calc(100vw-2rem))] rounded-[1.8rem] border-2 border-cyan-800 bg-slate-900 p-4 shadow-[0_10px_0_rgba(21,94,117,1)]">
                {user ? (
                  <ProfilePanelInline
                    completedProtocols={completedProtocols}
                    displayName={displayName}
                    email={email}
                    hasAnomalousAccess={hasAnomalousAccess}
                    profileMessage={profileMessage}
                    username={profileUsername}
                  />
                ) : null}
              </div>
            </details>
          </div>
        </header>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Specimens', value: String(totalSpecimens) },
            { label: 'Protocols Recorded', value: totalTests.toLocaleString() },
            { label: 'Test Types', value: String(testStats.length) },
            { label: 'System Status', value: 'ACTIVE', accent: 'text-emerald-600' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[1.4rem] border-2 border-slate-200 bg-white p-4 shadow-[0_4px_0_rgba(226,232,240,1)]">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
              <p className={`mt-1 text-2xl font-black ${stat.accent ?? 'text-slate-800'}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ── Specimen overview table ── */}
        <div className="lab-card p-0 overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              Specimen Overview
              <span className="ml-2 text-[10px] text-slate-400">— All active subjects</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.15em] text-slate-400 bg-slate-50">
                  <th className="px-5 py-3 font-semibold">Rank</th>
                  <th className="px-5 py-3 font-semibold">Specimen ID</th>
                  <th className="px-5 py-3 font-semibold">Tests</th>
                  <th className="px-5 py-3 font-semibold">Score</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {specimens.slice(0, 10).map((s) => {
                  const status = specimenStatus(s.rank, s.overall_score);
                  return (
                    <tr key={s.user_id} className="border-b border-slate-100 transition hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-sm font-bold text-slate-500">
                        {s.rank === 0 ? <span className="text-rose-500">⛔</span> : `#${s.rank}`}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-black ${
                            status.label === 'HIGH YIELD' ? 'bg-rose-100 text-rose-600' :
                            status.label === 'ANOMALOUS' ? 'bg-rose-100 text-rose-600' :
                            status.label === 'MONITORED' ? 'bg-amber-100 text-amber-600' :
                            'bg-slate-100 text-slate-400'
                          }`}>
                            {s.rank <= 3 ? '!' : '•'}
                          </div>
                          <span className="font-bold text-slate-700">
                            {s.username?.replace(/-[0-9a-f]{6}$/i, '') ?? 'UNKNOWN'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{s.tests_completed}</td>
                      <td className="px-5 py-3 font-mono font-bold text-slate-800">{s.overall_score.toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em]"
                          style={{
                            backgroundColor: status.color + '18',
                            color: status.color,
                            border: `1px solid ${status.color}30`,
                          }}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Per-game stat panels ── */}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {testStats.slice(0, 8).map((stat) => (
            <div key={stat.testSlug} className="lab-card-interactive p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">{stat.label}</p>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Avg</span>
                  <span className="font-bold text-cyan-700">{stat.avgScore.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Peak</span>
                  <span className="font-bold text-amber-600">{stat.maxScore.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Count</span>
                  <span className="font-bold text-slate-700">{stat.totalTests.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-600" style={{ width: `${Math.min(100, (stat.maxScore / 1000) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Real-time feed + Core Processor ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Recent feed */}
          <div className="lab-card p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Real-time Telemetry Feed</p>
              <span className="text-[10px] text-slate-400">Last 30</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {recentSubmissions.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-slate-400">No recent submissions detected.</p>
              ) : (
                recentSubmissions.map((rs, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5 text-sm transition hover:bg-slate-50">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
                      <span className="truncate font-bold text-slate-700">{rs.username}</span>
                      <span className="shrink-0 text-slate-400">→</span>
                      <span className="shrink-0 text-slate-500">{shortSlug(rs.testSlug)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono font-bold text-amber-600">{rs.score}</span>
                      <span className="text-[10px] text-slate-400">{formatTime(rs.submittedAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Core Processor Machine ── */}
          <div className="relative overflow-hidden rounded-[1.8rem] border-2 border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-5 shadow-[0_6px_0_rgba(226,232,240,1)]">
            {/* Wire/cable decorative elements */}
            <svg className="absolute inset-0 pointer-events-none opacity-[0.04]" viewBox="0 0 600 500" preserveAspectRatio="none">
              <path d="M0,250 Q150,150 300,250 T600,200" fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="4 6" />
              <path d="M0,350 Q200,450 400,300 T600,400" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2 4" />
              <path d="M100,0 Q50,150 150,250 T300,500" fill="none" stroke="#f43f5e" strokeWidth="1" />
            </svg>

            <div className="relative z-10">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-300 bg-cyan-100">
                  <span className="text-sm font-black text-cyan-700">S-042</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Core Processor — Neural Analysis Unit</p>
                  <p className="text-xs text-slate-400">Water-cooled · 480W · Firmware v4.2.1</p>
                </div>
              </div>

              <div className="relative rounded-[1.4rem] border-2 border-slate-200 bg-white p-5">
                <div className="absolute left-0 top-0 h-full w-2 overflow-hidden rounded-l-[1.4rem]">
                  <div className="h-full w-full animate-[coolant-flow_3s_linear_infinite] bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent" />
                </div>
                <style>{`@keyframes coolant-flow{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}@keyframes neural-pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Temperature</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400" style={{ width: '72%' }} />
                      </div>
                      <span className="text-xs font-bold text-amber-600">72.4°C</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">CPU Load</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-rose-400" style={{ width: '89%' }} />
                      </div>
                      <span className="text-xs font-bold text-rose-500">89%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Coolant Flow</p>
                    <p className="mt-1 text-lg font-black text-cyan-700">12.8 <span className="text-[10px] text-slate-400">l/min</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Power Draw</p>
                    <p className="mt-1 text-lg font-black text-amber-600">480 <span className="text-[10px] text-slate-400">W</span></p>
                  </div>
                </div>

                {/* Neural network */}
                <div className="mt-5 flex items-center justify-center">
                  <div className="relative h-28 w-full max-w-sm">
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 280 80">
                      {[0, 1, 2].map((row) => [0, 1, 2, 3].map((col) => {
                        const x1 = 40 + col * 55, y1 = 10 + row * 25;
                        return [0, 1].map((ni) => {
                          const x2 = 40 + (ni === 0 ? col : col + 1) * 55;
                          const y2 = 45 + Math.floor(Math.random() * 2) * 22;
                          if (x2 > 230 || y2 > 75) return null;
                          return <line key={`${row}-${col}-${ni}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#06b6d4" strokeWidth="0.5" opacity="0.15" />;
                        });
                      }))}
                    </svg>
                    {[0, 1, 2].map((row) => [0, 1, 2, 3].map((col) => (
                      <div key={`n-${row}-${col}`} className="absolute h-2.5 w-2.5 rounded-full border border-cyan-400 bg-cyan-100"
                        style={{ left: `${28 + col * 22}%`, top: `${12 + row * 26}%`, animation: `neural-pulse ${1.5 + Math.random() * 2}s ease-in-out infinite`, animationDelay: `${Math.random() * 2}s` }} />
                    )))}
                    {[0, 1, 2, 3].map((i) => (
                      <div key={`o-${i}`} className="absolute h-2 w-2 rounded-full border border-rose-400 bg-rose-100"
                        style={{ left: `${28 + i * 22}%`, top: '76%', animation: `neural-pulse ${1.2 + Math.random() * 1.5}s ease-in-out infinite`, animationDelay: `${Math.random() * 1.5}s` }} />
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Neural matrix synchronized. Processing...
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <SiteFooter />
      </div>
    </main>
  );
}

// Inline profile panel for the monitoring room header
import { Eye, EyeOff, LogOut, MoonStar, SunMedium, UserCircle2, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { useCallback } from 'react';
import { useTheme } from '@/app/theme-provider';
import { useSoundToggle } from '@/lib/sound-toggle-context';
import { LoreTerminal } from '@/components/lore-terminal';

function ProfilePanelInline({
  completedProtocols,
  displayName,
  email,
  hasAnomalousAccess,
  profileMessage,
  username,
}: {
  completedProtocols: number;
  displayName: string;
  email: string | null;
  hasAnomalousAccess: boolean;
  profileMessage: { tone: 'success' | 'error'; title: string; description: string } | null;
  username: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const { soundEnabled, toggleSound } = useSoundToggle();
  const [mounted, setMounted] = useState(false);
  const [emailHidden, setEmailHidden] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [terminalVariant, setTerminalVariant] = useState<'access' | 'sever'>('access');
  const [accessGranted, setAccessGranted] = useState(hasAnomalousAccess);
  const [isWritingMetadata, setIsWritingMetadata] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('skillcheck-email-hidden');
    if (stored === 'true') setEmailHidden(true);
  }, []);

  const toggleEmailHidden = useCallback(() => {
    setEmailHidden((prev) => { const n = !prev; window.localStorage.setItem('skillcheck-email-hidden', n ? 'true' : 'false'); return n; });
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const isDarkMode = mounted && theme === 'dark';
  const showStaffAccess = !accessGranted && completedProtocols >= 8;
  const REQUIRED_PROTOCOLS = 8;

  const handleStaffAccess = async () => {
    if (isWritingMetadata) return;
    setIsWritingMetadata(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.updateUser({ data: { anomalous_access: true } });
      setAccessGranted(true);
      setTerminalVariant('access');
      setTerminalVisible(true);
    } catch {
      setAccessGranted(true);
      setTerminalVariant('access');
      setTerminalVisible(true);
    } finally { setIsWritingMetadata(false); }
  };

  const handleSeverUplink = async () => {
    if (isWritingMetadata) return;
    setIsWritingMetadata(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.updateUser({ data: { anomalous_access: false } });
      setAccessGranted(false);
      setTerminalVariant('sever');
      setTerminalVisible(true);
    } catch {
      setAccessGranted(false);
      setTerminalVariant('sever');
      setTerminalVisible(true);
    } finally { setIsWritingMetadata(false); }
  };

  const handleTerminalComplete = () => setTerminalVisible(false);

  return (
    <>
      {terminalVisible && <LoreTerminal variant={terminalVariant} onComplete={handleTerminalComplete} />}
      <div className="space-y-4">
        {profileMessage ? (
          <div className={`rounded-[1.3rem] border-2 p-4 ${profileMessage.tone === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
            <p className={`text-xs font-bold uppercase tracking-[0.2em] ${profileMessage.tone === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>{profileMessage.title}</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{profileMessage.description}</p>
          </div>
        ) : null}

        <div className="rounded-[1.4rem] border-2 border-cyan-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Active researcher</p>
              <p className="mt-2 text-2xl font-black text-slate-800">{displayName}</p>
              <p className="text-sm font-medium text-slate-500">{email && !emailHidden ? email : emailHidden ? 'Hidden' : 'No email available'}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-cyan-700 shadow-[0_3px_0_rgba(186,230,253,1)]">
              <UserCircle2 className="h-7 w-7" />
            </div>
          </div>
        </div>

        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 transition-all duration-150 hover:bg-slate-100" type="button" onClick={toggleTheme}>
          {isDarkMode ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </button>

        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 transition-all duration-150 hover:bg-slate-100" type="button" onClick={toggleSound}>
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {soundEnabled ? 'Turn Sounds Off' : 'Turn Sounds On'}
        </button>

        {accessGranted ? (
          <button type="button" onClick={handleSeverUplink} disabled={isWritingMetadata}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-rose-400 transition-all duration-150 hover:text-rose-600 hover:border-rose-400 border-rose-200 bg-rose-50/50">
            <ShieldAlert className="h-3 w-3" />
            {isWritingMetadata ? 'Sewering...' : 'Sever Uplink'}
          </button>
        ) : showStaffAccess ? (
          <button type="button" onClick={handleStaffAccess} disabled={isWritingMetadata}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 transition-all duration-150 hover:text-slate-600 hover:border-slate-400 border-slate-200 bg-slate-50/50">
            <ShieldAlert className="h-3 w-3" />
            {isWritingMetadata ? 'Accessing...' : 'Staff Access'}
          </button>
        ) : completedProtocols > 0 ? (
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300/50">Protocols completed: {completedProtocols}/{REQUIRED_PROTOCOLS}</p>
        ) : null}

        <form action="/auth/signout" method="post">
          <button className="lab-button-secondary flex w-full items-center justify-center gap-2" type="submit"><LogOut className="h-4 w-4" /> End Session</button>
        </form>
      </div>
    </>
  );
}