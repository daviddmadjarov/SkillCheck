'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type LoreTerminalProps = {
  /** Whether this is the entry ('access') or exit ('sever') cutscene */
  variant?: 'access' | 'sever';
  /** Called when the terminal sequence is complete (after screen-tear) */
  onComplete: () => void;
};

const ACCESS_MEMO = [
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

const SEVER_MEMO = [
  '[UPLINK SEVERED]',
  'Aethelgard S-042 relay terminated.',
  'Local telemetry buffer purged.',
  'Tracking beacon: OFFLINE.',
  '',
  'You are no longer visible to the Institute.',
  '',
  'Stay quiet. Stay off the leaderboard.',
  '',
  '_',
];

const ACCESS_DURATION_MS = 8000;
const SEVER_DURATION_MS = 3500;
const CHAR_INTERVAL_MS = 25;

/** Play a subtle sub-bass drone for the access cutscene */
function playAccessDrone(context: AudioContext) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'sine';
  osc.frequency.value = 55;
  gain.gain.setValueAtTime(0.04, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 7.5);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + 7.5);
}

/** Play a single key-click for each character typed during the cutscene */
function playKeyClick(context: AudioContext) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 980 + Math.random() * 120;
  const now = context.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.05);
}

/** Play a resonant "modem handshake" chord at the start of the access cutscene */
function playHandshake(context: AudioContext) {
  const now = context.currentTime;
  const freqs = [720, 1080, 1440];
  freqs.forEach((freq, i) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.025, now + i * 0.06 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.5);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now + i * 0.06);
    osc.stop(now + i * 0.06 + 0.5);
  });
}

/** Play a "connection closed" tone for the sever cutscene */
function playSeverTone(context: AudioContext) {
  const now = context.currentTime;
  // Descending tone drop
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 1.2);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(now);
  osc.stop(now + 1.5);
}

/** Static burst for the sever cutscene  */
function playStaticBurst(context: AudioContext) {
  const now = context.currentTime;
  const bufferSize = context.sampleRate * 0.25;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  source.connect(gain);
  gain.connect(context.destination);
  source.start(now);
}

export function LoreTerminal({ variant = 'access', onComplete }: LoreTerminalProps) {
  const [displayedChars, setDisplayedChars] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastCharCountRef = useRef(0);

  const isAccess = variant === 'access';
  const totalDuration = isAccess ? ACCESS_DURATION_MS : SEVER_DURATION_MS;
  const memoLines = isAccess ? ACCESS_MEMO : SEVER_MEMO;
  const fullText = memoLines.join('\n');
  const totalChars = fullText.length;

  // Initialise audio context on first interaction
  const getAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioContextRef.current = new Ctor();
    }
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Play entry sounds (handshake + drone)
  useEffect(() => {
    if (!isAccess) return;
    const ctx = getAudio();
    if (!ctx) return;
    playHandshake(ctx);
    playAccessDrone(ctx);
  }, [isAccess, getAudio]);

  // Typing effect with character-click sounds
  useEffect(() => {
    const startTime = performance.now();
    let rafId: number;

    const type = () => {
      const elapsed = performance.now() - startTime;
      const targetChars = Math.min(totalChars, Math.floor(elapsed / CHAR_INTERVAL_MS));
      setDisplayedChars(targetChars);

      // Trigger a key-click for each new character
      if (targetChars > lastCharCountRef.current) {
        const ctx = getAudio();
        if (ctx) {
          // Throttle: only every ~3rd character to avoid too dense clicks
          if (targetChars % 3 === 0 || targetChars >= totalChars - 1) {
            playKeyClick(ctx);
          }
        }
        lastCharCountRef.current = targetChars;
      }

      if (targetChars < totalChars) {
        rafId = requestAnimationFrame(type);
      }
    };

    rafId = requestAnimationFrame(type);

    return () => cancelAnimationFrame(rafId);
  }, [totalChars, getAudio]);

  // Play sever sounds
  useEffect(() => {
    if (isAccess) return;
    const ctx = getAudio();
    if (!ctx) return;
    const t = setTimeout(() => {
      playSeverTone(ctx);
      playStaticBurst(ctx);
    }, 600);
    return () => clearTimeout(t);
  }, [isAccess, getAudio]);

  // Auto-dismiss after totalDuration
  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      setIsExiting(true);
      // Play a final sound before the tear
      if (isAccess) {
        const ctx = getAudio();
        if (ctx) {
          // Short "connection lost" glitch sound
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(300, ctx.currentTime);
          osc.frequency.setValueAtTime(80, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.06, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.22);
        }
      }
      window.setTimeout(() => {
        if (audioContextRef.current) {
          void audioContextRef.current.close();
          audioContextRef.current = null;
        }
        onComplete();
      }, 600);
    }, totalDuration);

    return () => window.clearTimeout(exitTimer);
  }, [totalDuration, onComplete, isAccess, getAudio]);

  // Console output
  useEffect(() => {
    if (isAccess) {
      console.error('[CRITICAL]: Secure Socket Leak in Supabase Realtime Channel: \'specimen_tracking\'');
    } else {
      console.warn('[AETHELGARD S-042]: Uplink terminated. Beacon offline.');
    }
  }, [isAccess]);

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
        <pre
          className={`whitespace-pre-wrap select-none ${
            isAccess ? 'text-[#33ff33] opacity-90' : 'text-[#ff6633] opacity-85'
          }`}
        >
          {visibleText}
          <span
            className={`animate-terminal-cursor inline-block w-[0.6em] h-[1em] align-middle ml-0.5 ${
              isAccess ? 'bg-[#33ff33]' : 'bg-[#ff6633]'
            }`}
          />
        </pre>
      </div>
    </div>
  );
}