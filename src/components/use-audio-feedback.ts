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

  /** Clean, satisfying lab scanner "ping" — precise, metallic, with a warm reverb-like tail */
  const playHoverSound = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    const now = ctx.currentTime;

    // Core tone — clear and precise (A5 ~880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(440, now + 0.15);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.10, now + 0.004);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    // Fifth overtone (perfect fifth above — E6 ~1320Hz) for resonance
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now);
    osc2.frequency.exponentialRampToValueAtTime(660, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.04, now + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.2);

    // Sub overtone (octave below 440Hz) for satisfying weight
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(440, now + 0.01);
    osc3.frequency.exponentialRampToValueAtTime(220, now + 0.1);
    gain3.gain.setValueAtTime(0.001, now + 0.01);
    gain3.gain.linearRampToValueAtTime(0.03, now + 0.015);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.01);
    osc3.stop(now + 0.17);
  }, []);

  /** Satisfying lab equipment "activation" — a warm, deep thump with a clean, rising harmonic sweep */
  const playClickSound = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    const now = ctx.currentTime;

    // Deep impact — the satisfying weight
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(160, now);
    thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    thudGain.gain.setValueAtTime(0.001, now);
    thudGain.gain.linearRampToValueAtTime(0.45, now + 0.005);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.28);

    // Clean metallic attack transient (for tactile feedback)
    const attOsc = ctx.createOscillator();
    const attGain = ctx.createGain();
    attOsc.type = 'sine';
    attOsc.frequency.setValueAtTime(2400, now);
    attOsc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
    attGain.gain.setValueAtTime(0.001, now);
    attGain.gain.linearRampToValueAtTime(0.08, now + 0.002);
    attGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    attOsc.connect(attGain);
    attGain.connect(ctx.destination);
    attOsc.start(now);
    attOsc.stop(now + 0.07);

    // Rising power-up sweep (satisfying "whoosh" upward)
    const sweepOsc = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweepOsc.type = 'sine';
    sweepOsc.frequency.setValueAtTime(220, now + 0.03);
    sweepOsc.frequency.exponentialRampToValueAtTime(1100, now + 0.22);
    sweepGain.gain.setValueAtTime(0.001, now + 0.03);
    sweepGain.gain.linearRampToValueAtTime(0.06, now + 0.04);
    sweepGain.gain.linearRampToValueAtTime(0.04, now + 0.12);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    sweepOsc.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweepOsc.start(now + 0.03);
    sweepOsc.stop(now + 0.3);

    // Resonant harmonic for that lab-equipment hum satisfaction
    const harmOsc = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harmOsc.type = 'sine';
    harmOsc.frequency.setValueAtTime(660, now + 0.04);
    harmOsc.frequency.exponentialRampToValueAtTime(440, now + 0.28);
    harmGain.gain.setValueAtTime(0.001, now + 0.04);
    harmGain.gain.linearRampToValueAtTime(0.035, now + 0.05);
    harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    harmOsc.connect(harmGain);
    harmGain.connect(ctx.destination);
    harmOsc.start(now + 0.04);
    harmOsc.stop(now + 0.35);
  }, []);

  return { playHoverSound, playClickSound };
}