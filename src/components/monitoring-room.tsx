'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, ChevronDown, Eye, EyeOff, LogOut, MoonStar, ShieldAlert, SunMedium, UserCircle2, Volume2, VolumeX } from 'lucide-react';
import { SiteFooter } from '@/app/site-footer';
import { useTheme } from '@/app/theme-provider';
import { useSoundToggle } from '@/lib/sound-toggle-context';
import { LoreTerminal } from '@/components/lore-terminal';
import StasisChamber from '@/components/stasis-chamber';

type MonitoringRoomProps = {
  displayName: string;
  initials: string;
  completedProtocols: number;
  email: string | null;
  hasAnomalousAccess: boolean;
  profileMessage: { tone: 'success' | 'error'; title: string; description: string } | null;
  profileUsername: string;
  user: unknown;
};

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
  const [accessCode, setAccessCode] = useState('');
  const [loreTerminalVariant, setLoreTerminalVariant] = useState<'access' | 'sever'>('access');
  const [showLoreTerminal, setShowLoreTerminal] = useState(false);

  const handleLoreTerminalComplete = () => {
    setShowLoreTerminal(false);
    window.location.href = '/';
  };

  const handleShowLoreTerminal = (variant: 'access' | 'sever') => {
    setLoreTerminalVariant(variant);
    setShowLoreTerminal(true);
  };

  return (
    <>
      {showLoreTerminal && <LoreTerminal variant={loreTerminalVariant} onComplete={handleLoreTerminalComplete} />}
      <main className="min-h-screen bg-[#060d18] text-slate-200">
        {/* Dark header bar */}
        <header className="sticky top-0 z-40 border-b border-cyan-900/50 bg-[#0a1628]/95 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-cyan-700 bg-cyan-950 shadow-[0_3px_0_rgba(14,116,144,1)]">
                <Activity className="h-5 w-5 text-cyan-400" strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-cyan-300 sm:text-xl">Aethelgard Sight</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700">Monitoring Station v4.2 · CLASSIFIED</p>
              </div>
            </Link>

            {/* Profile dropdown */}
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full border-2 border-cyan-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-cyan-400 transition-all duration-150 hover:-translate-y-1 hover:bg-slate-800 hover:shadow-[0_6px_0_rgba(21,94,117,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(21,94,117,1)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 text-sm font-black text-white shadow-[0_3px_0_rgba(14,116,144,1)]">
                  {initials || 'SC'}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-xs uppercase tracking-[0.18em] text-cyan-500">Staff</p>
                  <p className="max-w-32 truncate text-sm font-bold text-cyan-300">{displayName}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-cyan-500 transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 z-20 mt-3 w-[min(25rem,calc(100vw-2rem))] rounded-[1.8rem] border-2 border-cyan-800 bg-slate-900 p-4 shadow-[0_10px_0_rgba(21,94,117,1)]">
                <ProfilePanelInline
                  completedProtocols={completedProtocols}
                  displayName={displayName}
                  email={email}
                  hasAnomalousAccess={hasAnomalousAccess}
                  profileMessage={profileMessage}
                  username={profileUsername}
                  onShowTerminal={handleShowLoreTerminal}
                />
              </div>
            </details>
          </div>
        </header>

        {/* Main content */}
        <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center gap-8 px-4 py-8 sm:px-6 sm:py-10">
          {/* Status indicators */}
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              SYSTEM ACTIVE
            </div>
            <span className="text-slate-700">|</span>
            <span>POWER: 480W</span>
            <span className="text-slate-700">|</span>
            <span>COOLANT: 12.8 l/min</span>
            <span className="text-slate-700">|</span>
            <span>TEMP: 72.4°C</span>
          </div>

          {/* STASIS POD */}
          <div className="relative w-full max-w-[600px]">
            {/* Top cables */}
            <svg className="absolute -top-12 left-1/2 -translate-x-1/2 pointer-events-none" width="340" height="60" viewBox="0 0 340 60">
              <path d="M120,0 Q130,30 140,50" fill="none" stroke="#1e3a5f" strokeWidth="3" strokeLinecap="round" />
              <path d="M140,0 Q155,25 160,48" fill="none" stroke="#164e63" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M160,0 Q165,20 170,45" fill="none" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" />
              <path d="M180,0 Q175,28 180,47" fill="none" stroke="#164e63" strokeWidth="3" strokeLinecap="round" />
              <path d="M200,0 Q195,22 200,48" fill="none" stroke="#1e3a5f" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M220,0 Q215,25 210,50" fill="none" stroke="#164e63" strokeWidth="2" strokeLinecap="round" />
            </svg>

            {/* Pod body */}
            <div className="relative rounded-[3rem] border-[4px] border-cyan-900 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-6 shadow-[0_0_60px_rgba(8,145,178,0.08),inset_0_0_80px_rgba(0,0,0,0.5)] sm:p-8">
              {/* Top rivet band */}
              <div className="absolute left-0 right-0 top-0 h-6 overflow-hidden rounded-t-[2.5rem] bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600">
                <div className="flex justify-around px-4 pt-1.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-3 w-3 rounded-full border border-slate-400 bg-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]" />
                  ))}
                </div>
              </div>
              {/* Bottom rivet band */}
              <div className="absolute left-0 right-0 bottom-0 h-6 overflow-hidden rounded-b-[2.5rem] bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600">
                <div className="flex justify-around px-4 pt-1.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-3 w-3 rounded-full border border-slate-400 bg-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]" />
                  ))}
                </div>
              </div>

              {/* Glass chamber — StasisChamber */}
              <div className="relative mx-auto mb-4 mt-3 w-full max-w-[320px]">
                <div className="absolute -inset-2 rounded-[2rem] bg-cyan-500/5 blur-xl" />
                <div className="relative overflow-hidden rounded-[2rem] border-[3px] border-cyan-800/60 bg-gradient-to-b from-cyan-950/80 via-slate-900 to-cyan-950/80 shadow-[inset_0_0_60px_rgba(8,145,178,0.15)]">
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-cyan-500/5 opacity-70" />
                  <div className="relative flex h-[200px] items-center justify-center sm:h-[260px]">
                    <StasisChamber />
                  </div>
                  <div className="absolute left-2 top-0 h-full w-4 bg-gradient-to-r from-white/10 to-transparent -skew-x-3 pointer-events-none" />
                  <div className="absolute left-6 top-0 h-full w-1 bg-gradient-to-r from-white/5 to-transparent -skew-x-3 pointer-events-none" />
                </div>
                {/* Frame bolts */}
                {[-1, -1, 1, 1].map((x, i) => (
                  <div key={i} className={`absolute ${x < 0 ? '-left-1.5' : '-right-1.5'} ${i % 2 === 0 ? 'top-8' : 'bottom-8'} h-3 w-3 rounded-full border border-cyan-600 bg-cyan-900 shadow-[0_0_6px_rgba(8,145,178,0.5)]`} />
                ))}
              </div>

              {/* Coolant pipes */}
              <div className="mb-3 flex items-center justify-center gap-1 px-4">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <div className="h-8 w-1.5 rounded-full bg-gradient-to-b from-cyan-700 via-cyan-600 to-cyan-800 shadow-[0_0_8px_rgba(8,145,178,0.4)]">
                      <div className="h-full w-full animate-[coolant_3s_linear_infinite] bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent" />
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full border border-slate-500 bg-slate-600" />
                  </div>
                ))}
              </div>

              {/* Water cooling unit */}
              <div className="relative mx-auto max-w-[400px] rounded-[1.5rem] border-2 border-slate-600 bg-gradient-to-b from-slate-700 to-slate-800 p-4 shadow-[0_4px_0_rgba(30,41,59,1),inset_0_2px_8px_rgba(0,0,0,0.4)]">
                <div className="flex justify-center gap-1">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="h-8 w-1.5 rounded bg-gradient-to-b from-slate-500 via-slate-400 to-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-500 bg-slate-900 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">COOLING ACTIVE</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-8 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400" />
                      </div>
                      <span className="text-[9px] text-slate-500">FLOW</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-8 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-amber-500 to-rose-500" />
                      </div>
                      <span className="text-[9px] text-slate-500">TEMP</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Side cables */}
              <svg className="absolute -left-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" width="30" height="200" viewBox="0 0 30 200">
                <path d="M25,0 Q30,50 20,100 Q10,150 25,200" fill="none" stroke="#1e3a5f" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M18,0 Q22,50 12,100 Q8,150 18,200" fill="none" stroke="#164e63" strokeWidth="2" strokeLinecap="round" strokeDasharray="8 4" />
              </svg>
              <svg className="absolute -right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" width="30" height="200" viewBox="0 0 30 200">
                <path d="M5,0 Q0,50 10,100 Q20,150 5,200" fill="none" stroke="#1e3a5f" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M12,0 Q8,50 18,100 Q22,150 12,200" fill="none" stroke="#164e63" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 3" />
              </svg>
            </div>

            {/* Bottom pipes */}
            <svg className="pointer-events-none mx-auto mt-0" width="200" height="40" viewBox="0 0 200 40">
              <path d="M60,0 Q80,20 100,30 Q120,40 140,40" fill="none" stroke="#1e3a5f" strokeWidth="3" strokeLinecap="round" />
              <path d="M70,0 Q85,15 100,25 Q115,35 130,40" fill="none" stroke="#164e63" strokeWidth="2" strokeLinecap="round" />
              <path d="M80,0 Q90,10 100,20 Q110,30 120,40" fill="none" stroke="#1e3a5f" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 3" />
            </svg>
          </div>

          {/* CODE ENTRY TERMINAL */}
          <div className="w-full max-w-[500px]">
            <div className="relative rounded-[1.8rem] border-2 border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 p-5 shadow-[0_6px_0_rgba(30,41,59,1),inset_0_2px_10px_rgba(0,0,0,0.5)] sm:p-6">
              <div className="mb-4 flex items-center justify-between text-[10px] text-slate-500">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                  TERMINAL 02 — STASIS CONTROL
                </span>
                <span>SECURE LINE</span>
              </div>

              <div className="relative overflow-hidden rounded-[1.2rem] border-2 border-slate-600 bg-slate-950 p-4 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
                <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(rgba(255,255,255,0.05) 0px, transparent 2px, transparent 4px)' }} />
                <div className="relative z-10 space-y-2 font-mono text-sm">
                  <p className="text-cyan-500">AethelgardOS v4.2.1 — S-042 Interface</p>
                  <p className="text-slate-600">────────────────────────────────────</p>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400">{'>'}</span>
                    <span className="text-slate-400">STATUS: </span>
                    <span className="text-emerald-400 font-bold">POD INTEGRITY 100% — SPECIMEN STABLE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400">{'>'}</span>
                    <span className="text-slate-400">LAST CALIBRATION: </span>
                    <span className="text-slate-300">{new Date().toISOString().split('T')[0]}</span>
                  </div>
                  <p className="text-slate-600">────────────────────────────────────</p>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 animate-pulse">{'>'}</span>
                    <span className="text-cyan-300">ENTER ACCESS CODE:</span>
                  </div>
                  <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase().slice(0, 12))} placeholder="_ _ _ _ _ _ _ _ _ _ _ _" maxLength={12} className="w-full border-0 border-b-2 border-cyan-700 bg-transparent px-1 py-2 font-mono text-lg tracking-[0.3em] text-cyan-300 placeholder-slate-700 outline-none focus:border-cyan-400 transition-colors" />
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-600">INPUT</span>
                    <span className="text-slate-600">{accessCode.length}/12 CHARACTERS</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button onClick={() => setAccessCode('')} className="flex-1 rounded-xl border-2 border-slate-600 bg-slate-800 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 transition hover:border-slate-500 hover:bg-slate-700 hover:text-slate-300 active:translate-y-0.5">CLEAR</button>
                <button onClick={() => { if (accessCode.length > 0) { setAccessCode('CODE SUBMITTED — PROCESSING...'); setTimeout(() => setAccessCode(''), 2000); } }} className="flex-[2] rounded-xl border-2 border-cyan-800 bg-cyan-950 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400 shadow-[0_3px_0_rgba(14,116,144,1)] transition hover:bg-cyan-900 hover:text-cyan-300 active:translate-y-1 active:shadow-[0_0px_0_rgba(14,116,144,1)]">EXECUTE</button>
              </div>

              <div className="mt-3 flex items-center gap-3 text-[9px] text-slate-600">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> PWR</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> WRN</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-700" /> ERR</span>
                <span className="ml-auto">LOCKED</span>
              </div>
            </div>
          </div>

        </div>
        <style>{`@keyframes coolant{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}@keyframes float-up{0%{transform:translateY(100%) scale(0.5);opacity:0}10%{opacity:0.6}50%{transform:translateY(-150px) translateX(8px) scale(1)}75%{transform:translateY(-250px) translateX(-4px) scale(0.9)}100%{transform:translateY(-340px) scale(0.3);opacity:0}}`}</style>
      </main>
    </>
  );
}

