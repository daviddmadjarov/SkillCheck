'use client';

import type { Point } from './aim-protocols';

// ─── Shape generation utilities ──────────────────────────────────────────────

function rg(cx: number, cy: number, r: number, n: number, phase = -Math.PI / 2): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

function radial(cx: number, cy: number, baseR: number, n: number, wobble: (a: number) => number): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = baseR + wobble(a) * baseR * 0.3;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

function pts(...list: number[]): Point[] {
  const p: Point[] = [];
  for (let i = 0; i < list.length; i += 2) p.push({ x: list[i], y: list[i + 1] });
  return p;
}

function vertPath(p: Point[]): string {
  return 'M' + p.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L') + ' Z';
}

function starShape(cx: number, cy: number, rOuter: number, rInner: number, points: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    result.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return result;
}

function heartShape(): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const x = 50 + 16 * Math.sin(a) ** 3;
    const y = 50 - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    result.push({ x, y });
  }
  return result;
}

function organicPts(seed: number, r: number): Point[] {
  const result: Point[] = [];
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const variation = 0.7 + 0.3 * Math.sin(i * 1.7 + seed) * Math.cos(i * 2.3 + seed * 0.5);
    const rr = r * variation;
    result.push({ x: 50 + rr * Math.cos(a), y: 50 + rr * Math.sin(a) });
  }
  return result;
}

function parametric(n: number, fn: (t: number) => { x: number; y: number }): Point[] {
  return Array.from({ length: n }, (_, i) => fn(i / n));
}

// ─── Color wheel ─────────────────────────────────────────────────────────────

const C = [
  { fill: '#fde68a', stroke: '#ca8a04' },
  { fill: '#bfdbfe', stroke: '#3b82f6' },
  { fill: '#fecaca', stroke: '#ef4444' },
  { fill: '#bbf7d0', stroke: '#22c55e' },
  { fill: '#e9d5ff', stroke: '#a855f7' },
  { fill: '#fed7aa', stroke: '#ea580c' },
  { fill: '#cbd5e1', stroke: '#64748b' },
  { fill: '#fbcfe8', stroke: '#ec4899' },
  { fill: '#cffafe', stroke: '#06b6d4' },
  { fill: '#dcfce7', stroke: '#16a34a' },
  { fill: '#fff7ed', stroke: '#d97706' },
  { fill: '#f5f5f4', stroke: '#78716c' },
  { fill: '#fef2f2', stroke: '#dc2626' },
  { fill: '#f0fdfa', stroke: '#14b8a6' },
  { fill: '#faf5ff', stroke: '#9333ea' },
];

let colorIdx = 0;
function nextColor() {
  const c = C[colorIdx % C.length];
  colorIdx = (colorIdx + 1) % C.length;
  return c;
}

// ─── Shape interface ─────────────────────────────────────────────────────────

export type SplitShapeDef = {
  pts: Point[];
  label: string;
  fill: string;
  stroke: string;
  path: string;
};

function make(label: string, pts: Point[]): SplitShapeDef {
  const c = nextColor();
  return { pts, label, path: vertPath(pts), ...c };
}

// ─── Shape generators ────────────────────────────────────────────────────────

const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

export function randomShape(): SplitShapeDef {
  return ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)]();
}

// Each shape function returns a SplitShapeDef
// Shapes are ordered roughly by the user's list

