'use client';

import { useCallback, useRef } from 'react';

type CtxRef = { current: AudioContext | null };

function getCtx(ref: CtxRef) {
  if (!ref.current) {
    const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ref.current = new AC();
  }
  if (ref.current.state === 'suspended') {
    ref.current.resume().catch(() => {});
  }
  return ref.current;
}

export function useAudioFeedback() {
  const ctxRef = useRef<AudioContext | null>(null);

  /** Soft melancholic hover — a gentle warm bell-like "ping" */
  const playHoverSound = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    const now = ctx.currentTime;

    // Main tone — soft, mellow sine
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);

    // Gentle overtone for warmth
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(990, now);
    osc2.frequency.exponentialRampToValueAtTime(660, now + 0.1);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.025, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.17);
  }, []);

  /** Softer, deeper click — a rounded warm "thump" with a subtle harmonic tail */
  const playClickSound = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    const now = ctx.currentTime;

    // Low thump — warm and round
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(120, now);
    thudOsc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
    thudGain.gain.setValueAtTime(0.001, now);
    thudGain.gain.linearRampToValueAtTime(0.3, now + 0.005);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.24);

    // Soft resonant "ping" tail — melancholic, musical
    const tailOsc = ctx.createOscillator();
    const tailGain = ctx.createGain();
    tailOsc.type = 'sine';
    tailOsc.frequency.setValueAtTime(520, now + 0.02);
    tailOsc.frequency.exponentialRampToValueAtTime(390, now + 0.25);
    tailGain.gain.setValueAtTime(0.001, now + 0.02);
    tailGain.gain.linearRampToValueAtTime(0.06, now + 0.03);
    tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    tailOsc.connect(tailGain);
    tailGain.connect(ctx.destination);
    tailOsc.start(now + 0.02);
    tailOsc.stop(now + 0.38);

    // A second higher overtone for that soft Fortnite-like resonance
    const tailOsc2 = ctx.createOscillator();
    const tailGain2 = ctx.createGain();
    tailOsc2.type = 'sine';
    tailOsc2.frequency.setValueAtTime(780, now + 0.04);
    tailOsc2.frequency.exponentialRampToValueAtTime(520, now + 0.2);
    tailGain2.gain.setValueAtTime(0.001, now + 0.04);
    tailGain2.gain.linearRampToValueAtTime(0.02, now + 0.05);
    tailGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    tailOsc2.connect(tailGain2);
    tailGain2.connect(ctx.destination);
    tailOsc2.start(now + 0.04);
    tailOsc2.stop(now + 0.32);
  }, []);

  return { playHoverSound, playClickSound };
}