// ── Inline profile panel ──
function ProfilePanelInline({
  completedProtocols,
  displayName,
  email,
  hasAnomalousAccess,
  profileMessage,
  username,
  onShowTerminal,
}: {
  completedProtocols: number;
  displayName: string;
  email: string | null;
  hasAnomalousAccess: boolean;
  profileMessage: { tone: 'success' | 'error'; title: string; description: string } | null;
  username: string;
  onShowTerminal: (variant: 'access' | 'sever') => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const { soundEnabled, toggleSound } = useSoundToggle();
  const [mounted, setMounted] = useState(false);
  const [emailHidden, setEmailHidden] = useState(false);
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
      onShowTerminal('access');
    } catch {
      setAccessGranted(true);
      onShowTerminal('access');
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
      onShowTerminal('sever');
    } catch {
      setAccessGranted(false);
      onShowTerminal('sever');
    } finally { setIsWritingMetadata(false); }
  };

  return (
    <div className="space-y-4">
      {profileMessage ? (
        <div className={`rounded-[1.3rem] border-2 p-4 ${profileMessage.tone === 'success' ? 'border-emerald-800 bg-emerald-950' : 'border-rose-800 bg-rose-950'}`}>
          <p className={`text-xs font-bold uppercase tracking-[0.2em] ${profileMessage.tone === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{profileMessage.title}</p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-300">{profileMessage.description}</p>
        </div>
      ) : null}
      <div className="rounded-[1.4rem] border-2 border-cyan-800 bg-slate-800 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Active researcher</p>
            <p className="mt-2 text-2xl font-black text-slate-100">{displayName}</p>
            <p className="text-sm font-medium text-slate-400">{email && !emailHidden ? email : emailHidden ? 'Hidden' : 'No email available'}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-700 text-cyan-400 shadow-[0_3px_0_rgba(21,94,117,1)]">
            <UserCircle2 className="h-7 w-7" />
          </div>
        </div>
      </div>
      <button className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-600 bg-slate-800 px-6 py-3 font-bold text-slate-300 transition-all duration-150 hover:bg-slate-700" type="button" onClick={toggleTheme}>
        {mounted && theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
        {mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>
      <button className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-600 bg-slate-800 px-6 py-3 font-bold text-slate-300 transition-all duration-150 hover:bg-slate-700" type="button" onClick={toggleSound}>
        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        {soundEnabled ? 'Turn Sounds Off' : 'Turn Sounds On'}
      </button>
      {accessGranted ? (
        <button type="button" onClick={handleSeverUplink} disabled={isWritingMetadata}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-rose-400 transition-all duration-150 hover:text-rose-300 hover:border-rose-600 border-rose-800 bg-rose-950/50">
          <ShieldAlert className="h-3 w-3" /> {isWritingMetadata ? 'Sewering...' : 'Sever Uplink'}
        </button>
      ) : showStaffAccess ? (
        <button type="button" onClick={handleStaffAccess} disabled={isWritingMetadata}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 transition-all duration-150 hover:text-slate-300 hover:border-slate-500 border-slate-600 bg-slate-800">
          <ShieldAlert className="h-3 w-3" /> {isWritingMetadata ? 'Accessing...' : 'Staff Access'}
        </button>
      ) : completedProtocols > 0 ? (
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Protocols completed: {completedProtocols}/{REQUIRED_PROTOCOLS}</p>
      ) : null}
      <form action="/auth/signout" method="post">
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-600 bg-slate-800 px-6 py-3 font-bold text-slate-400 transition-all duration-150 hover:bg-slate-700 hover:text-slate-300" type="submit"><LogOut className="h-4 w-4" /> End Session</button>
      </form>
    </div>
  );
}