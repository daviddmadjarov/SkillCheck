'use client';

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

/** Quick oscillator pulse helper */
function pulse(
  ctx: AudioContext,
  freq: number,
  duration: number,
  gainPeak: number,
  type: OscillatorType = 'sine',
  startTime = 0,
) {
  const now = ctx.currentTime + startTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(gainPeak, now + 0.003);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
  return { osc, gain: g };
}

/** Noise burst helper */
function noiseBurst(
  ctx: AudioContext,
  duration: number,
  gainPeak: number,
  startTime = 0,
) {
  const now = ctx.currentTime + startTime;
  const bufSize = Math.ceil(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(gainPeak, now + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  src.connect(g);
  g.connect(ctx.destination);
  src.start(now);
  src.stop(now + duration + 0.01);
}

// ─── Countdown sounds ────────────────────────────────────────────────

export function playCountdownTick(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  // Bright tick sound
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.08, now + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.07);

  // Noise spark
  noiseBurst(ctx, 0.015, 0.05);
}

export function playCountdownGo(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  // Rising triumphant tone
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.12, now + 0.005);
  g.gain.linearRampToValueAtTime(0.08, now + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.65);

  // Second layer for richness
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(660, now);
  osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
  g2.gain.setValueAtTime(0.001, now);
  g2.gain.linearRampToValueAtTime(0.07, now + 0.008);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc2.connect(g2);
  g2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.55);
}

// ─── Win / Lose jingles ─────────────────────────────────────────────

export function playWinJingle(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  // Ascending arpeggio: C5 → E5 → G5 → C6
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    pulse(ctx, freq, 0.18, 0.1, 'sine', i * 0.15);
    pulse(ctx, freq * 2, 0.12, 0.04, 'sine', i * 0.15 + 0.05);
  });
  // Final chord
  pulse(ctx, 1047, 0.5, 0.12, 'sine', 0.7);
  pulse(ctx, 1319, 0.45, 0.08, 'sine', 0.7);
  pulse(ctx, 1568, 0.4, 0.06, 'sine', 0.7);
}

export function playLoseJingle(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  // Descending minor: E4 → C4 → A3 → E3
  const notes = [330, 262, 220, 165];
  notes.forEach((freq, i) => {
    pulse(ctx, freq, 0.25, 0.08, 'triangle', i * 0.2);
  });
  // Final low thud
  pulse(ctx, 110, 0.4, 0.06, 'sine', 0.9);
  pulse(ctx, 55, 0.5, 0.04, 'sine', 0.95);
}

// ─── Start button sound (used by Stop Timer & all single-player gamemodes) ──

export function playStartSound(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  pulse(ctx, 420, 0.11, 0.11, 'triangle');
  pulse(ctx, 620, 0.08, 0.08, 'triangle', 0.09);
}

// ─── Return to Lab hover & click sounds ────────────────────────────

export function playReturnToLabHover(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  // Soft low hum
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.025, now + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.05);

  // Sub layer
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(180, now);
  osc2.frequency.exponentialRampToValueAtTime(80, now + 0.06);
  g2.gain.setValueAtTime(0.001, now);
  g2.gain.linearRampToValueAtTime(0.03, now + 0.002);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc2.connect(g2);
  g2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.06);
}

export function playReturnToLabClick(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  // Satisfying click + sub drop
  pulse(ctx, 800, 0.06, 0.07, 'square');
  pulse(ctx, 200, 0.12, 0.06, 'triangle', 0.02);
  pulse(ctx, 100, 0.2, 0.04, 'sine', 0.05);
}

// ─── Aim hit sounds (rising pitch) ──────────────────────────────────

export function playAimHit(ctxRef: CtxRef, hitIndex: number) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  // Pitch rises from ~600Hz to ~1800Hz across 25 hits
  const minFreq = 600;
  const maxFreq = 1800;
  const freq = minFreq + (maxFreq - minFreq) * (hitIndex / 24);

  // Main hit tone
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.09, now + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);

  // Spark layer at double frequency
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq * 2, now);
  g2.gain.setValueAtTime(0.001, now);
  g2.gain.linearRampToValueAtTime(0.04, now + 0.001);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc2.connect(g2);
  g2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.05);

  // Tiny noise click
  noiseBurst(ctx, 0.008, 0.06);
}

// ─── Slider drag sound (Estimation Challenge) ──────────────────────

export function playSliderMove(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  // Subtle soft tick — like a detent
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.015);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.015, now + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.025);
}