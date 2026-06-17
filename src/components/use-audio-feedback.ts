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

  /** Rapid crisp electronic "click" – a short bright blip */
  const playHoverSound = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    const now = ctx.currentTime;

    // Short bright blip
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }, []);

  /** Punchy pressurized "thud" + rising digital accent */
  const playClickSound = useCallback(() => {
    const ctx = getCtx(ctxRef);
    if (!ctx) return;

    const now = ctx.currentTime;

    // — Low thud —
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(150, now);
    thudOsc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    thudGain.gain.setValueAtTime(0.001, now);
    thudGain.gain.linearRampToValueAtTime(0.5, now + 0.004);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    thudOsc.connect(thudGain);
    thudGain.connect(ctx.destination);
    thudOsc.start(now);
    thudOsc.stop(now + 0.15);

    // — Noise burst for pressurised texture —
    const bufSize = ctx.sampleRate * 0.08;
    const noiseBuf = ctx.createBuffer(1, Math.ceil(bufSize), ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.15, now + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.08);

    // — Rising digital accent (pitch sweep) —
    const accOsc = ctx.createOscillator();
    const accGain = ctx.createGain();
    accOsc.type = 'sawtooth';
    accOsc.frequency.setValueAtTime(400, now + 0.03);
    accOsc.frequency.exponentialRampToValueAtTime(2800, now + 0.18);
    accGain.gain.setValueAtTime(0.001, now + 0.03);
    accGain.gain.linearRampToValueAtTime(0.08, now + 0.04);
    accGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    accOsc.connect(accGain);
    accGain.connect(ctx.destination);
    accOsc.start(now + 0.03);
    accOsc.stop(now + 0.22);
  }, []);

  return { playHoverSound, playClickSound };
}