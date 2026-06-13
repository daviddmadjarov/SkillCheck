'use client';

import { LogOut, MoonStar, SunMedium, UserCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTheme } from '@/app/theme-provider';

type ProfileMessage = {
  tone: 'success' | 'error';
  title: string;
  description: string;
} | null;

type ProfilePanelProps = {
  displayName: string;
  email: string | null;
  profileMessage: ProfileMessage;
  username: string;
};

export function ProfilePanel({ displayName, email, profileMessage, username }: ProfilePanelProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const isDarkMode = mounted && theme === 'dark';

  return (
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
            <p className={`mt-1 break-all text-sm font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>
              {email ?? 'No gmail available'}
            </p>
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

      <form action="/auth/signout" method="post">
        <button className="lab-button-secondary flex w-full items-center justify-center gap-2" type="submit">
          <LogOut className="h-4 w-4" />
          End Session
        </button>
      </form>
    </div>
  );
}