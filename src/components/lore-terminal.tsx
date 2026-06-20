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
      // Play a layered digital glitch before the tear
      if (isAccess) {
        const ctx = getAudio();
        if (ctx) {
          const now = ctx.currentTime;
          const glitchDuration = 0.7;

          // Layer 1 — rapid frequency-modulated screech
          const osc1 = ctx.createOscillator();
          const freqMod = ctx.createOscillator();
          const gain1 = ctx.createGain();
          freqMod.type = 'sine';
          freqMod.frequency.value = 480;
          const fmGain = ctx.createGain();
          fmGain.gain.value = 280;
          freqMod.connect(fmGain);
          fmGain.connect(osc1.frequency);
          osc1.type = 'sawtooth';
          osc1.frequency.setValueAtTime(900, now);
          osc1.frequency.linearRampToValueAtTime(1800, now + 0.09);
          osc1.frequency.linearRampToValueAtTime(400, now + 0.2);
          osc1.frequency.linearRampToValueAtTime(2800, now + 0.32);
          osc1.frequency.linearRampToValueAtTime(90, now + glitchDuration);
          gain1.gain.setValueAtTime(0.0001, now);
          gain1.gain.linearRampToValueAtTime(0.07, now + 0.02);
          gain1.gain.linearRampToValueAtTime(0.04, now + 0.12);
          gain1.gain.linearRampToValueAtTime(0.09, now + 0.25);
          gain1.gain.exponentialRampToValueAtTime(0.0001, now + glitchDuration);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + glitchDuration);
          freqMod.start(now);
          freqMod.stop(now + glitchDuration);

          // Layer 2 — stuttered noise bursts (bit-crushed artefact)
          const bufferSize = ctx.sampleRate * 0.4;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            // Square-wave amplitude modulation to create stutter
            const stutter = Math.sin(i / (ctx.sampleRate / 180) * Math.PI * 2) > 0 ? 1 : 0;
            data[i] = (Math.random() * 2 - 1) * stutter * (1 - i / bufferSize);
          }
          const noiseSource = ctx.createBufferSource();
          noiseSource.buffer = buffer;
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.0001, now);
          noiseGain.gain.linearRampToValueAtTime(0.10, now + 0.05);
          noiseGain.gain.linearRampToValueAtTime(0.06, now + 0.2);
          noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + glitchDuration);
          noiseSource.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          noiseSource.start(now);
          noiseSource.stop(now + glitchDuration);

          // Layer 3 — low digital pulse at the very end
          const osc3 = ctx.createOscillator();
          const gain3 = ctx.createGain();
          osc3.type = 'square';
          osc3.frequency.setValueAtTime(55, now + 0.55);
          osc3.frequency.setValueAtTime(40, now + 0.65);
          gain3.gain.setValueAtTime(0.0001, now + 0.55);
          gain3.gain.linearRampToValueAtTime(0.08, now + 0.6);
          gain3.gain.exponentialRampToValueAtTime(0.0001, now + glitchDuration);
          osc3.connect(gain3);
          gain3.connect(ctx.destination);
          osc3.start(now + 0.55);
          osc3.stop(now + glitchDuration + 0.02);
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