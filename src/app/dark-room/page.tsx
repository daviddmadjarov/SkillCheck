'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const TOTAL_MS = 12800;

export default function DarkRoomPage() {
  const router = useRouter();
  const audioContextRef = useRef<AudioContext | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);
  const [lightOn, setLightOn] = useState(false);
  const [flash, setFlash] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

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
    <main className="fixed inset-0 z-[9999] overflow-hidden bg-[#010101]">
      <div
        className={`absolute inset-0 transition-opacity duration-[6400ms] ease-linear ${
          lightOn ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(ellipse at 50% 44%, rgba(255,255,235,0.26) 0%, rgba(255,255,220,0.1) 14%, rgba(18,18,18,0) 46%)',
          transform: lightOn ? 'scale(1.65)' : 'scale(0.35)',
          transitionProperty: 'opacity, transform',
          transitionDuration: '6400ms',
          transitionTimingFunction: 'cubic-bezier(0.19, 0.8, 0.25, 1)',
        }}
      />

      <div
        className={`absolute inset-0 bg-white transition-opacity duration-500 ${
          flash ? 'opacity-90' : 'opacity-0'
        }`}
      />

      <div
        className={`absolute inset-0 bg-black transition-opacity duration-1000 ${
          fadeOut ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </main>
  );
}