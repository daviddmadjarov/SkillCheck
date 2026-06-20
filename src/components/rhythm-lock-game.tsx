'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/app/theme-provider';

/* ── Types ──────────────────────────────── */

export type RhythmLockProps = {
  /** Game duration in seconds (default 30) */
  timeLimit?: number;
  /** Starting angular velocity in rad/s (default 2) */
  initialSpeed?: number;
  /** Called once when the game ends, with the final 0-1000 lab score */
  onGameComplete?: (finalScore: number) => void;
  /** Called every time the raw score changes */
  onScoreUpdate?: (currentScore: number) => void;
  /** If true, auto-start the game on mount (for duel/party mode) */
  autoStart?: boolean;
};

/* ── Constants ──────────────────────────── */

const BASE_SPEED = 2; // rad/s
const SPEED_MULTIPLIER_STEP = 0.25; // extra rad/s per streak
const MAX_SPEED = 12; // cap so it remains playable
const MIN_TARGET_DELTA = Math.PI / 4; // 45°
const TARGET_HALF_ANGLE = 0.22; // angular width of the hit zone (≈12.6°)
const RING_RADIUS_RATIO = 0.36; // ring radius relative to canvas min dimension
const RING_LINE_WIDTH = 6;
const BALL_RADIUS = 12;
const TARGET_RADIUS_OUTER = 33; // size of the outward half-circle (≈50% bigger)
const GLOW_BLUR = 24;
const HIT_FLASH_DURATION = 200; // ms — how long the hit flash lasts

/** Scoring: map raw hits to a 0-1000 lab score */
function computeLabScore(hits: number, maxStreak: number, avgSpeed: number): number {
  if (hits === 0) return 0;
  const streakFactor = 1 + Math.min(maxStreak, 50) * 0.03;
  const speedFactor = 0.8 + Math.min(avgSpeed / MAX_SPEED, 1) * 0.4;
  const raw = hits * 30 * streakFactor * speedFactor;
  return Math.min(1000, Math.round(raw));
}

/* ── Game phases ────────────────────────── */

type Phase = 'idle' | 'playing' | 'finished';

/* ── Component ──────────────────────────── */

