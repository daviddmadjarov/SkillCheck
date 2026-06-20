'use client';

type CtxRef = { current: AudioContext | null };

function getCtx(ref: CtxRef) {
  // Global mute: if the user has disabled sounds, never return a context
  if (typeof window !== 'undefined' && window.localStorage.getItem('skillcheck-sound-enabled') === 'false') {
    return null;
  }

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
  noiseBurst(ctx, 0.015, 0.05);
}

export function playCountdownGo(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
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
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    pulse(ctx, freq, 0.18, 0.1, 'sine', i * 0.15);
    pulse(ctx, freq * 2, 0.12, 0.04, 'sine', i * 0.15 + 0.05);
  });
  pulse(ctx, 1047, 0.5, 0.12, 'sine', 0.7);
  pulse(ctx, 1319, 0.45, 0.08, 'sine', 0.7);
  pulse(ctx, 1568, 0.4, 0.06, 'sine', 0.7);
}

export function playLoseJingle(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const notes = [330, 262, 220, 165];
  notes.forEach((freq, i) => {
    pulse(ctx, freq, 0.25, 0.08, 'triangle', i * 0.2);
  });
  pulse(ctx, 110, 0.4, 0.06, 'sine', 0.9);
  pulse(ctx, 55, 0.5, 0.04, 'sine', 0.95);
}

// ─── Start button sound ────────────────────────────────────────────

export function playStartSound(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  pulse(ctx, 420, 0.11, 0.11, 'triangle');
  pulse(ctx, 620, 0.08, 0.08, 'triangle', 0.09);
}

// ─── Return to Lab sounds ─────────────────────────────────────────

export function playReturnToLabHover(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
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
  pulse(ctx, 800, 0.06, 0.07, 'square');
  pulse(ctx, 200, 0.12, 0.06, 'triangle', 0.02);
  pulse(ctx, 100, 0.2, 0.04, 'sine', 0.05);
}

// ─── Aim hit sounds (rising pitch) ──────────────────────────────────

export function playAimHit(ctxRef: CtxRef, hitIndex: number) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  const minFreq = 600;
  const maxFreq = 1800;
  const freq = minFreq + (maxFreq - minFreq) * (hitIndex / 24);
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
  noiseBurst(ctx, 0.008, 0.06);
}

// ─── Slider drag sound (Estimation Challenge) ──────────────────────

export function playSliderMove(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
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

// ═══════════════════════════════════════════════════════════════════
// NEW SOUND EFFECTS
// ═══════════════════════════════════════════════════════════════════

// ─── Reaction game sounds ─────────────────────────────────────────

export function playReactionReadyChime(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  pulse(ctx, 880, 0.1, 0.06, 'triangle');
  pulse(ctx, 1100, 0.12, 0.05, 'sine', 0.08);
}

export function playReactionSuccess(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  pulse(ctx, 1400, 0.08, 0.09, 'sine');
  pulse(ctx, 1800, 0.06, 0.06, 'sine', 0.04);
  pulse(ctx, 2200, 0.1, 0.04, 'sine', 0.08);
}

export function playReactionTooSoon(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.08, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

// ─── Typing sounds ────────────────────────────────────────────────

export function playTypingKeypress(ctxRef: CtxRef, isError: boolean) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  if (isError) {
    // Low soft thud for errors
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.03);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.04, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } else {
    // Mechanical click
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.015);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.04, now + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.022);
    noiseBurst(ctx, 0.006, 0.03);
  }
}

export function playTypingComplete(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  // Rising arpeggio
  pulse(ctx, 600, 0.12, 0.08, 'sine');
  pulse(ctx, 800, 0.1, 0.06, 'sine', 0.1);
  pulse(ctx, 1000, 0.08, 0.05, 'sine', 0.2);
  pulse(ctx, 1200, 0.15, 0.07, 'sine', 0.3);
}

// ─── Mouse/Symbol Tracing - pencil scratch sound ─────────────────

export function playPencilScratch(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  // Short noise burst with a tonal body for that pencil-on-paper feel
  const bufSize = Math.ceil(ctx.sampleRate * 0.04);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // High-frequency noise with a rapid decay for scratch texture
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.5) * 0.5;
    // Add some tonal harmonics
    const t = i / ctx.sampleRate;
    data[i] += Math.sin(2 * Math.PI * 2000 * t) * Math.pow(1 - i / data.length, 2) * 0.3;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.025, now + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  src.connect(g);
  g.connect(ctx.destination);
  src.start(now);
  src.stop(now + 0.045);
}

