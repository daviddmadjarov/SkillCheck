'use client';

/**
 * Global audio manager for SkillCheck.
 *
 * Mobie browsers (iOS Safari, Chrome Android) block AudioContext creation
 * and resume() until a user gesture has occurred.  This module:
 *
 *  1. Defers AudioContext creation until the first user interaction
 *     (pointer down / touch start).
 *  2. Uses a SINGLE shared AudioContext for ALL sound effects (no
 *     per-component contexts, no per-sound contexts).
 *  3. Keeps the context alive by looping a silent buffer through it
 *     (prevents iOS from suspending the context after a few seconds
 *     of inactivity).
 *  4. Exposes a `getContext()` that always returns the shared context
 *     (or null before first gesture).  All sound functions call this.
 */

let sharedCtx: AudioContext | null = null;
let wakeNode: AudioBufferSourceNode | null = null;
let initialised = false;

/** A 2‑channel buffer of silence at the current sample rate. */
function createSilentBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * 0.5); // 500 ms
  return ctx.createBuffer(2, length, ctx.sampleRate);
}

/** Start looping a silent buffer so iOS doesn't suspend the context. */
function startWakeLoop(ctx: AudioContext) {
  stopWakeLoop();
  const src = ctx.createBufferSource();
  src.buffer = createSilentBuffer(ctx);
  src.loop = true;
  src.connect(ctx.destination);
  src.start();
  wakeNode = src;
}

function stopWakeLoop() {
  if (wakeNode) {
    try { wakeNode.stop(); } catch { /* already stopped */ }
    try { wakeNode.disconnect(); } catch { /* already disconnected */ }
    wakeNode = null;
  }
}

/**
 * Initialise the shared AudioContext.
 * Must be called from inside a user‑gesture handler (pointerdown,
 * touchstart, click).
 */
function initOnGesture() {
  if (initialised) return;
  initialised = true;

  try {
    const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    sharedCtx = ctx;

    // Start the wake loop immediately so the context stays alive
    startWakeLoop(ctx);
  } catch {
    // Audio not available – silently degrade
  }
}

/**
 * Return the shared AudioContext, creating it if necessary.
 * On mobile this will only succeed after the first user gesture.
 */
export function getSharedContext(): AudioContext | null {
  if (!sharedCtx) {
    // Try to initialise now (will work after first gesture)
    const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      const ctx = new AC();
      sharedCtx = ctx;
      startWakeLoop(ctx);
    } catch {
      return null;
    }
  }

  // Ensure the context is running
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }

  return sharedCtx;
}

/**
 * Must be called once per page load to wire up the first‑gesture
 * handler.  Install it in the root layout (inside a client component).
 */
export function useAudioInit() {
  if (typeof window !== 'undefined' && !initialised) {
    // Wait for the very first pointer / touch / click
    const handler = () => {
      initOnGesture();
      // Clean up – one shot
      document.removeEventListener('pointerdown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('click', handler);
    };
    document.addEventListener('pointerdown', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('click', handler);
  }
}

/** Tear down the shared context (e.g. when sounds are turned off). */
export function destroySharedContext() {
  stopWakeLoop();
  if (sharedCtx) {
    sharedCtx.close().catch(() => {});
    sharedCtx = null;
  }
}