const ALL_SHAPES: (() => SplitShapeDef)[] = [
  // Circle
  () => make('Circle', rg(50, 50, 34, 40)),

  // Banana
  () => make('Banana', parametric(30, t => {
    const a = t * Math.PI * 2;
    const r = 8 + 18 * (0.5 + 0.5 * Math.cos(a));
    const ang = a + 0.3 * Math.sin(a);
    return { x: 50 + r * Math.cos(ang), y: 50 + r * Math.sin(ang) * 0.6 };
  })),

  // Lightning
  () => make('Lightning', pts(60,16, 42,42, 56,42, 38,84, 56,56, 44,56)),

  // Cloud
  () => make('Cloud', radial(50, 50, 24, 32, a => 0.3 + 0.5 * (0.5 + 0.5 * Math.cos(a * 3 + 0.5)))),

  // Chili Pepper
  () => make('Chili', parametric(24, t => {
    const a = t * Math.PI * 2;
    const r = 12 + 14 * (0.5 + 0.5 * Math.cos(a));
    const squash = 1 + 0.4 * Math.cos(a);
    return { x: 50 + r * Math.cos(a) * 0.5, y: 50 + r * Math.sin(a) * squash * 0.5 };
  })),

  // Seahorse
  () => make('Seahorse', pts(40,22, 55,18, 62,28, 58,40, 48,44, 42,54, 38,68, 32,78, 36,82, 44,76, 46,66, 50,56, 56,48, 62,44, 66,38, 62,26, 55,16, 48,20, 42,26)),

  // Coffee Bean
  () => make('Coffee Bean', parametric(24, t => {
    const a = t * Math.PI * 2;
    const r = 14 + 8 * Math.cos(a * 2 + 1.2);
    const skew = 1 + 0.15 * Math.cos(a);
    return { x: 50 + r * Math.cos(a) * skew, y: 50 + r * Math.sin(a) * 0.6 };
  })),

  // Key
  () => make('Key', pts(44,24, 52,24, 52,36, 58,36, 58,42, 52,42, 52,52, 60,52, 62,54, 62,60, 60,62, 52,62, 52,72, 48,76, 44,72, 44,62, 38,62, 36,60, 36,54, 38,52, 44,52, 44,24)),

  // Mushroom
  () => make('Mushroom', pts(34,38, 38,26, 46,18, 54,18, 62,26, 66,38, 68,46, 68,54, 66,58, 60,64, 56,72, 54,78, 52,80, 48,80, 46,78, 44,72, 40,64, 34,58, 32,54, 32,46)),

  // Jellyfish
  () => make('Jellyfish', pts(34,28, 42,22, 50,18, 58,22, 66,28, 68,40, 66,52, 60,62, 56,72, 52,80, 48,80, 44,72, 40,62, 34,52, 32,40)),

  // Maple Leaf
  () => make('Maple Leaf', pts(50,14, 54,26, 64,22, 58,32, 70,34, 60,42, 72,52, 58,52, 56,64, 50,74, 44,64, 42,52, 28,52, 40,42, 30,34, 42,32, 36,22, 46,26)),

  // Croissant
  () => make('Croissant', pts(34,28, 46,22, 58,26, 66,34, 68,44, 64,54, 56,60, 44,62, 34,56, 28,46, 26,38, 30,30)),

  // Drop
  () => make('Drop', radial(50, 50, 16, 28, a => 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(a * 0.5 + 0.3)))),

  // Fish
  () => make('Fish', pts(24,42, 32,36, 44,30, 56,30, 66,34, 72,38, 78,34, 80,38, 78,44, 72,48, 66,52, 56,56, 44,56, 32,50, 24,46, 22,44)),

  // Coral
  () => make('Coral', organicPts(73, 28)),

  // Pretzel
  () => make('Pretzel', pts(42,22, 56,20, 66,28, 68,40, 62,50, 52,52, 44,48, 40,40, 42,32, 48,28, 54,30, 56,36, 52,42, 46,46, 50,54, 56,62, 54,72, 46,78, 38,74, 34,66, 36,58)),

  // Candle
  () => make('Candle', pts(44,30, 48,30, 50,28, 50,24, 48,22, 44,22, 42,24, 42,28, 42,34, 38,38, 36,48, 36,62, 38,72, 42,78, 48,80, 54,78, 58,72, 60,62, 60,48, 58,38, 54,34)),

  // Seaweed
  () => make('Seaweed', pts(44,18, 52,22, 54,34, 48,42, 52,50, 56,42, 58,30, 60,40, 58,56, 52,64, 56,72, 52,80, 46,80, 42,72, 44,62, 48,54, 44,44, 40,34, 42,24)),

  // Avocado
  () => make('Avocado', pts(36,32, 42,24, 52,20, 62,24, 68,32, 70,42, 68,52, 62,60, 56,64, 50,66, 44,64, 38,60, 34,54, 32,44, 34,36, 42,36, 50,34, 50,42, 46,48, 44,44)),

  // Ink Blot
  () => make('Ink Blot', organicPts(42, 26)),

  // Swan
  () => make('Swan', pts(28,44, 36,38, 48,34, 58,32, 66,30, 72,28, 74,32, 68,36, 60,40, 52,44, 46,50, 42,58, 40,68, 42,76, 48,80, 54,78, 56,70, 54,60, 48,54, 44,48)),

  // Tree Root
  () => make('Tree Root', pts(44,22, 52,22, 54,34, 58,44, 62,54, 66,62, 64,70, 58,68, 54,60, 50,52, 46,44, 42,36, 40,28)),

  // Bell Pepper
  () => make('Bell Pepper', pts(34,40, 40,32, 50,28, 60,30, 68,36, 70,46, 66,56, 58,64, 48,68, 38,64, 32,56, 30,48)),

  // Treasure Chest
  () => make('Treasure Chest', pts(28,38, 32,32, 42,28, 58,28, 68,32, 72,38, 72,50, 68,54, 64,50, 56,48, 50,50, 44,48, 36,50, 32,54, 28,50)),

  // Teapot
  () => make('Teapot', pts(32,36, 38,28, 46,24, 54,24, 62,28, 68,36, 72,44, 72,52, 74,48, 80,48, 82,54, 78,58, 72,56, 68,56, 62,58, 54,60, 46,60, 38,58, 32,54, 28,48, 28,40)),

  // Seashell
  () => make('Seashell', pts(34,34, 42,28, 52,24, 62,28, 68,36, 66,48, 58,56, 48,62, 40,66, 34,62, 30,54, 28,44)),

  // Turtle
  () => make('Turtle', pts(30,38, 38,30, 50,26, 62,30, 70,38, 72,48, 68,58, 58,64, 46,66, 36,62, 30,54, 28,46)),

  // Cactus
  () => make('Cactus', pts(46,22, 50,22, 50,30, 54,30, 54,38, 50,38, 50,46, 52,46, 52,54, 50,54, 50,64, 48,72, 44,80, 40,80, 38,72, 38,60, 40,54, 40,46, 44,46, 44,38, 42,38, 42,30, 46,30)),

  // Watering Can
  () => make('Watering Can', pts(30,36, 38,30, 50,28, 60,30, 64,36, 64,44, 60,46, 72,42, 76,46, 74,52, 68,54, 60,50, 56,54, 48,56, 38,54, 32,50, 28,44)),

  // Meteorite
  () => make('Meteorite', pts(40,22, 54,18, 66,24, 70,36, 64,50, 50,56, 38,52, 32,42, 30,32)),

  // Branch
  () => make('Branch', pts(28,44, 38,38, 48,34, 56,32, 62,30, 66,34, 60,36, 52,40, 44,44, 36,50, 30,54)),

  // Candy
  () => make('Candy', pts(34,30, 46,26, 56,28, 64,34, 68,44, 66,54, 58,60, 48,64, 38,62, 30,56, 28,46, 30,38)),

  // Flame
  () => make('Flame', pts(50,14, 56,28, 64,38, 68,48, 66,58, 58,66, 48,72, 40,66, 34,58, 32,48, 36,38, 44,28)),

  // Pear
  () => make('Pear', pts(40,28, 48,22, 56,22, 64,28, 66,38, 64,48, 60,56, 56,62, 50,64, 44,62, 38,56, 34,48, 36,38)),

  // Ghost Silhouette
  () => make('Ghost', pts(36,24, 46,18, 58,18, 66,24, 68,36, 66,50, 62,62, 56,72, 50,80, 48,74, 44,68, 40,72, 36,66, 34,74, 30,80, 28,72, 32,62, 36,50, 34,36)),

  // Rocket
  () => make('Rocket', pts(50,10, 58,28, 64,40, 66,54, 62,66, 56,74, 50,80, 44,74, 38,66, 34,54, 36,40, 42,28)),

  // Boomerang
  () => make('Boomerang', pts(22,56, 34,44, 50,36, 64,32, 72,30, 68,38, 56,44, 42,52, 30,62)),

  // Dragon Head
  () => make('Dragon Head', pts(50,14, 60,18, 70,26, 76,36, 74,48, 66,56, 58,62, 62,72, 56,80, 48,76, 44,68, 38,72, 34,66, 36,56, 40,48, 36,40, 42,30)),

  // Color Blot
  () => make('Color Blot', organicPts(18, 28)),

  // Dino Head
  () => make('Dino Head', pts(34,30, 42,22, 54,18, 64,22, 70,30, 72,42, 68,54, 60,62, 50,66, 40,62, 34,54, 30,44)),

  // Whale
  () => make('Whale', pts(20,44, 34,36, 50,30, 66,30, 76,34, 80,40, 76,46, 66,50, 56,52, 48,54, 40,56, 32,54, 26,50)),

  // Owl
  () => make('Owl', pts(34,28, 42,22, 50,18, 58,22, 66,28, 68,38, 66,50, 60,58, 54,64, 46,64, 40,58, 34,50, 32,38)),

  // Scissors
  () => make('Scissors', pts(20,52, 30,44, 40,40, 48,38, 50,42, 44,48, 38,54, 34,62, 42,72, 48,80, 56,76, 52,68, 44,60, 50,52, 60,44, 68,38, 76,36, 80,42, 76,48, 68,50, 58,54, 50,60)),

  // Potato
  () => make('Potato', organicPts(33, 26)),

  // Anchor
  () => make('Anchor', pts(46,24, 54,24, 56,34, 56,46, 60,50, 66,48, 68,54, 62,58, 56,58, 54,64, 54,72, 52,78, 48,80, 44,78, 42,72, 42,64, 40,58, 34,58, 28,54, 30,48, 36,50, 40,46, 40,34)),

  // Coral Branch
  () => make('Coral Branch', pts(46,18, 52,22, 54,32, 58,40, 64,44, 62,50, 56,46, 52,38, 48,30, 44,40, 48,48, 46,54, 40,50, 38,42, 36,32, 40,24)),

  // Umbrella
  () => make('Umbrella', pts(28,34, 36,24, 48,18, 60,18, 72,24, 78,34, 74,36, 66,30, 54,26, 50,38, 50,54, 50,62, 48,70, 44,78, 40,70, 46,62, 46,54, 46,38, 42,26, 34,30, 30,36)),

  // Donut Bite
  () => make('Donut Bite', pts(32,32, 44,26, 56,26, 68,32, 74,44, 72,56, 64,66, 52,72, 40,68, 32,58, 28,46, 42,44, 48,40, 52,44, 48,50, 42,48, 38,48)),

  // Puzzle Piece
  () => make('Puzzle Piece', pts(32,28, 44,28, 44,34, 48,34, 48,28, 56,28, 56,36, 52,38, 56,40, 56,48, 52,48, 48,44, 44,48, 36,48, 36,40, 40,38, 36,36)),

  // Spiral
  () => make('Spiral', parametric(32, t => {
    const a = t * Math.PI * 2;
    const r = 20 + 6 * Math.cos(a * 3);
    const ang = a + 0.8 * Math.sin(a * 2);
    return { x: 50 + r * Math.cos(ang), y: 50 + r * Math.sin(ang) };
  })),

  // Crystal
  () => make('Crystal', pts(50,14, 60,28, 64,42, 60,56, 52,68, 48,68, 40,56, 36,42, 40,28)),

  // Glove
  () => make('Glove', pts(34,30, 42,24, 50,22, 56,26, 62,30, 64,40, 62,50, 58,58, 54,66, 52,74, 48,80, 44,74, 42,66, 38,58, 34,50, 32,40)),

  // Sock
  () => make('Sock', pts(44,22, 52,22, 56,30, 56,44, 54,54, 52,64, 50,72, 46,80, 40,78, 36,72, 34,64, 36,56, 40,48, 42,38, 42,30)),

  // Rubber Duck
  () => make('Rubber Duck', pts(40,28, 48,22, 56,22, 62,28, 64,36, 60,42, 54,46, 48,48, 44,54, 42,64, 44,72, 48,78, 54,76, 56,68, 52,60, 48,54, 50,48, 52,48, 56,44, 58,38, 56,30, 50,26, 44,30)),

  // Pipe
  () => make('Pipe', pts(24,44, 36,38, 50,36, 62,38, 70,44, 68,50, 60,54, 50,56, 60,60, 68,66, 64,72, 54,70, 44,64, 36,56, 28,50)),

  // Snail
  () => make('Snail', pts(30,42, 40,36, 50,34, 58,36, 64,42, 62,50, 54,56, 44,58, 38,56, 34,50, 36,48, 42,50, 48,50, 52,48, 54,44, 50,40, 44,40, 38,44, 32,48, 28,54, 30,60, 36,64, 46,66, 54,64, 60,58, 64,50, 66,42, 62,34, 54,30, 44,30, 34,34)),

  // Snowflake (asymmetric)
  () => make('Snowflake', parametric(24, t => {
    const a = t * Math.PI * 2;
    const r = 22 + 8 * Math.cos(a * 6 + 0.3) + 3 * Math.sin(a * 7 + 1.4);
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) * 0.9 };
  })),

  // Lobster
  () => make('Lobster', pts(28,48, 36,40, 46,34, 56,34, 64,38, 70,44, 68,52, 60,56, 52,58, 44,56, 38,50, 34,54, 30,60, 36,64, 44,66, 52,64, 58,60, 62,54, 66,48, 64,40, 56,36, 48,36, 40,40, 34,46)),

  // Peanut
  () => make('Peanut', parametric(24, t => {
    const a = t * Math.PI * 2;
    const pinch = 1 - 0.3 * Math.max(0, Math.cos(a * 2)) ** 2;
    const r = 18 * pinch;
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) * 0.6 };
  })),

  // Fox Head
  () => make('Fox Head', pts(34,24, 44,18, 50,22, 50,18, 52,22, 56,18, 66,24, 70,34, 68,46, 62,56, 54,62, 46,62, 38,56, 32,46, 30,34)),

  // Witch Hat
  () => make('Witch Hat', pts(50,14, 58,30, 62,38, 66,44, 68,52, 64,56, 58,58, 42,58, 36,56, 32,52, 34,44, 38,38, 42,30)),

  // Potion Bottle
  () => make('Potion Bottle', pts(42,22, 50,18, 58,22, 60,30, 60,40, 64,44, 64,56, 62,64, 58,72, 54,78, 46,78, 42,72, 38,64, 36,56, 36,44, 40,40, 40,30)),

  // Fern Leaf
  () => make('Fern Leaf', pts(28,50, 38,44, 48,38, 56,32, 62,26, 66,30, 60,36, 52,44, 44,50, 36,56, 30,60)),

  // Palm Tree
  () => make('Palm Tree', pts(46,22, 52,22, 52,34, 56,40, 62,44, 66,40, 64,36, 58,34, 54,30, 52,26, 52,40, 50,52, 48,62, 46,52, 44,40, 44,26, 42,30, 36,34, 34,36, 36,40, 42,40, 48,34)),

  // Speech Bubble
  () => make('Speech Bubble', pts(28,28, 40,22, 56,22, 68,28, 72,40, 68,52, 56,58, 44,58, 38,62, 40,54, 32,50, 28,40)),

  // Bird in Flight
  () => make('Bird in Flight', pts(16,40, 30,34, 44,30, 56,28, 66,30, 74,34, 70,38, 62,36, 54,34, 44,36, 34,40, 24,46)),

  // Acorn
  () => make('Acorn', pts(40,24, 48,20, 56,20, 64,24, 66,32, 64,40, 58,48, 52,54, 48,54, 42,48, 36,40, 34,32)),

  // Hook
  () => make('Hook', pts(42,22, 54,22, 58,30, 56,40, 50,48, 44,54, 40,60, 38,68, 42,74, 48,76, 54,72, 56,66, 52,62, 48,64, 46,68, 44,64, 46,56, 50,50, 54,44, 56,36, 54,28, 48,26)),

  // Dripping Blot
  () => make('Dripping Blot', pts(36,22, 50,18, 62,22, 66,34, 62,46, 54,54, 48,62, 46,70, 44,78, 40,70, 38,62, 36,54, 34,46, 32,34)),

  // Bonsai Tree
  () => make('Bonsai', pts(46,36, 52,36, 52,44, 56,50, 62,54, 64,60, 60,64, 54,60, 48,56, 44,60, 40,64, 36,60, 38,54, 44,50, 48,44)),

  // Maple Seed (Helicopter)
  () => make('Maple Seed', pts(50,14, 54,24, 60,30, 66,34, 68,40, 64,44, 58,42, 52,36, 48,28, 44,36, 38,42, 32,44, 28,40, 30,34, 36,30, 42,24, 46,14)),

  // Crown
  () => make('Crown', pts(28,46, 34,36, 42,42, 50,30, 58,42, 66,36, 72,46, 68,54, 62,58, 50,62, 38,58, 32,54)),

  // Blob Monster
  () => make('Blob Monster', organicPts(55, 28)),

  // Water Splash Drop
  () => make('Water Splash', pts(50,14, 56,28, 64,36, 68,46, 64,56, 56,62, 52,70, 48,70, 44,62, 36,56, 32,46, 36,36, 44,28)),

  // Cheese Wedge
  () => make('Cheese', pts(30,40, 46,30, 62,24, 70,32, 62,36, 64,44, 56,42, 58,50, 48,48, 50,56, 42,54, 38,48, 34,50)),

  // Message in Bottle
  () => make('Message in Bottle', pts(34,30, 46,24, 58,24, 66,30, 68,38, 68,46, 66,54, 58,60, 46,60, 34,54, 30,46, 30,38)),

  // Volcano
  () => make('Volcano', pts(30,48, 38,36, 46,28, 52,22, 56,28, 58,32, 62,28, 68,36, 72,48, 68,56, 60,62, 50,66, 40,62, 32,56)),

  // Crab
  () => make('Crab', pts(24,44, 34,38, 42,34, 50,32, 58,34, 66,38, 76,44, 72,48, 64,46, 58,44, 56,48, 58,54, 62,60, 58,62, 52,56, 48,54, 44,56, 38,62, 34,60, 38,54, 42,48, 44,44, 36,46, 28,48)),

  // Alien Head
  () => make('Alien Head', pts(40,22, 50,16, 60,22, 64,32, 62,44, 56,52, 50,56, 44,52, 38,44, 36,32)),

  // Iceberg
  () => make('Iceberg', pts(22,44, 34,34, 44,28, 52,22, 60,28, 68,34, 78,44, 72,52, 64,56, 56,58, 48,56, 40,56, 32,52, 26,48)),

  // Comet
  () => make('Comet', pts(26,44, 40,38, 52,36, 62,38, 70,42, 74,48, 68,52, 58,50, 48,48, 38,48, 30,48)),

  // Bat
  () => make('Bat', pts(30,34, 38,28, 44,32, 48,26, 50,32, 52,26, 56,32, 62,28, 70,34, 68,42, 62,48, 56,52, 50,56, 44,52, 38,48, 32,42)),

  // Octopus
  () => make('Octopus', pts(34,30, 42,24, 50,22, 58,24, 66,30, 68,40, 66,50, 60,56, 54,62, 50,70, 46,62, 42,56, 36,50, 32,40)),

  // Antlers
  () => make('Antlers', pts(44,22, 50,18, 52,24, 48,30, 52,36, 56,32, 60,26, 62,32, 58,38, 54,42, 50,38, 46,36, 42,38, 38,42, 34,38, 36,32, 40,28, 44,26)),

  // Handsaw
  () => make('Handsaw', pts(20,48, 34,42, 48,38, 62,36, 74,38, 80,44, 74,48, 62,48, 48,46, 34,48, 28,52, 24,50)),

  // Smoke Cloud
  () => make('Smoke Cloud', radial(50, 48, 22, 32, a => 0.2 + 0.6 * (0.5 + 0.5 * Math.cos(a * 2 + 1.3)))),

  // Saxophone
  () => make('Saxophone', pts(34,30, 44,24, 54,26, 60,32, 62,40, 60,48, 54,54, 46,56, 38,52, 32,46, 30,38, 36,44, 42,48, 48,48, 52,44, 54,38, 50,34, 44,32, 38,36, 36,42, 40,50, 48,54, 56,52, 62,46, 64,38, 62,30, 54,24, 44,22, 36,26)),

  // Cookie Bite
  () => make('Cookie Bite', pts(32,32, 42,26, 52,24, 62,26, 70,32, 72,42, 66,50, 56,54, 46,52, 38,48, 34,42, 38,40, 44,42, 50,40, 46,36, 42,38, 36,36)),

  // Dino Footprint
  () => make('Dino Footprint', pts(40,28, 52,24, 60,28, 62,38, 58,46, 50,50, 42,48, 36,42, 34,36, 36,30, 42,32, 48,30, 44,26)),

  // Paw Print
  () => make('Paw Print', pts(34,30, 40,24, 46,28, 44,36, 40,38, 36,36, 46,30, 52,24, 58,28, 56,36, 52,38, 48,36, 50,32, 46,38, 56,42, 60,48, 58,54, 50,52, 44,46, 38,42)),

  // Boulder
  () => make('Boulder', organicPts(77, 28)),

  // Beaver Tail
  () => make('Beaver Tail', pts(36,22, 50,18, 64,22, 72,30, 74,40, 70,50, 62,54, 50,56, 38,54, 30,50, 26,40, 28,30)),

  // Pumpkin
  () => make('Pumpkin', pts(34,28, 42,22, 50,20, 58,22, 66,28, 68,38, 66,48, 58,56, 50,58, 42,56, 34,48, 32,38)),

  // Butterfly (asymmetric)
  () => make('Butterfly', pts(30,32, 40,26, 48,22, 52,28, 56,22, 64,26, 72,32, 68,40, 60,44, 54,46, 50,52, 46,46, 40,44, 32,40)),

  // Cobra
  () => make('Cobra', pts(36,22, 46,18, 54,20, 58,28, 56,38, 50,46, 44,52, 40,60, 38,70, 42,78, 48,80, 54,76, 56,68, 52,60, 48,54, 52,48, 56,42, 58,34, 54,26, 46,24)),

  // Curved Arrow
  () => make('Curved Arrow', pts(28,52, 40,46, 50,42, 58,40, 64,42, 68,48, 64,52, 58,50, 52,48, 46,48, 38,52, 32,56)),

  // Tree Canopy
  () => make('Tree Canopy', pts(30,36, 38,26, 48,20, 58,20, 68,26, 74,36, 70,46, 60,52, 50,54, 40,52, 32,46)),

  // Island Silhouette
  () => make('Island', pts(16,52, 30,44, 44,40, 56,38, 66,40, 76,44, 84,52, 74,56, 60,58, 44,58, 28,56)),

  // Crown (variation)
  () => make('Crown', pts(28,50, 34,38, 42,44, 50,32, 58,44, 66,38, 72,50, 66,56, 56,60, 44,60, 34,56)),
];

export function resetColorIdx() { colorIdx = 0; }