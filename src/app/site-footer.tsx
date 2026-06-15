"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CookieSettingsButton } from '@/components/cookie-consent';

const DARK_ROOM_COOLDOWN_MS = 5 * 60 * 1000;
const DARK_ROOM_COOLDOWN_KEY = 'skillcheck_dark_room_cooldown_until';

const footerLinkClassName =
  'site-footer-link inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white';

export function SiteFooter() {
  const [isDarkRoomLocked, setIsDarkRoomLocked] = useState(false);

  useEffect(() => {
    const rawValue = localStorage.getItem(DARK_ROOM_COOLDOWN_KEY);
    const cooldownUntil = rawValue ? Number(rawValue) : 0;
    const remaining = cooldownUntil - Date.now();

    if (remaining > 0) {
      setIsDarkRoomLocked(true);
      const timeoutId = window.setTimeout(() => {
        setIsDarkRoomLocked(false);
        localStorage.removeItem(DARK_ROOM_COOLDOWN_KEY);
      }, remaining);
      return () => window.clearTimeout(timeoutId);
    }

    setIsDarkRoomLocked(false);
    localStorage.removeItem(DARK_ROOM_COOLDOWN_KEY);
  }, []);

  const handleDarkRoomClick = () => {
    const cooldownUntil = Date.now() + DARK_ROOM_COOLDOWN_MS;
    localStorage.setItem(DARK_ROOM_COOLDOWN_KEY, String(cooldownUntil));
    setIsDarkRoomLocked(true);
  };

  return (
    <footer className="mt-16 border-t border-slate-200/80 px-4 pb-6 pt-8 sm:px-6">
      <div className="site-footer-shell mx-auto flex w-full max-w-[1240px] flex-col gap-4 rounded-[1.7rem] border-2 border-slate-200 bg-white/80 px-4 py-4 shadow-[0_4px_0_rgba(226,232,240,1)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
            Research Lab Footer
          </p>
          <p className="text-sm font-medium leading-6 text-slate-500">
            Operational notes, legal pages, and the things we do not want on the front desk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link className={footerLinkClassName} href="/imprint">
            Imprint
          </Link>
          <Link className={footerLinkClassName} href="/privacy-policy">
            Privacy Policy
          </Link>
          <Link className={footerLinkClassName} href="/tos">
            TOS
          </Link>
          <Link className={footerLinkClassName} href="/contact-us">
            Contact Us
          </Link>
          {isDarkRoomLocked ? (
            <span
              aria-disabled="true"
              className={`${footerLinkClassName} cursor-not-allowed opacity-50 text-rose-600`}
            >
              Don&apos;t Click
            </span>
          ) : (
            <Link
              className={`${footerLinkClassName} text-rose-600`}
              href="/beneath"
              onClick={handleDarkRoomClick}
            >
              Don&apos;t Click
            </Link>
          )}
          <CookieSettingsButton className={footerLinkClassName} />
        </div>
      </div>
    </footer>
  );
}