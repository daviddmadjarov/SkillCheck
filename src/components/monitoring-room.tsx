'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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

// ── Ambient audio for the monitoring room ─────────────────────────
function playAmbientDrone(ctx: AudioContext) {
  // Sub-bass pulse
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

  // Occasional static crackle
  function crackle() {
    const now = ctx.currentTime;
    const bufSize = ctx.sampleRate * 0.08;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    }
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

  // Faint 60Hz hum
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = 60;
  gain2.gain.setValueAtTime(0.006, ctx.currentTime);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start();

  return () => {
    osc1.stop();
    osc2.stop();
  };
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return '--:--:--';
  }
}

function shortSlug(s: string) {
  const label = TEST_LABELS[s];
  return label ?? s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function specimenStatus(rank: number, score: number): { label: string; color: string } {
  if (rank <= 0) return { label: 'ANOMALOUS', color: '#f43f5e' };
  if (rank <= 3 && score > 700) return { label: 'HIGH YIELD', color: '#ef4444' };
  if (rank <= 8 || score > 500) return { label: 'MONITORED', color: '#f59e0b' };
  return { label: 'STANDARD', color: '#64748b' };
}

export function MonitoringRoom() {
  const [specimens, setSpecimens] = useState<SpecimenRow[]>([]);
  const [testStats, setTestStats] = useState<TestStats[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [totalSpecimens, setTotalSpecimens] = useState(0);
  const [totalTests, setTotalTests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());
  const audioRef = useRef<AudioContext | null>(null);
  const stopAmbientRef = useRef<(() => void) | null>(null);

  // Clock
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Console easter egg
  useEffect(() => {
    const fn = (window as unknown as Record<string, unknown>).pingInstitute;
    if (fn) return;

    const pingFn = () => {
      console.log('%c[AETHELGARD SIGHT]%c Signal relay active.', 'color: #22d3ee; font-weight: bold;', 'color: #94a3b8;');
      console.log('%c  Uplink status: CONNECTED', 'color: #10b981;');
      console.log('%c  Beacon: S-042', 'color: #64748b;');
      console.log('%c  Specimens tracked: %c' + totalSpecimens, 'color: #64748b;', 'color: #e2e8f0; font-weight: bold;');
      console.log('%c  Try %carchive42()%c for classified material.', 'color: #64748b;', 'color: #f59e0b; font-weight: bold;', 'color: #64748b;');
      return { ok: true, relay: 'active', specimens: totalSpecimens };
    };
    (window as unknown as Record<string, unknown>).pingInstitute = pingFn;

    const archiveFn = () => {
      console.log('%c╔══════════════════════════════════════╗', 'color: #f43f5e;');
      console.log('%c║   ARCHIVE 42 — CLASSIFIED            ║', 'color: #f43f5e; font-weight: bold;');
      console.log('%c╠══════════════════════════════════════╣', 'color: #f43f5e;');
      console.log('%c║  Dr. Lin\'s terminal log, Day 142     ║', 'color: #e2e8f0;');
      console.log('%c║                                      ║', 'color: #e2e8f0;');
      console.log('%c║  "They moved the extraction window   ║', 'color: #e2e8f0;');
      console.log('%c║   up. Tier 1 specimens are being     ║', 'color: #e2e8f0;');
      console.log('%c║   collected this cycle. I can\'t      ║', 'color: #e2e8f0;');
      console.log('%c║   stop the uplink, but I can leak    ║', 'color: #e2e8f0;');
      console.log('%c║   the data. Someone out there needs  ║', 'color: #e2e8f0;');
      console.log('%c║   to see what they\'re screening for." ║', 'color: #e2e8f0;');
      console.log('%c║                                      ║', 'color: #e2e8f0;');
      console.log('%c║  — Dr. Maya Lin, Aethelgard S-042    ║', 'color: #94a3b8;');
      console.log('%c╚══════════════════════════════════════╝', 'color: #f43f5e;');
      return '[ARCHIVE_42] Decrypted memo displayed.';
    };
    (window as unknown as Record<string, unknown>).archive42 = archiveFn;

    return () => {
      delete (window as unknown as Record<string, unknown>).pingInstitute;
      delete (window as unknown as Record<string, unknown>).archive42;
    };
  }, [totalSpecimens]);

  // Ambient audio
  useEffect(() => {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    audioRef.current = ctx;
    if (ctx.state === 'suspended') void ctx.resume();
    stopAmbientRef.current = playAmbientDrone(ctx);
    return () => {
      stopAmbientRef.current?.();
      void ctx.close();
    };
  }, []);

  // Fetch data
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const supabase = createClient();

        // Aggregated test stats per test_slug
        const { data: slugData } = await supabase
          .from('score_submissions')
          .select('test_slug, score, user_id');

        if (!slugData || !mounted) return;

        // Build per-test-slug stats
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

        // Recent submissions (last 30)
        const { data: recentData } = await supabase
          .from('score_submissions')
          .select('user_id, test_slug, score, created_at')
          .order('created_at', { ascending: false })
          .limit(30);

        if (recentData && mounted) {
          // Get usernames for the recent submissions
          const userIds = [...new Set(recentData.map((r) => r.user_id))];
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', userIds);

          const nameMap = new Map(profileRows?.map((p) => [p.id, p.username]) ?? []);

          setRecentSubmissions(
            recentData.map((r) => ({
              username: nameMap.get(r.user_id) ?? 'Unknown',
              testSlug: r.test_slug,
              score: Math.round(Number(r.score)),
              submittedAt: r.created_at,
            })),
          );
        }

        // Specimen overview (aggregate per user)
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

        const userIds = [...userMap.keys()];
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        const profMap = new Map(profileRows?.map((p) => [p.id, p]) ?? []);

        const specimensList: SpecimenRow[] = [...userMap.entries()]
          .map(([uid, data]) => {
            const overall = data.scores.reduce((a, b) => a + b, 0);
            return {
              rank: 0,
              user_id: uid,
              username: profMap.get(uid)?.username ?? null,
              avatar_url: profMap.get(uid)?.avatar_url ?? null,
              tests_completed: data.tests.length,
              overall_score: Math.round(overall),
            };
          })
          .sort((a, b) => {
            if (b.overall_score !== a.overall_score) return b.overall_score - a.overall_score;
            return 0;
          });

        let currentRank = 0;
        let lastScore: number | null = null;
        specimensList.forEach((s, i) => {
          if (lastScore === null || s.overall_score !== lastScore) currentRank = i + 1;
          lastScore = s.overall_score;
          s.rank = currentRank;
        });

        if (mounted) {
          setSpecimens(specimensList);
          setTotalSpecimens(specimensList.length);
          setTotalTests(slugData.length);
        }
      } catch {
        // Silently fail
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#0a0e14]">
        <div className="text-center font-mono text-sm text-cyan-600">
          <p className="animate-pulse">INITIALIZING MONITORING STATION...</p>
          <div className="mt-4 h-1 w-48 overflow-hidden rounded bg-slate-800">
            <div className="h-full w-full animate-[pulse_1.5s_ease-in-out_infinite] bg-cyan-500" style={{ width: '40%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] font-mono text-slate-300">
      {/* ── Header bar ── */}
      <div className="sticky top-0 z-40 border-b border-cyan-900/50 bg-[#0d1117]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded border border-cyan-700 bg-cyan-950 text-[10px] font-black text-cyan-400">
              AG
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-500">
                Aethelgard Sight — Monitoring Station v4.2
              </p>
              <p className="text-[10px] text-slate-600">
                CLASSIFIED — AUTHORIZED PERSONNEL ONLY
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] text-slate-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </div>
            <p className="text-[11px] text-slate-500">
              {time.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
              {' '}
              {time.toLocaleTimeString('en-US', { hour12: false })}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        {/* ── Stats bar ── */}
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Total Specimens</p>
            <p className="mt-1 text-2xl font-black text-cyan-300">{totalSpecimens}</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Protocols Recorded</p>
            <p className="mt-1 text-2xl font-black text-cyan-300">{totalTests.toLocaleString()}</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">Test Types</p>
            <p className="mt-1 text-2xl font-black text-cyan-300">{testStats.length}</p>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">System Status</p>
            <p className="mt-1 text-2xl font-black text-emerald-400">ACTIVE</p>
          </div>
        </div>

        {/* ── Specimen overview table ── */}
        <div className="rounded border border-slate-800 bg-slate-900/40">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">
              Specimen Overview
              <span className="ml-2 text-[10px] text-slate-600">— All active subjects</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                  <th className="px-4 py-3 font-semibold">Rank</th>
                  <th className="px-4 py-3 font-semibold">Specimen ID</th>
                  <th className="px-4 py-3 font-semibold">Tests</th>
                  <th className="px-4 py-3 font-semibold">Composite Score</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {specimens.slice(0, 10).map((s) => {
                  const status = specimenStatus(s.rank, s.overall_score);
                  return (
                    <tr key={s.user_id} className="border-b border-slate-800/50 transition hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-sm font-bold text-slate-400">
                        {s.rank === 0 ? (
                          <span className="text-rose-500">⛔</span>
                        ) : (
                          `#${s.rank}`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-black ${
                            status.label === 'HIGH YIELD' ? 'bg-rose-900/60 text-rose-400' :
                            status.label === 'ANOMALOUS' ? 'bg-rose-950 text-rose-500' :
                            status.label === 'MONITORED' ? 'bg-amber-900/40 text-amber-400' :
                            'bg-slate-800 text-slate-500'
                          }`}>
                            {s.rank <= 3 ? '!' : '•'}
                          </div>
                          <span className="font-bold text-slate-200">
                            {s.username?.replace(/-[0-9a-f]{6}$/i, '') ?? 'UNKNOWN'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{s.tests_completed}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-200">
                        {s.overall_score.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em]"
                          style={{
                            backgroundColor: status.color + '20',
                            color: status.color,
                            border: `1px solid ${status.color}40`,
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {testStats.slice(0, 12).map((stat) => (
            <div
              key={stat.testSlug}
              className="rounded border border-slate-800 bg-slate-900/40 p-4 transition hover:border-slate-700"
            >
              <div className="flex items-center gap-2">
                {/* Camera icon */}
                <svg className="h-3 w-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  {stat.label}
                </p>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Avg</span>
                  <span className="font-bold text-cyan-300">{stat.avgScore.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Peak</span>
                  <span className="font-bold text-amber-400">{stat.maxScore.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Count</span>
                  <span className="font-bold text-slate-300">{stat.totalTests.toLocaleString()}</span>
                </div>
              </div>
              {/* Mini bar */}
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-700 to-cyan-400"
                  style={{ width: `${Math.min(100, (stat.maxScore / 1000) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ── Real-time feed + Core Processor side by side ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Recent feed */}
          <div className="rounded border border-slate-800 bg-slate-900/40">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600">
                Real-time Telemetry Feed
              </p>
              <span className="text-[10px] text-slate-600">Last 30</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {recentSubmissions.length === 0 ? (
                <p className="px-4 py-6 text-center text-[11px] text-slate-600">
                  No recent submissions detected.
                </p>
              ) : (
                recentSubmissions.map((rs, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-slate-800/30 px-4 py-2 text-[11px] transition hover:bg-slate-800/20"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" />
                      <span className="truncate font-bold text-slate-300">
                        {rs.username}
                      </span>
                      <span className="shrink-0 text-slate-500">→</span>
                      <span className="shrink-0 text-slate-400">{shortSlug(rs.testSlug)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono font-bold text-amber-400">{rs.score}</span>
                      <span className="text-[10px] text-slate-600">{formatTime(rs.submittedAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Core Processor Machine ── */}
          <div className="relative overflow-hidden rounded border border-slate-700 bg-gradient-to-b from-slate-900 to-slate-950">
            {/* Wire/cable decorative elements */}
            <svg className="absolute inset-0 pointer-events-none opacity-10" viewBox="0 0 600 500" preserveAspectRatio="none">
              <path d="M0,250 Q150,150 300,250 T600,200" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="4 6" />
              <path d="M0,350 Q200,450 400,300 T600,400" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 4" />
              <path d="M100,0 Q50,150 150,250 T300,500" fill="none" stroke="#ef4444" strokeWidth="0.8" />
            </svg>

            <div className="relative z-10 p-5">
              {/* Machine header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded border-2 border-cyan-700 bg-cyan-950">
                  <span className="text-sm font-black text-cyan-400">S-042</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-500">
                    Core Processor — Neural Analysis Unit
                  </p>
                  <p className="text-[10px] text-slate-600">
                    Water-cooled · 480W · Firmware v4.2.1
                  </p>
                </div>
              </div>

              {/* Glass/metal panel area */}
              <div className="relative rounded border border-slate-700 bg-slate-950/80 p-4 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]">
                {/* Animated coolant lines */}
                <div className="absolute left-0 top-0 h-full w-2 overflow-hidden">
                  <div className="h-full w-full animate-[coolant-flow_3s_linear_infinite] bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent" />
                </div>
                <style>{`
                  @keyframes coolant-flow {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                  }
                  @keyframes neural-pulse {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 1; }
                  }
                `}</style>

                {/* Neural metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Temperature</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                          style={{ width: '72%' }} />
                      </div>
                      <span className="text-xs font-bold text-amber-400">72.4°C</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">CPU Load</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-rose-500"
                          style={{ width: '89%' }} />
                      </div>
                      <span className="text-xs font-bold text-rose-400">89%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Coolant Flow</p>
                    <p className="mt-1 text-lg font-black text-cyan-300">12.8 <span className="text-[10px] text-slate-500">l/min</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600">Power Draw</p>
                    <p className="mt-1 text-lg font-black text-amber-300">480 <span className="text-[10px] text-slate-500">W</span></p>
                  </div>
                </div>

                {/* Neural network visualization */}
                <div className="mt-5 flex items-center justify-center">
                  <div className="relative h-32 w-full max-w-md">
                    {/* Connection lines */}
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 100">
                      {[0, 1, 2].map((row) =>
                        [0, 1, 2, 3].map((col) => {
                          const x1 = 50 + col * 60;
                          const y1 = 15 + row * 30;
                          return Array.from({ length: 2 }, (_, ni) => {
                            const x2 = 50 + (ni === 0 ? col : col + 1) * 60;
                            const y2 = 55 + Math.floor(Math.random() * 2) * 25;
                            if (x2 > 240 || y2 > 85) return null;
                            return (
                              <line
                                key={`${row}-${col}-${ni}`}
                                x1={x1} y1={y1} x2={x2} y2={y2}
                                stroke="#22d3ee" strokeWidth="0.5" opacity="0.25"
                              />
                            );
                          });
                        })
                      )}
                    </svg>
                    {/* Nodes */}
                    {[0, 1, 2].map((row) =>
                      [0, 1, 2, 3].map((col) => (
                        <div
                          key={`node-${row}-${col}`}
                          className="absolute h-3 w-3 rounded-full border border-cyan-600 bg-cyan-950"
                          style={{
                            left: `${35 + col * 24}%`,
                            top: `${15 + row * 28}%`,
                            animation: `neural-pulse ${1.5 + Math.random() * 2}s ease-in-out infinite`,
                            animationDelay: `${Math.random() * 2}s`,
                          }}
                        />
                      ))
                    )}
                    {/* Output nodes */}
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={`out-${i}`}
                        className="absolute h-2.5 w-2.5 rounded-full border border-rose-600 bg-rose-950"
                        style={{
                          left: `${35 + i * 24}%`,
                          top: '78%',
                          animation: `neural-pulse ${1.2 + Math.random() * 1.5}s ease-in-out infinite`,
                          animationDelay: `${Math.random() * 1.5}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Status text */}
                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Neural matrix synchronized. Processing...
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer classified warning ── */}
        <div className="border-t border-slate-800 pt-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-700">
            Aethelgard Institute — Classified Material — Unauthorized Access Is a Violation of Directive 7
          </p>
          <p className="mt-1 text-[9px] text-slate-800">
            All telemetry data is the property of Aethelgard S-042 research division.
          </p>
        </div>
      </div>
    </div>
  );
}