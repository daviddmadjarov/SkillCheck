import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteFooter } from './site-footer';
import { ThemeProvider } from './theme-provider';
import { SoundToggleProvider } from '@/lib/sound-toggle-context';
import { CookieConsent } from '@/components/cookie-consent';
import { InteractiveSounds } from '@/components/interactive-sounds';

export const metadata: Metadata = {
  title: 'SkillCheck | Human Performance Laboratory',
  description: 'Test your physical and cognitive capabilities inside a playful science interface.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-dots min-h-screen">
        <ThemeProvider>
          <SoundToggleProvider>
            <InteractiveSounds />
            <div className="flex min-h-screen flex-col">
              <div className="flex-1">{children}</div>
              <SiteFooter />
            </div>
            <CookieConsent />
          </SoundToggleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
