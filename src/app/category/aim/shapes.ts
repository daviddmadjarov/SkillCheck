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
  // SMOOTH & CURVY ASYMMETRICAL APPLE
  make('Apple', pts(
    50,30, 49,22, 49,15, 51,15, 51,22, 52,28,
    46,26, 40,21, 34,17, 28,16, 24,19, 23,23, 26,26, 31,28, 38,29, 45,29,
    54,30, 59,30, 64,31, 69,33, 74,35, 78,39, 82,43, 85,48, 87,54, 88,60,
    87,66, 85,71, 82,76, 78,81, 73,85, 68,87, 63,89, 58,89,
    55,87, 53,85, 51,84, 49,85, 47,87, 44,89,
    39,89, 33,87, 27,84, 22,80, 18,75, 14,69, 12,63, 11,56, 12,49, 14,43,
    18,38, 22,34, 27,32, 32,31, 38,30, 44,30
  )),

  // THE PERFECT SPLIT BANANA (Highly Detailed Contour)
  make('Banana', pts(
    50,5, 54,6, 53,12, 51,16,
    46,22, 42,29, 39,37, 37,46, 37,55, 39,64, 43,73, 48,81,
    52,87, 54,91, 52,94, 49,94, 46,90,
    39,83, 33,76, 27,68, 22,59, 19,49, 18,39, 20,29, 25,20, 32,13,
    40,9, 45,7
  )),
];

export function randomShape(): SplitShapeDef {
  return ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)];
}

export function getShapeCount() { return ALL_SHAPES.length; }