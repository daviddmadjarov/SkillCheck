'use client';

import { useEffect, useRef } from 'react';

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

function playHoverSound(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;

  // Glassy ping
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(4200, now);
  osc.frequency.exponentialRampToValueAtTime(1400, now + 0.012);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.045, now + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.03);

  // Static spark
  const bufSize = Math.ceil(ctx.sampleRate * 0.008);
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.001, now);
  noiseGain.gain.linearRampToValueAtTime(0.04, now + 0.0005);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.018);
}

function playClickSound(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;

  // "cl" layer
  const clOsc = ctx.createOscillator();
  const clGain = ctx.createGain();
  clOsc.type = 'sine';
  clOsc.frequency.setValueAtTime(3200, now);
  clOsc.frequency.exponentialRampToValueAtTime(900, now + 0.008);
  clGain.gain.setValueAtTime(0.001, now);
  clGain.gain.linearRampToValueAtTime(0.12, now + 0.0008);
  clGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
  clOsc.connect(clGain);
  clGain.connect(ctx.destination);
  clOsc.start(now);
  clOsc.stop(now + 0.022);

  // "tick" layer
  const tickOsc = ctx.createOscillator();
  const tickGain = ctx.createGain();
  tickOsc.type = 'sine';
  tickOsc.frequency.setValueAtTime(2400, now + 0.006);
  tickOsc.frequency.exponentialRampToValueAtTime(600, now + 0.012);
  tickGain.gain.setValueAtTime(0.001, now + 0.006);
  tickGain.gain.linearRampToValueAtTime(0.08, now + 0.007);
  tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
  tickOsc.connect(tickGain);
  tickGain.connect(ctx.destination);
  tickOsc.start(now + 0.006);
  tickOsc.stop(now + 0.026);

  // Noise burst
  const bufSize = Math.ceil(ctx.sampleRate * 0.015);
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.001, now);
  noiseGain.gain.linearRampToValueAtTime(0.09, now + 0.0006);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.018);
}

/**
 * A single client component that adds hover + click sounds to every
 * interactive element on the page via event delegation.
 * Drop it once anywhere inside the page layout.
 */
export function InteractiveSounds() {
  const ctxRef = useRef<AudioContext | null>(null);
  const currentHoveredRef = useRef<Element | null>(null);

  useEffect(() => {
    const ctx = ctxRef;
    const currentHovered = currentHoveredRef;

    const selector = 'a, button, [role="button"], summary';

    function handleMouseOver(e: MouseEvent) {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const interactive = target.closest(selector);
      if (!interactive || interactive === currentHovered.current) return;
      currentHovered.current = interactive;
      playHoverSound(ctx);
    }

    function handleMouseOut(e: MouseEvent) {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      // Clear hovered if we're leaving the interactive element entirely
      if (currentHovered.current && !currentHovered.current.contains(e.relatedTarget as Node | null)) {
        currentHovered.current = null;
      }
    }

    function handleClick(e: MouseEvent) {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const interactive = target.closest(selector);
      if (!interactive) return;
      playClickSound(ctx);
    }

    document.addEventListener('mouseover', handleMouseOver, { passive: true });
    document.addEventListener('mouseout', handleMouseOut, { passive: true });
    document.addEventListener('click', handleClick, { passive: true });

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return null;
}