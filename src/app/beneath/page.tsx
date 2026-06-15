'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const TOTAL_MS = 13000;

export default function BeneathPage() {
  const router = useRouter();
  const audioContextRef = useRef<AudioContext | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);
  const [lightOn, setLightOn] = useState(false);
  const [flash, setFlash] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const timers: number[] = [];

    const cleanupAudio = () => {
      teardownRef.current?.();
      teardownRef.current = null;
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };

    const createNoiseBuffer = (context: AudioContext, seconds: number) => {
      const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    };

    const startAudio = async () => {
      try {
        const context = new window.AudioContext();
        audioContextRef.current = context;
        if (context.state === 'suspended') {
          await context.resume();
        }

        const master = context.createGain();
        master.gain.value = 0.13;
        master.connect(context.destination);

        const lowNoise = context.createBufferSource();
        lowNoise.buffer = createNoiseBuffer(context, 2);
        lowNoise.loop = true;
        const lowPass = context.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 180;
        const lowGain = context.createGain();
        lowGain.gain.value = 0.22;
        lowNoise.connect(lowPass);
        lowPass.connect(lowGain);
        lowGain.connect(master);
        lowNoise.start();

        const airNoise = context.createBufferSource();
        airNoise.buffer = createNoiseBuffer(context, 2);
        airNoise.loop = true;
        const highPass = context.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 900;
        const airGain = context.createGain();
        airGain.gain.value = 0.04;
        airNoise.connect(highPass);
        highPass.connect(airGain);
        airGain.connect(master);
        airNoise.start();

        const creak = () => {
          const now = context.currentTime;
          const osc = context.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(130 + Math.random() * 90, now);

          const band = context.createBiquadFilter();
          band.type = 'bandpass';
          band.frequency.value = 340;
          band.Q.value = 1.8;

          const gain = context.createGain();
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.03, now + 0.12);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

          osc.connect(band);
          band.connect(gain);
          gain.connect(master);
          osc.start(now);
          osc.stop(now + 0.72);
        };

        const creakTimer = window.setInterval(creak, 2400);

        const whisper = () => {
          const now = context.currentTime;
          const source = context.createBufferSource();
          source.buffer = createNoiseBuffer(context, 2);

          const band = context.createBiquadFilter();
          band.type = 'bandpass';
          band.frequency.value = 1400;
          band.Q.value = 2.4;

          const gain = context.createGain();
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.05, now + 0.25);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);

          source.playbackRate.setValueAtTime(0.72, now);

          source.connect(band);
          band.connect(gain);
          gain.connect(master);
          source.start(now);
          source.stop(now + 1.5);
        };

        timers.push(window.setTimeout(whisper, 9300));

        teardownRef.current = () => {
          window.clearInterval(creakTimer);
          try {
            lowNoise.stop();
            airNoise.stop();
          } catch {
            // Ignore stop races during route transitions.
          }
          lowNoise.disconnect();
          airNoise.disconnect();
          lowPass.disconnect();
          highPass.disconnect();
          lowGain.disconnect();
          airGain.disconnect();
          master.disconnect();
        };
      } catch {
        // Silent fallback if autoplay/audio context is blocked.
      }
    };

    void startAudio();

    timers.push(window.setTimeout(() => setLightOn(true), 2800));
    timers.push(window.setTimeout(() => setFlash(true), 10800));
    timers.push(window.setTimeout(() => setFadeOut(true), 11600));
    timers.push(window.setTimeout(() => setShowText(true), 12200));
    timers.push(
      window.setTimeout(() => {
        cleanupAudio();
        router.replace('/');
      }, TOTAL_MS),
    );

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      cleanupAudio();
    };
  }, [router]);

  return (
    <main className="fixed inset-0 z-[9999] overflow-hidden bg-[#080608]">
      <style>{`
        @keyframes beneath-dust-a {
          0% { transform: translate3d(0, 0, 0); opacity: 0.18; }
          50% { transform: translate3d(8px, -22px, 0); opacity: 0.42; }
          100% { transform: translate3d(-6px, -48px, 0); opacity: 0; }
        }
        @keyframes beneath-dust-b {
          0% { transform: translate3d(0, 0, 0); opacity: 0.12; }
          50% { transform: translate3d(-10px, -28px, 0); opacity: 0.34; }
          100% { transform: translate3d(7px, -60px, 0); opacity: 0; }
        }
      `}</style>

      {/* Stone wall texture */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#080608',
          backgroundImage: [
            'repeating-linear-gradient(90deg, rgba(0,0,0,0.62) 0px, rgba(0,0,0,0.62) 3px, transparent 3px, transparent 118px)',
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0px, rgba(0,0,0,0.55) 3px, transparent 3px, transparent 72px)',
            'repeating-conic-gradient(from 12deg at 30% 40%, rgba(46,38,52,0.45) 0deg 90deg, rgba(20,16,26,0.45) 90deg 180deg)',
            'radial-gradient(circle at 18% 22%, rgba(58,48,66,0.5) 0%, transparent 38%)',
          ].join(', '),
          backgroundSize: '118px 72px, 118px 72px, 26px 26px, 100% 100%',
        }}
      />

      {/* Crack lines */}
      <div
        className="absolute"
        style={{
          top: '12%',
          left: '22%',
          width: '34%',
          height: '0',
          borderTop: '1px solid rgba(0,0,0,0.7)',
          transform: 'rotate(28deg)',
          boxShadow: '0 1px 0 rgba(70,60,78,0.25)',
        }}
      />
      <div
        className="absolute"
        style={{
          top: '58%',
          left: '60%',
          width: '26%',
          height: '0',
          borderTop: '1px solid rgba(0,0,0,0.65)',
          transform: 'rotate(-34deg)',
          boxShadow: '0 1px 0 rgba(70,60,78,0.2)',
        }}
      />

      {/* Ceiling band */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: '16%',
          background: 'linear-gradient(to bottom, rgba(34,28,40,0.55), rgba(8,6,8,0))',
          boxShadow: 'inset 0 -40px 60px rgba(0,0,0,0.6)',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 42%, transparent 30%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Distant light at the end of the corridor */}
      <div
        className="absolute"
        style={{
          top: '35%',
          left: '50%',
          width: '90vmax',
          height: '90vmax',
          marginLeft: '-45vmax',
          marginTop: '-45vmax',
          background:
            'radial-gradient(circle, rgba(255,247,220,0.95) 0%, rgba(255,238,190,0.5) 16%, rgba(255,226,160,0.16) 38%, rgba(8,6,8,0) 60%)',
          transform: lightOn ? 'scale(0.8)' : 'scale(0.02)',
          opacity: lightOn ? 1 : 0.12,
          transition: 'transform 8000ms cubic-bezier(0.16, 0.7, 0.3, 1), opacity 8000ms ease-in',
          willChange: 'transform, opacity',
        }}
      />

      {/* Dust particles */}
      <div
        className="absolute h-[3px] w-[3px] rounded-full bg-amber-100/40"
        style={{ top: '46%', left: '44%', animation: 'beneath-dust-a 9s ease-in-out infinite' }}
      />
      <div
        className="absolute h-[2px] w-[2px] rounded-full bg-amber-100/30"
        style={{ top: '52%', left: '54%', animation: 'beneath-dust-b 11s ease-in-out infinite 1.5s' }}
      />
      <div
        className="absolute h-[2px] w-[2px] rounded-full bg-amber-100/30"
        style={{ top: '40%', left: '49%', animation: 'beneath-dust-a 13s ease-in-out infinite 3s' }}
      />
      <div
        className="absolute h-[3px] w-[3px] rounded-full bg-amber-100/25"
        style={{ top: '58%', left: '47%', animation: 'beneath-dust-b 10s ease-in-out infinite 4.5s' }}
      />

      {/* Flash */}
      <div
        className={`absolute inset-0 bg-white transition-opacity duration-500 ${flash ? 'opacity-90' : 'opacity-0'}`}
      />

      {/* Fade to black */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-1000 ${fadeOut ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Closing text */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-[800ms] ${
          showText ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <p className="text-center text-[1.5rem] font-bold tracking-[0.35em] text-white">
          You should return...
        </p>
      </div>
    </main>
  );
}
