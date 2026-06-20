import Link from 'next/link';
import { CookieSettingsButton } from '@/components/cookie-consent';

const footerLinkClassName =
  'site-footer-link inline-flex items-center rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 transition hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-700 hover:text-slate-300';

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-cyan-900/50 bg-[#0a1628] px-4 pb-6 pt-8 sm:px-6">
      <div className="site-footer-shell mx-auto flex w-full max-w-[1240px] flex-col gap-4 rounded-[1.7rem] border-2 border-slate-700 bg-slate-900/80 px-4 py-4 shadow-[0_4px_0_rgba(30,41,59,1)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">
            Research Lab Footer
          </p>
          <p className="text-sm font-medium leading-6 text-slate-400">
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
          <CookieSettingsButton className={footerLinkClassName} />
        </div>
      </div>
    </footer>
  );
}