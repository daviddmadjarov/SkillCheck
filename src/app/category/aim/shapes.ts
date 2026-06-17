'use client';

import type { Point } from './aim-protocols';

function vertPath(p: Point[]): string {
  return 'M' + p.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L') + ' Z';
}

function pts(...list: number[]): Point[] {
  const p: Point[] = [];
  for (let i = 0; i < list.length; i += 2) p.push({ x: list[i], y: list[i + 1] });
  return p;
}

const COLORS = [
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
  { fill: '#ffedd5', stroke: '#c2410c' },
  { fill: '#fce7f3', stroke: '#be185d' },
  { fill: '#d1fae5', stroke: '#059669' },
  { fill: '#e0f2fe', stroke: '#0284c7' },
  { fill: '#fef9c3', stroke: '#a16207' },
  { fill: '#e2e8f0', stroke: '#475569' },
  { fill: '#fef08a', stroke: '#ca8a04' },
  { fill: '#fae8ff', stroke: '#c026d3' },
  { fill: '#ffedd5', stroke: '#9a3412' },
  { fill: '#dbeafe', stroke: '#2563eb' },
  { fill: '#f0fdf4', stroke: '#15803d' },
  { fill: '#fdf2f8', stroke: '#be185d' },
  { fill: '#f5f5dc', stroke: '#78716c' },
  { fill: '#fee2e2', stroke: '#b91c1c' },
  { fill: '#ecfeff', stroke: '#0e7490' },
  { fill: '#fefce8', stroke: '#a16207' },
  { fill: '#f3e8ff', stroke: '#7e22ce' },
  { fill: '#fce7f3', stroke: '#be185d' },
  { fill: '#fdf4ff', stroke: '#a21caf' },
  { fill: '#e0f2fe', stroke: '#0369a1' },
  { fill: '#dcfce7', stroke: '#166534' },
  { fill: '#fff7ed', stroke: '#c2410c' },
  { fill: '#f5f5f4', stroke: '#44403c' },
  { fill: '#fef2f2', stroke: '#991b1b' },
  { fill: '#faf5ff', stroke: '#6b21a8' },
];

let colorIdx = 0;
function nextColor() {
  const c = COLORS[colorIdx % COLORS.length];
  colorIdx = (colorIdx + 1) % COLORS.length;
  return c;
}

export type SplitShapeDef = {
  pts: Point[];
  label: string;
  fill: string;
  stroke: string;
  path: string;
};

function make(label: string, p: Point[]): SplitShapeDef {
  const col = nextColor();
  return { pts: p, label, path: vertPath(p), ...col };
}

export function resetColorIdx() { colorIdx = 0; }

// ─── Shape pool ─────────────────────────────────────────────────────────────
// Pre-computed shapes. Add using: make('Name', pts(x1,y1, x2,y2, ...))

const ALL_SHAPES: SplitShapeDef[] = [
  // 1. SMOOTH & CURVY ASYMMETRICAL APPLE
  make('Apple', pts(
    50,30, 49,22, 49,15, 51,15, 51,22, 52,28,
    46,26, 40,21, 34,17, 28,16, 24,19, 23,23, 26,26, 31,28, 38,29, 45,29,
    54,30, 59,30, 64,31, 69,33, 74,35, 78,39, 82,43, 85,48, 87,54, 88,60,
    87,66, 85,71, 82,76, 78,81, 73,85, 68,87, 63,89, 58,89,
    55,87, 53,85, 51,84, 49,85, 47,87, 44,89,
    39,89, 33,87, 27,84, 22,80, 18,75, 14,69, 12,63, 11,56, 12,49, 14,43,
    18,38, 22,34, 27,32, 32,31, 38,30, 44,30
  )),

  // 2. ASYMMETRICAL CARTOON GHOST
  make('Ghost', pts(
    50,10, 56,11, 62,13, 68,17, 72,22, 75,28, 77,35,
    76,42, 74,49, 72,56, 71,63, 72,70, 74,77, 77,84, 78,88,
    72,87, 67,83, 62,85, 57,88, 52,86, 47,82, 42,85, 37,89,
    31,86, 25,80, 20,72, 15,62, 12,50, 11,38, 13,28, 17,21,
    22,17, 28,15, 34,13, 40,11, 45,10
  )),

  // 3. WONKY LOPSIDED BANANA
  make('Banana', pts(
    50,5, 54,6, 54,12, 52,16, 49,18,
    44,24, 40,32, 38,40, 37,50, 38,60, 40,70, 44,78, 49,85,
    52,90, 54,92, 51,94, 47,93, 43,89,
    35,82, 28,73, 22,62, 19,50, 18,38, 20,27, 25,18, 33,11,
    41,7, 46,5
  )),

  // 4. IRREGULAR INK SPLAT
  make('Ink Splat', pts(
    50,30, 49,18, 47,10, 51,7, 54,10, 53,19, 54,28,
    62,30, 71,26, 82,24, 88,30, 85,38, 76,40, 68,44,
    73,53, 81,62, 83,71, 76,75, 69,70, 62,62,
    54,65, 49,76, 46,88, 41,89, 40,80, 44,68, 47,59,
    38,55, 27,58, 15,57, 10,50, 14,43, 24,42, 35,45,
    41,38, 46,33
  )),

  // 5. PROFILE CARTOON SHARK
  make('Shark', pts(
    10,50, 15,46, 21,43, 28,41, 36,40,
    44,38, 51,35, 57,30,
    61,22, 66,12, 72,5, 74,8, 73,16, 71,26, 71,35,
    76,40, 83,43, 89,45, 94,42, 97,35, 99,44, 96,53, 92,62,
    86,60, 80,58, 73,57, 65,57,
    59,64, 55,73, 51,80, 48,79, 49,70, 51,61,
    44,59, 36,58, 28,58, 20,56, 14,53
  )),

  // 6. CHUNKY FANTASY KEY
  make('Key', pts(
    30,30, 24,31, 18,34, 14,40, 12,50, 14,60, 18,66, 24,69, 30,70,
    35,66, 38,58,
    46,57, 54,57, 62,57, 70,57,
    70,68, 72,74, 77,74, 79,66, 80,57,
    84,57, 84,79, 89,79, 91,72, 91,57,
    94,54, 95,50, 94,46,
    82,43, 70,43, 58,43, 46,43,
    38,42, 35,34
  )),
];

export function randomShape(): SplitShapeDef {
  return ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)];
}

export function getShapeCount() { return ALL_SHAPES.length; }