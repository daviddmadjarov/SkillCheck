'use client';

import { Eye, EyeOff, LogOut, MoonStar, SunMedium, UserCircle2, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useTheme } from '@/app/theme-provider';
import { useSoundToggle } from '@/lib/sound-toggle-context';
import { LoreTerminal } from '@/components/lore-terminal';

type ProfileMessage = {
  tone: 'success' | 'error';
  title: string;
  description: string;
} | null;

type ProfilePanelProps = {
  completedProtocols: number;
  displayName: string;
  email: string | null;
  hasAnomalousAccess: boolean;
  profileMessage: ProfileMessage;
  username: string;
};

const EMAIL_HIDDEN_KEY = 'skillcheck-email-hidden';
const REQUIRED_PROTOCOLS = 8;

export function ProfilePanel({
  completedProtocols,
  displayName,
  email,
  hasAnomalousAccess,
  profileMessage,
  username,
}: ProfilePanelProps) {
  const { theme, toggleTheme } = useTheme();
  const { soundEnabled, toggleSound } = useSoundToggle();
  const [mounted, setMounted] = useState(false);
  const [emailHidden, setEmailHidden] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [accessGranted, setAccessGranted] = useState(hasAnomalousAccess);
  const [isWritingMetadata, setIsWritingMetadata] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(EMAIL_HIDDEN_KEY);
    if (stored === 'true') {
      setEmailHidden(true);
    }
  }, []);

  const toggleEmailHidden = useCallback(() => {
    setEmailHidden((prev) => {
      const next = !prev;
      window.localStorage.setItem(EMAIL_HIDDEN_KEY, next ? 'true' : 'false');
      return next;
    });
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const isDarkMode = mounted && theme === 'dark';
  const showStaffAccess = !accessGranted && completedProtocols >= REQUIRED_PROTOCOLS;

  const handleStaffAccess = async () => {
    if (isWritingMetadata) return;
    setIsWritingMetadata(true);

    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.updateUser({ data: { anomalous_access: true } });
      setAccessGranted(true);
      setTerminalVisible(true);
    } catch {
      // Fallback: still show terminal even if supabase call fails
      setAccessGranted(true);
      setTerminalVisible(true);
    } finally {
      setIsWritingMetadata(false);
    }
  };

  const handleTerminalComplete = () => {
    setTerminalVisible(false);
  };

  return (
    <>
      {terminalVisible && <LoreTerminal onComplete={handleTerminalComplete} />}

      <div className={`space-y-4 rounded-[1.6rem] border-2 p-4 ${isDarkMode ? 'border-slate-700 bg-slate-950 text-slate-100 shadow-[0_10px_0_rgba(15,23,42,0.65)]' : 'border-cyan-200 bg-cyan-50 shadow-[0_10px_0_rgba(186,230,253,0.8)]'}`}>
        {profileMessage ? (
          <div
            className={`rounded-[1.3rem] border-2 p-4 ${
              profileMessage.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-rose-200 bg-rose-50'
            }`}
          >
            <p
              className={`text-xs font-bold uppercase tracking-[0.2em] ${
                profileMessage.tone === 'success' ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {profileMessage.title}
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              {profileMessage.description}
            </p>
          </div>
        ) : null}

        <div className={`rounded-[1.4rem] border-2 p-4 ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-cyan-200 bg-white'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.2em] ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
                Active researcher
              </p>
              <p className={`mt-2 text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {displayName}
              </p>
              <div className="flex items-center gap-2">
                <p className={`break-all text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                  {email && !emailHidden ? email : emailHidden ? 'Hidden' : 'No gmail available'}
                </p>
                {email ? (
                  <button
                    className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-150 ${
                      isDarkMode
                        ? 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                    type="button"
                    onClick={toggleEmailHidden}
                    title={emailHidden ? 'Show email' : 'Hide email from stream'}
                  >
                    {emailHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {emailHidden ? 'Show' : 'Hide'}
                  </button>
                ) : null}
              </div>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isDarkMode ? 'bg-slate-800 text-cyan-300 shadow-[0_3px_0_rgba(51,65,85,1)]' : 'bg-white text-cyan-700 shadow-[0_3px_0_rgba(186,230,253,1)]'}`}>
              <UserCircle2 className="h-7 w-7" />
            </div>
          </div>
        </div>

        <form action="/profile/username" className="space-y-3" method="post">
          <label className={`block text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-600'}`} htmlFor="username">
            Public username
          </label>
          <input
            className="lab-input"
            defaultValue={username}
            id="username"
            maxLength={24}
            name="username"
            placeholder="Choose your leaderboard name"
            type="text"
          />
          <p className={`text-sm font-medium leading-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
            This name appears on the leaderboard and can use letters, numbers, spaces, dashes, and underscores.
          </p>
          <button className="lab-button w-full" type="submit">
            Save Username
          </button>
        </form>

        <button
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-6 py-3 font-bold transition-all duration-150 ${isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
          type="button"
          onClick={toggleTheme}
        >
          {isDarkMode ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </button>

        <button
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-6 py-3 font-bold transition-all duration-150 ${isDarkMode ? 'border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
          type="button"
          onClick={toggleSound}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {soundEnabled ? 'Turn Sounds Off' : 'Turn Sounds On'}
        </button>

        {/* ── Staff Access button (lore) ── */}
        {showStaffAccess ? (
          <button
            type="button"
            onClick={handleStaffAccess}
            disabled={isWritingMetadata}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 transition-all duration-150 hover:text-slate-600 hover:border-slate-400 border-slate-200 bg-slate-50/50"
          >
            <ShieldAlert className="h-3 w-3" />
            {isWritingMetadata ? 'Accessing...' : 'Staff Access'}
          </button>
        ) : accessGranted ? (
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.25em] text-rose-400/60">
            Diagnostic Override Active
          </p>
        ) : completedProtocols > 0 ? (
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300/50">
            Protocols completed: {completedProtocols}/{REQUIRED_PROTOCOLS}
          </p>
        ) : null}

        <form action="/auth/signout" method="post">
          <button className="lab-button-secondary flex w-full items-center justify-center gap-2" type="submit">
            <LogOut className="h-4 w-4" />
            End Session
          </button>
        </form>
      </div>
    </>
  );
}