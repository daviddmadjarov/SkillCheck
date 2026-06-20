'use client';

import { useEffect, useRef, useState } from 'react';

type LoreTerminalProps = {
  /** Called when the terminal sequence is complete (after screen-tear) */
  onComplete: () => void;
};

const MEMO_LINES = [
  '[DECRYPTED MEMO - ARCHIVE_42]',
  'FROM: Dr. Lin',
  'TO: Internal Relay',
  'SUBJECT: Leaderboard Anomalies',
  '',
  'They aren\'t updating the Elo system for matchmaking, Aris.',
  'The algorithm is sorting them by synaptic durability.',
  'The users tracking in Tier 1 (Elo > 2200) aren\'t \'pro players\'.',
  'They are spiking the biometric telemetry.',
  'Stop the Daily Challenges before they patch the sensor gateway.',
  '',
  '[END TRANSMISSION]',
  '',
  '_',
];

const TOTAL_DURATION_MS = 8000;
const CHAR_INTERVAL_MS = 25;

export function LoreTerminal({ onComplete }: LoreTerminalProps) {
  const [displayedChars, setDisplayedChars] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fullText = MEMO_LINES.join('\n');
  const totalChars = fullText.length;

  // Typing effect
  useEffect(() => {
    const startTime = performance.now();
    let rafId: number;

    const type = () => {
      const elapsed = performance.now() - startTime;
      const targetChars = Math.min(totalChars, Math.floor(elapsed / CHAR_INTERVAL_MS));
      setDisplayedChars(targetChars);

      if (targetChars < totalChars) {
        rafId = requestAnimationFrame(type);
      }
    };

    rafId = requestAnimationFrame(type);

    return () => cancelAnimationFrame(rafId);
  }, [totalChars]);

  // Auto-dismiss after TOTAL_DURATION_MS
  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      setIsExiting(true);
      // Wait for screen-tear animation (600ms) then call onComplete
      window.setTimeout(onComplete, 600);
    }, TOTAL_DURATION_MS);

    return () => window.clearTimeout(exitTimer);
  }, [onComplete]);

  // Console output
  useEffect(() => {
    console.error('[CRITICAL]: Secure Socket Leak in Supabase Realtime Channel: \'specimen_tracking\'');
  }, []);

  const visibleText = fullText.slice(0, displayedChars);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[99999] flex items-center justify-center bg-black ${
        isExiting ? 'animate-screen-tear' : ''
      }`}
      aria-hidden="true"
    >
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none animate-scanlines" />

      {/* CRT vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Terminal window */}
      <div className="relative w-full max-w-[720px] px-6 py-8 font-mono text-sm leading-6 sm:text-base sm:leading-7">
        <pre className="whitespace-pre-wrap text-[#33ff33] opacity-90 select-none">
          {visibleText}
          <span className="animate-terminal-cursor inline-block w-[0.6em] h-[1em] bg-[#33ff33] align-middle ml-0.5" />
        </pre>
      </div>
    </div>
  );
}