// ─── CPS Tester - crisp mechanical click ─────────────────────────

export function playCPSClick(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(3000, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.012);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.06, now + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.018);
  noiseBurst(ctx, 0.005, 0.04);
}

// ─── Perfect Split - snap sound ─────────────────────────────────

export function playSplitSnap(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  pulse(ctx, 2500, 0.04, 0.08, 'square');
  pulse(ctx, 1800, 0.06, 0.06, 'sine', 0.02);
  noiseBurst(ctx, 0.008, 0.05);
}

// ─── Mental Rotation - correct/wrong sounds ─────────────────────

export function playCorrectChime(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  pulse(ctx, 880, 0.1, 0.07, 'sine');
  pulse(ctx, 1100, 0.08, 0.05, 'sine', 0.07);
  pulse(ctx, 1320, 0.12, 0.06, 'sine', 0.14);
}

export function playWrongBuzz(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.linearRampToValueAtTime(100, now + 0.2);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.05, now + 0.003);
  g.gain.linearRampToValueAtTime(0.03, now + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.28);
}

// ─── Duel match found notification ─────────────────────────────

export function playMatchFound(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  // Quick ascending sequence
  pulse(ctx, 660, 0.08, 0.08, 'sine');
  pulse(ctx, 880, 0.08, 0.07, 'sine', 0.08);
  pulse(ctx, 1100, 0.08, 0.06, 'sine', 0.16);
  pulse(ctx, 1320, 0.15, 0.1, 'sine', 0.24);
}

// ─── Daily challenge sounds ────────────────────────────────────

export function playDailyChime(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  pulse(ctx, 800, 0.08, 0.07, 'triangle');
  pulse(ctx, 1000, 0.1, 0.06, 'sine', 0.1);
  pulse(ctx, 1200, 0.15, 0.08, 'sine', 0.2);
  pulse(ctx, 800, 0.25, 0.05, 'triangle', 0.35);
}

export function playDailyComplete(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  pulse(ctx, 523, 0.15, 0.08, 'sine');
  pulse(ctx, 659, 0.12, 0.07, 'sine', 0.15);
  pulse(ctx, 784, 0.1, 0.06, 'sine', 0.3);
  pulse(ctx, 1047, 0.3, 0.1, 'sine', 0.45);
  pulse(ctx, 1319, 0.25, 0.07, 'sine', 0.5);
}

// ─── Party lobby sounds ─────────────────────────────────────────

export function playPlayerJoined(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  pulse(ctx, 660, 0.08, 0.06, 'sine');
  pulse(ctx, 880, 0.1, 0.05, 'sine', 0.08);
}

export function playPlayerLeft(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  pulse(ctx, 440, 0.1, 0.05, 'triangle');
  pulse(ctx, 330, 0.12, 0.04, 'triangle', 0.1);
}

// ─── UI toggle / tab switch sounds ─────────────────────────────

export function playTabSwitch(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1600, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.02);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.02, now + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.03);
}

// ─── Duel queue searching sound (radar ping, repeats every ~2 s) ──
// A low, atmospheric pulse that feels like the matchmaking system
// is sweeping for an opponent — similar in spirit to Fortnite's lobby
// search but distinct enough to avoid legal issues.
export function playQueueSearching(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;

  // Sub-bass thump (the "radar pulse" body)
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.25);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.07, now + 0.008);
  g.gain.linearRampToValueAtTime(0.04, now + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.4);

  // Higher "ping" overtone that gives it a searching, radar-like feel
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(600, now + 0.03);
  osc2.frequency.exponentialRampToValueAtTime(300, now + 0.15);
  g2.gain.setValueAtTime(0.001, now + 0.03);
  g2.gain.linearRampToValueAtTime(0.03, now + 0.033);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc2.connect(g2);
  g2.connect(ctx.destination);
  osc2.start(now + 0.03);
  osc2.stop(now + 0.3);

  // Subtle noise sweep to simulate interference / scanning
  const bufSize = Math.ceil(ctx.sampleRate * 0.08);
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.001, now + 0.02);
  noiseGain.gain.linearRampToValueAtTime(0.015, now + 0.025);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now + 0.02);
  noise.stop(now + 0.2);
}

export function playDropdownClick(ctxRef: CtxRef) {
  const ctx = getCtx(ctxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.015);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.015, now + 0.001);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.025);
}