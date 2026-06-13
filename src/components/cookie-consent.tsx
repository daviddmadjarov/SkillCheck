'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'skillcheck_cookie_consent';
type ConsentValue = 'accepted' | 'essential';

function getStored(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'accepted' || v === 'essential' ? v : null;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<ConsentValue | null>(null);

  useEffect(() => {
    const stored = getStored();
    setCurrent(stored);
    if (!stored) setVisible(true);

    function onOpen() {
      setVisible(true);
    }
    window.addEventListener('open-cookie-settings', onOpen);
    return () => window.removeEventListener('open-cookie-settings', onOpen);
  }, []);

  function save(value: ConsentValue) {
    localStorage.setItem(STORAGE_KEY, value);
    setCurrent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-[1.8rem] border-2 border-slate-200 bg-white p-5 shadow-[0_8px_0_rgba(226,232,240,1)] sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="status-pill mb-3 w-fit">Cookies</p>
      <h2 className="text-lg font-black tracking-tight text-slate-800">
        This site uses cookies
      </h2>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
        Essential cookies keep you signed in and save your scores. With your
        permission we also load{' '}
        <strong className="text-slate-700">Google AdSense</strong> for
        advertising. No personal data is sold.{' '}
        <a
          className="underline hover:text-slate-800"
          href="/privacy-policy"
        >
          Privacy Policy
        </a>
      </p>

      {current !== null && (
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
          Current:{' '}
          {current === 'accepted' ? 'All cookies accepted' : 'Essential only'}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate-700 hover:shadow-[0_6px_0_rgba(15,23,42,1)] active:translate-y-0.5 active:shadow-none"
          onClick={() => save('accepted')}
          type="button"
        >
          Accept All
        </button>
        <button
          className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-[0_4px_0_rgba(226,232,240,1)] transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-[0_6px_0_rgba(203,213,225,1)] active:translate-y-0.5 active:shadow-none"
          onClick={() => save('essential')}
          type="button"
        >
          Essential Only
        </button>
      </div>
    </div>
  );
}

export function CookieSettingsButton({ className }: { className?: string }) {
  function open() {
    window.dispatchEvent(new Event('open-cookie-settings'));
  }

  return (
    <button
      className={className}
      onClick={open}
      type="button"
    >
      Cookie Settings
    </button>
  );
}
