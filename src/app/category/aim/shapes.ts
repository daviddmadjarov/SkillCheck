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

  // THE PERFECT SPLIT HAMMER (Highly Detailed Contour)
  make('Hammer', pts(
    46,12, 50,11, 54,12, 58,13,
    64,15, 72,17, 76,19, 76,27, 72,29, 64,31,
    56,32, 54,36,
    54,46, 54,58, 54,70, 54,82,
    55,88, 57,93, 55,96, 50,96, 45,96, 43,93, 45,88,
    46,82, 46,70, 46,58, 46,46,
    46,36, 42,32,
    34,35, 26,41, 18,48, 16,52, 16,46, 20,36, 26,26, 34,18,
    40,14, 44,13
  )),

  // THE PERFECT SPLIT GHOST (Highly Detailed Contour)
  make('Ghost', pts(
    50,10, 56,11, 62,13, 67,17, 71,22, 74,28, 75,35,
    74,42, 72,49, 70,56, 69,63, 70,70, 72,77, 74,84,
    69,87, 64,83, 59,86, 54,89, 49,85, 44,82, 39,86,
    33,88, 26,84, 19,77, 14,68, 11,57, 10,45, 12,34, 16,25,
    21,19, 27,16, 33,13, 40,11, 45,10
  )),

  // THE PERFECT SPLIT KEY (Highly Detailed Contour)
  make('Key', pts(
    30,32, 24,33, 18,37, 14,43, 12,50, 14,57, 18,63, 24,67, 30,68,
    35,64, 38,56,
    46,55, 54,55, 62,55, 70,55,
    70,66, 72,72, 76,72, 78,65, 78,55,
    82,55, 82,78, 88,78, 90,70, 90,55,
    93,53, 94,50, 93,47,
    90,45, 80,45, 70,45, 60,45, 46,45,
    38,44, 35,36
  )),

  // THE PERFECT SPLIT CIRCLE (Flawless Symmetrical Disk)
  make('Circle', pts(
    50,10, 56,10, 62,12, 68,15, 74,19, 79,24, 83,29, 87,35, 89,41, 90,47,
    90,53, 89,59, 87,65, 83,71, 79,76, 74,81, 68,85, 62,88, 56,90, 50,90,
    44,90, 38,88, 32,85, 26,81, 21,76, 17,71, 13,65, 11,59, 10,53, 10,47,
    11,41, 13,35, 17,29, 21,24, 26,19, 32,15, 38,12, 44,10
  )),

  // THE PERFECT SPLIT BOLT (Chunky Cartoon Lightning)
  make('Bolt', pts(
    35,10, 50,8, 68,12,
    64,22, 60,32, 55,42,
    62,43, 72,45, 80,47,
    69,58, 58,69, 47,80, 36,92,
    34,92, 33,87,
    38,76, 43,65, 48,54,
    38,52, 28,50, 18,48,
    22,38, 26,28, 31,18
  )),

  // THE PERFECT SPLIT CACTUS (Highly Detailed Asymmetrical Contour)
  make('Cactus', pts(
    50,10, 54,11, 58,13, 60,17, 61,22,
    61,32, 62,40,
    66,40, 72,40, 77,43, 78,48,
    78,32, 81,22, 85,22, 88,26, 88,36,
    86,48, 83,58, 78,65, 72,66, 62,64,
    61,72, 61,82, 61,90,
    54,90, 46,90,
    39,90, 39,82, 39,76,
    34,75, 26,76, 18,73, 13,67, 12,59,
    12,48, 15,40, 20,40, 24,44, 24,54,
    25,60, 30,64, 34,64, 39,61,
    39,46, 39,32, 40,22, 42,15, 46,11
  )),

  // RAKETE (Verzerrter Comic-Stil)
  make('Rakete', pts(
    75,10, 78,15, 79,22,
    76,34, 71,46, 64,58, 56,70,
    62,76, 70,84, 73,90, 63,88, 54,80,
    48,84, 46,92, 40,95, 36,91, 38,82,
    30,83, 20,85, 16,86, 22,76, 30,70,
    38,58, 48,46, 58,34, 68,22, 72,13
  )),

  // KRISTALL (Edelstein-Silhouette)
  make('Kristall', pts(
    35,15, 50,12, 65,16,
    76,24, 85,34, 88,44,
    78,58, 66,72, 54,86,
    50,90, 47,89,
    38,72, 24,54, 12,40,
    14,28, 22,20
  )),

  // HANDSCHUH (Dicker Winterfäustling)
  make('Handschuh', pts(
    42,48, 36,50,
    26,53, 18,58, 12,65, 14,73, 20,76, 28,74, 38,68,
    40,80, 42,92,
    50,92, 62,92,
    64,80, 66,66, 68,52,
    67,38, 64,24, 56,15, 46,18, 42,28, 42,40
  )),

  // SOCKE (Nikolaus-Stiefel-Look)
  make('Socke', pts(
    46,10, 60,12,
    61,24, 62,38, 64,52,
    68,60, 72,66, 70,72, 64,75,
    52,80, 38,84, 24,87,
    14,85, 10,78, 12,70, 18,65,
    28,64, 38,60, 44,52,
    45,38, 45,24
  )),

  // HEXENHUT (Gezackter Klassiker)
  make('Hexenhut', pts(
    5,80, 12,77, 22,75,
    32,74, 36,66,
    34,54, 30,42, 24,30,
    22,16, 26,12, 32,15, 36,22,
    42,32, 48,44, 55,56, 62,68,
    66,74, 76,75, 86,78, 95,82,
    80,85, 64,87, 50,88, 36,87, 20,84
  )),

  // DER PERFEKTE ANKER (Simpel, sauber und fehlerfrei)
  make('Anker', pts(
    50,6, 54,7, 56,11, 54,15, 50,16, 46,15, 44,11, 46,7,
    50,16,
    68,16, 68,22, 53,22,
    53,50,
    64,52, 76,57, 84,66, 86,76, 82,82, 74,78, 76,69, 64,60,
    50,86,
    36,60, 24,69, 26,78, 18,82, 14,76, 16,66, 24,57, 36,52,
    47,50,
    47,22, 32,22, 32,16, 50,16
  )),

  // DIE PERFEKTE SPRECHBLASE (Clean, rund und asymmetrisch)
  make('Sprechblase', pts(
    30,20, 40,17, 50,16, 60,17, 70,20, 78,25, 84,32, 87,40,
    88,48, 87,56, 84,64, 78,71, 70,76, 60,79, 50,80,
    40,79, 32,76,
    28,75, 20,86, 18,92, 23,83, 26,74,
    20,71, 14,64, 11,56, 10,48, 11,40, 14,32, 20,25
  )),

  // DER PERFEKTE BAUM (Asymmetrische Comic-Krone)
  make('Baum', pts(
    50,10, 58,11, 66,14, 72,20,
    78,28, 80,38, 76,46, 68,50,
    58,52, 58,64, 58,78,
    62,90, 50,92, 36,90,
    42,78, 42,64, 42,54,
    34,56, 24,58, 16,52, 14,42, 16,32,
    22,22, 30,15, 40,11
  )),

  // DIE ULTRA-HIGH-RES VEKTOR-HAND
  make('Hand Print', pts(
    36,82, 37,78, 38,74, 37,70, 36,66, 35,62, 34,58,
    33,52, 32,46, 32,40, 32,36,
    33,33, 35,32, 37,32, 39,33,
    40,36, 40,40, 40,46, 41,52,
    42,55, 43,56, 44,55,
    44,46, 43,38, 43,32, 43,28,
    44,25, 46,24, 48,24, 50,25,
    50,28, 50,32, 50,38, 50,46, 51,52,
    52,57, 53,58, 54,57,
    54,46, 54,34, 54,26, 54,21,
    55,19, 56,18, 58,18, 59,19,
    59,21, 59,26, 59,34, 59,46, 59,52,
    60,57, 61,58, 62,57,
    62,46, 62,38, 62,32, 62,28,
    63,25, 65,24, 67,24, 69,25,
    69,28, 69,32, 69,38, 69,46, 69,54,
    70,58, 72,56, 74,54,
    76,53, 78,54, 80,56, 81,59, 80,62,
    77,66, 74,70, 71,74,
    67,78, 64,82, 60,85, 55,86, 49,86, 43,85, 39,82
  )),
];

export function randomShape(): SplitShapeDef {
  return ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)];
}

export function getShapeCount() { return ALL_SHAPES.length; }