export default function RhythmLockGame({
  timeLimit = 30,
  initialSpeed = BASE_SPEED,
  autoStart = false,
  onGameComplete,
  onScoreUpdate,
}: RhythmLockProps) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const comboAnimRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hitFlashRef = useRef(0); // timestamp when flash started, 0 = no flash

  /* Game state (kept in refs to avoid re-renders inside the loop) */
  const phaseRef = useRef<Phase>('idle');
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const maxStreakRef = useRef(0);
  const speedRef = useRef(initialSpeed);
  const speedSumRef = useRef(0);
  const speedSamplesRef = useRef(0);
  const directionRef = useRef(1); // 1 = CW, -1 = CCW
  const angleRef = useRef(0); // ball angle in radians
  const targetAngleRef = useRef(0);
  const timeLeftRef = useRef(timeLimit);
  const lastFrameRef = useRef(0);
  const startTimeRef = useRef(0);

  /* React state for UI overlay & stats */
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [displayStreak, setDisplayStreak] = useState(0);
  const [comboScale, setComboScale] = useState(1);

  /* Stable callbacks */
  const onGameCompleteRef = useRef(onGameComplete);
  const onScoreUpdateRef = useRef(onScoreUpdate);
  useEffect(() => { onGameCompleteRef.current = onGameComplete; }, [onGameComplete]);
  useEffect(() => { onScoreUpdateRef.current = onScoreUpdate; }, [onScoreUpdate]);

  /* ── Audio helpers ────────────────────────── */

  const getAudioCtx = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playComboSound = useCallback((streak: number) => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freq = Math.min(200 + streak * 30, 800);
    const duration = Math.min(0.08 + streak * 0.005, 0.2);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.12 + streak * 0.01, 0.25), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }, [getAudioCtx]);

  const playMissSound = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }, [getAudioCtx]);

  /* ── Theme-aware colors ──────────────────── */

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const ringColor = isDark ? '#ffffff' : '#1e293b';
  const ringGlowColor = isDark ? '#a78bfa' : '#cbd5e1';
  const ballColor = isDark ? '#ffffff' : '#1e293b';
  const scoreColor = isDark ? '#ffffff' : '#1e293b';
  const timeLabelColor = isDark ? '#94a3b8' : '#64748b';
  const timeValueColor = isDark ? '#ffffff' : '#0f172a';
  const overlayBg = isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.6)';
  // Flash glow color: white in dark mode, black in light mode
  const flashGlowColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.35)';
  const flashStrokeColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)';

  /* ── Helpers ─────────────────────────────── */

  const clampAngle = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  const randomTargetAngle = useCallback((previousAngle: number, ballAngle: number) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = Math.random() * 2 * Math.PI;
      const distFromPrev = Math.abs(clampAngle(candidate - previousAngle));
      const distFromBall = Math.abs(clampAngle(candidate - ballAngle));
      if (distFromPrev >= MIN_TARGET_DELTA && distFromBall >= MIN_TARGET_DELTA) {
        return candidate;
      }
    }
    return clampAngle(ballAngle + Math.PI);
  }, []);

  /* ── Combo pop animation ──────────────────── */

  const triggerComboPop = useCallback(() => {
    setComboScale(1.4);
    cancelAnimationFrame(comboAnimRef.current);
    const start = performance.now();
    const duration = 250;
    function pop(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const scale = 1 + (1.4 - 1) * Math.pow(1 - progress, 2);
      setComboScale(scale);
      if (progress < 1) {
        comboAnimRef.current = requestAnimationFrame(pop);
      } else {
        setComboScale(1);
      }
    }
    comboAnimRef.current = requestAnimationFrame(pop);
  }, []);

  /* ── Hit flash animation ─────────────────── */

  const triggerHitFlash = useCallback(() => {
    hitFlashRef.current = performance.now();
  }, []);

  /* ── Drawing ──────────────────────────────── */

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    const ringR = Math.min(w, h) * RING_RADIUS_RATIO;

    // Compute flash intensity (decaying)
    const flashElapsed = performance.now() - hitFlashRef.current;
    const flashProgress = Math.max(0, 1 - flashElapsed / HIT_FLASH_DURATION);
    const flash = flashProgress; // 1 → 0

    ctx.clearRect(0, 0, w, h);

    // ── Background ──
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);

    // ── Ring glow ──
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, 2 * Math.PI);
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(30,41,59,0.10)';
    ctx.lineWidth = RING_LINE_WIDTH + 10;
    ctx.shadowColor = ringGlowColor;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Ring ──
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, 2 * Math.PI);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = RING_LINE_WIDTH;
    ctx.shadowColor = ringGlowColor;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Target: filled red half-circle on the OUTSIDE of the ring ──
    const ta = targetAngleRef.current;
    const hx = Math.cos(ta) * ringR;
    const hy = Math.sin(ta) * ringR;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ta);
    ctx.beginPath();
    ctx.arc(0, 0, TARGET_RADIUS_OUTER, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = '#dc2626';
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = GLOW_BLUR;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, TARGET_RADIUS_OUTER, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // ── Ball ──
    const ba = angleRef.current;
    const bx = Math.cos(ba) * ringR;
    const by = Math.sin(ba) * ringR;

    ctx.beginPath();
    ctx.arc(bx, by, BALL_RADIUS, 0, 2 * Math.PI);
    ctx.fillStyle = ballColor;
    ctx.shadowColor = ringGlowColor;
    ctx.shadowBlur = GLOW_BLUR;
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Hit flash overlay (drawn on top of ring + ball) ──
    if (flash > 0) {
      // Outer ring flash
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, 2 * Math.PI);
      ctx.strokeStyle = flashStrokeColor;
      ctx.lineWidth = RING_LINE_WIDTH + 4 + flash * 8; // expands outward
      ctx.shadowColor = flashGlowColor;
      ctx.shadowBlur = GLOW_BLUR * 2 * flash;
      ctx.globalAlpha = flash * 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Ball flash
      ctx.beginPath();
      ctx.arc(bx, by, BALL_RADIUS + flash * 6, 0, 2 * Math.PI);
      ctx.fillStyle = flashStrokeColor;
      ctx.globalAlpha = flash * 0.4;
      ctx.shadowColor = flashGlowColor;
      ctx.shadowBlur = GLOW_BLUR * flash;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Target flash
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(ta);
      ctx.beginPath();
      ctx.arc(0, 0, TARGET_RADIUS_OUTER + flash * 8, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = flashStrokeColor;
      ctx.globalAlpha = flash * 0.35;
      ctx.shadowColor = flashGlowColor;
      ctx.shadowBlur = GLOW_BLUR * flash;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.restore();

    // ── Score (center of ring) ──
    ctx.fillStyle = scoreColor;
    ctx.font = `bold ${ringR * 0.8}px "Inter", "SF Pro", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = ringGlowColor;
    ctx.shadowBlur = 12;
    ctx.fillText(String(scoreRef.current), cx, cy);
    ctx.shadowBlur = 0;

    // ── TIME LEFT ──
    const tl = timeLeftRef.current;
    ctx.fillStyle = timeLabelColor;
    ctx.font = 'bold 13px "Inter", "SF Pro", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('TIME LEFT', 18, 18);

    ctx.fillStyle = timeValueColor;
    ctx.font = 'bold 36px "Inter", "SF Pro", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.ceil(tl)}s`, 18, 38);

  }, [bgColor, ringColor, ringGlowColor, ballColor, scoreColor, timeLabelColor, timeValueColor, isDark, flashGlowColor, flashStrokeColor]);

  /* ── Game loop ────────────────────────────── */

  const tick = useCallback((timestamp: number) => {
    if (phaseRef.current !== 'playing') return;

    const dt = lastFrameRef.current === 0
      ? 1 / 60
      : Math.min((timestamp - lastFrameRef.current) / 1000, 0.05);
    lastFrameRef.current = timestamp;

    // Update ball angle
    angleRef.current = clampAngle(
      angleRef.current + directionRef.current * speedRef.current * dt,
    );

    // Update timer
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const remaining = Math.max(0, timeLimit - elapsed);
    timeLeftRef.current = remaining;

    // Time up?
    if (remaining <= 0) {
      phaseRef.current = 'finished';
      const hits = scoreRef.current;
      const avgSpeed = speedSamplesRef.current > 0
        ? speedSumRef.current / speedSamplesRef.current
        : initialSpeed;
      const labScore = computeLabScore(hits, maxStreakRef.current, avgSpeed);
      setFinalScore(labScore);
      setPhase('finished');
      onGameCompleteRef.current?.(labScore);
      return;
    }

    // Sync React state
    if (scoreRef.current !== score) setScore(scoreRef.current);
    const displayTime = Math.ceil(remaining);
    if (displayTime !== Math.ceil(timeLeft)) setTimeLeft(remaining);

    // Draw
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx, canvas.width, canvas.height);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [timeLimit, draw, score, timeLeft, initialSpeed]);

  /* ── Check (Space / Tap) ──────────────────── */

  const check = useCallback(() => {
    if (phaseRef.current !== 'playing') return;

    const ballAngle = angleRef.current;
    const targetAngle = targetAngleRef.current;
    const angularDiff = Math.abs(clampAngle(ballAngle - targetAngle));

    if (angularDiff <= TARGET_HALF_ANGLE || angularDiff >= 2 * Math.PI - TARGET_HALF_ANGLE) {
      // HIT
      const newStreak = streakRef.current + 1;
      scoreRef.current += 1;
      streakRef.current = newStreak;
      if (newStreak > maxStreakRef.current) maxStreakRef.current = newStreak;
      setScore(scoreRef.current);
      setDisplayStreak(newStreak);
      onScoreUpdateRef.current?.(scoreRef.current);

      // Combo pop + sound + flash
      triggerComboPop();
      triggerHitFlash();
      playComboSound(newStreak);

      // Reverse direction
      directionRef.current *= -1;

      // Increase speed (capped)
      const newSpeed = Math.min(
        MAX_SPEED,
        initialSpeed + newStreak * SPEED_MULTIPLIER_STEP,
      );
      speedRef.current = newSpeed;

      // Track speed for final scoring
      speedSumRef.current += newSpeed;
      speedSamplesRef.current += 1;

      // Fairness: new target position, min 45° from previous & ball
      targetAngleRef.current = randomTargetAngle(targetAngleRef.current, ballAngle);
    } else {
      // MISS — reset streak
      streakRef.current = 0;
      speedRef.current = initialSpeed;
      setDisplayStreak(0);
      playMissSound();

      // Track speed for final scoring
      speedSumRef.current += initialSpeed;
      speedSamplesRef.current += 1;
    }
  }, [initialSpeed, randomTargetAngle, triggerComboPop, triggerHitFlash, playComboSound, playMissSound]);

  /* ── Keyboard / Touch listeners ───────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        check();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [check]);

  /* ── Auto-start for duel/party mode ─────────── */

  useEffect(() => {
    if (autoStart && phaseRef.current === 'idle') {
      startGame();
    }
  }, [autoStart]); // eslint-disable-line

  /* ── Start / Stop ─────────────────────────── */

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reset state
    scoreRef.current = 0;
    streakRef.current = 0;
    maxStreakRef.current = 0;
    speedRef.current = initialSpeed;
    speedSumRef.current = 0;
    speedSamplesRef.current = 0;
    directionRef.current = 1;
    angleRef.current = 0;
    targetAngleRef.current = Math.PI * 0.75;
    timeLeftRef.current = timeLimit;
    lastFrameRef.current = 0;
    startTimeRef.current = performance.now();
    hitFlashRef.current = 0;
    setScore(0);
    setTimeLeft(timeLimit);
    setFinalScore(null);
    setDisplayStreak(0);

    // Unlock audio context on user gesture
    if (audioCtxRef.current?.state === 'suspended') {
      void audioCtxRef.current.resume();
    }

    phaseRef.current = 'playing';
    setPhase('playing');

    rafRef.current = requestAnimationFrame(tick);
  }, [timeLimit, initialSpeed, tick]);

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /* ── Canvas sizing ────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const size = Math.min(rect.width, 600);
      canvas.width = size;
      canvas.height = size;
      if (phaseRef.current === 'idle') {
        const ctx = canvas.getContext('2d');
        if (ctx) draw(ctx, size, size);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw]);

  /* ── Initial draw ─────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = Math.min(canvas.width || 400, 600);
    draw(ctx, size, size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  /* ── Render ────────────────────────────────── */

  const borderCls = isDark ? 'border-slate-700' : 'border-slate-200';
  const comboTextCls = isDark ? 'text-rose-400' : 'text-rose-600';

  return (
    <div className="relative mx-auto w-full max-w-[600px]">
      <canvas
        ref={canvasRef}
        className={`block w-full select-none rounded-[2rem] border-2 ${borderCls}`}
        style={{ aspectRatio: '1 / 1' }}
        onTouchStart={(e) => { e.preventDefault(); check(); }}
        onClick={check}
      />

      {/* Combo counter (overlaid on canvas during play) */}
      {phase === 'playing' && displayStreak > 0 && (
        <div
          ref={comboRef}
          className="absolute left-1/2 top-4 z-30 -translate-x-1/2 transition-transform duration-75"
          style={{ transform: `scale(${comboScale})` }}
        >
          <div className={`rounded-full border-2 border-rose-300/60 bg-rose-500/20 px-5 py-1.5 text-center backdrop-blur-sm ${comboTextCls}`}>
            <span className="text-lg font-black tracking-tight">
              {displayStreak}x COMBO
            </span>
          </div>
        </div>
      )}

      {/* Overlay: idle */}
      {phase === 'idle' && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-[2rem] backdrop-blur-sm"
          style={{ backgroundColor: overlayBg }}
        >
          <div className={`rounded-[1.5rem] border-2 ${isDark ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-white'} px-6 py-5 text-center shadow-lg`}>
            <p className={`text-xs font-bold uppercase tracking-[0.2em] ${isDark ? 'text-violet-400' : 'text-cyan-600'}`}>
              Rhythm Sync — Overclock
            </p>
            <p className={`mt-2 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Press SPACE or tap when the ball overlaps the red target.
              <br />
              {timeLimit}s · speed increases on streaks!
            </p>
            <button
              data-start-game
              className="mt-4 rounded-full border-2 border-violet-500 bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_0_rgba(139,92,246,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-violet-500 hover:shadow-[0_8px_0_rgba(139,92,246,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(139,92,246,1)]"
              onClick={startGame}
              type="button"
            >
              Start Overclock
            </button>
          </div>
        </div>
      )}

      {/* Overlay: finished */}
      {phase === 'finished' && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-[2rem] backdrop-blur-sm"
          style={{ backgroundColor: overlayBg }}
        >
          <div className={`rounded-[1.5rem] border-2 ${isDark ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-white'} px-6 py-5 text-center shadow-lg`}>
            <p className={`text-xs font-bold uppercase tracking-[0.2em] ${isDark ? 'text-violet-400' : 'text-cyan-600'}`}>
              Run complete
            </p>
            <p className={`mt-3 text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {finalScore}
            </p>
            <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>lab score</p>
            <button
              className="mt-4 rounded-full border-2 border-violet-500 bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-[0_4px_0_rgba(139,92,246,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-violet-500 hover:shadow-[0_8px_0_rgba(139,92,246,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(139,92,246,1)]"
              onClick={startGame}
              type="button"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}