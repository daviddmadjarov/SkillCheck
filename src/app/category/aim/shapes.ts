'use client';

import type { Point } from './aim-protocols';

// ─── Utilities ──────────────────────────────────────────────────────────────

function vertPath(p: Point[]): string {
  return 'M' + p.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' L') + ' Z';
}

function pts(...list: number[]): Point[] {
  const p: Point[] = [];
  for (let i = 0; i < list.length; i += 2) p.push({ x: list[i], y: list[i + 1] });
  return p;
}

// ─── Colors ─────────────────────────────────────────────────────────────────

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
  { fill: '#ffedd5', stroke: '#c2410c' },
  { fill: '#fce7f3', stroke: '#be185d' },
  { fill: '#d1fae5', stroke: '#059669' },
  { fill: '#e0f2fe', stroke: '#0284c7' },
  { fill: '#fef9c3', stroke: '#a16207' },
];

let colorIdx = 0;
function nextColor() {
  const c = C[colorIdx % C.length];
  colorIdx = (colorIdx + 1) % C.length;
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

// ─── Smooth organic shape generator ────────────────────────────────────────
// Generates a cartoon-like blob from a set of control points that define
// the outline's character, with natural asymmetry built in.

/**
 * Produces a smooth closed polygon from a set of anchor points.
 * Each [x,y] pair in anchors defines where the shape should pass through.
 * The output is a dense polygon (~48 pts) that traces smooth arcs between anchors.
 */
function blob(anchors: number[], k = 0.15): Point[] {
  const n = anchors.length / 2;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({ x: anchors[i * 2], y: anchors[i * 2 + 1] });
  }

  // Interpolate through anchors with a Catmull-Rom like curve
  const result: Point[] = [];
  const steps = 6; // points per segment
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];

    for (let t = 0; t <= steps; t++) {
      const s = t / steps;
      // Catmull-Rom interpolation
      const s2 = s * s;
      const s3 = s2 * s;
      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * s +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3
      );
      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * s +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3
      );
      result.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
  }
  return result;
}

export function randomShape(): SplitShapeDef {
  return ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)]();
}

export function resetColorIdx() { colorIdx = 0; }

// ─── 24 Asymmetrical Cartoon Blob Shapes ────────────────────────────────────
// Each shape is defined by a small number of anchor points that create
// a smooth, organic, asymmetrical silhouette via Catmull-Rom interpolation.
// All shapes are ~30-35 radius, non-self-intersecting, and interesting to split.

const ALL_SHAPES: (() => SplitShapeDef)[] = [

  // 1. Circle (the only symmetrical shape)
  () => make('Circle', blob([
    50,12, 68,16, 80,32, 82,50, 78,68, 64,80, 50,84, 36,80, 22,68, 18,50, 20,32, 32,16,
  ])),

  // 2. Squishy Blob — fat on top-left, thin bottom-right
  () => make('Squishy', blob([
    42,14, 64,16, 78,30, 74,48, 66,58, 56,62, 48,68, 40,78, 30,76, 20,64, 18,48, 22,32,
  ])),

  // 3. Crooked Crescent — thick middle, tapered ends
  () => make('Crescent', blob([
    30,20, 52,14, 74,22, 78,40, 72,56, 58,62, 42,58, 34,44, 38,30, 30,32,
  ])),

  // 4. Melting Drip — bulbous top, narrow bottom
  () => make('Drip', blob([
    38,12, 60,14, 74,26, 72,44, 66,56, 58,62, 54,72, 48,82, 42,72, 36,60, 30,52, 26,40, 28,26,
  ])),

  // 5. Ink Splash — irregular pentagon with bulges
  () => make('Splash', blob([
    34,18, 58,12, 76,24, 70,46, 60,60, 44,66, 28,58, 20,42, 22,28, 38,22, 50,20,
  ])),

  // 6. Cartoon Cloud — fluffy asymmetrical cloud
  () => make('Cloud', blob([
    28,38, 34,26, 44,18, 60,16, 72,22, 80,34, 78,48, 70,56, 56,60, 42,58, 30,52, 24,46,
  ])),

  // 7. Bent Leaf — curved with a twist
  () => make('Leaf', blob([
    50,10, 66,16, 76,30, 78,46, 72,58, 60,64, 46,60, 38,50, 34,38, 30,28, 24,34, 22,46, 28,58, 38,68, 50,72,
  ])),

  // 8. Crooked Star — 5-pointed but asymmetrical
  () => make('Star', blob([
    50,10, 54,22, 68,18, 60,30, 74,36, 62,40, 60,52, 52,42, 44,54, 40,40, 28,38, 40,30, 34,18, 46,24,
  ])),

  // 9. Wavy Droplet — tear shape with wavy edge
  () => make('Droplet', blob([
    50,8, 62,24, 70,40, 72,56, 66,70, 54,76, 44,74, 34,66, 28,54, 30,38, 38,24,
  ])),

  // 10. Lopsided Mushroom — fat cap, tilted stem
  () => make('Mushroom', blob([
    26,34, 34,18, 50,10, 68,14, 76,28, 72,42, 64,48, 54,44, 52,52, 56,60, 54,70, 48,76, 42,70, 40,60, 44,52, 42,44, 32,40,
  ])),

  // 11. Swoosh — crescent-like but curlier, good for mid-difficulty splits
  () => make('Swoosh', blob([
    24,36, 38,20, 58,14, 74,24, 78,42, 72,58, 60,68, 46,66, 36,56, 32,44, 30,30,
  ])),

  // 12. Chubby Ghost — rounded top, wavy bottom
  () => make('Ghost', blob([
    32,18, 50,12, 68,18, 76,32, 74,50, 68,62, 60,72, 54,78, 48,74, 42,68, 36,60, 30,50, 28,34,
  ])),

  // 13. Twisted Bean — figure-8-ish but closed, asymmetrical
  () => make('Bean', blob([
    28,40, 36,22, 52,16, 68,22, 76,38, 72,56, 60,68, 46,70, 36,64, 30,52, 38,44, 48,42, 56,48, 58,58, 50,62, 40,56,
  ])),

  // 14. Blunt Arrow — arrowhead shape with one side longer
  () => make('Arrow', blob([
    20,46, 44,38, 56,30, 68,26, 78,34, 74,42, 64,40, 52,44, 40,50, 28,54,
  ])),

  // 15. Puzzle Nub — like a puzzle piece edge, one side bulging
  () => make('Puzzle', blob([
    28,24, 48,22, 48,30, 52,30, 52,22, 70,24, 74,38, 72,52, 62,56, 58,50, 54,56, 44,56, 40,50, 36,56, 28,52, 24,38,
  ])),

  // 16. Floppy Hat — wide top, narrow asymmetrical bottom
  () => make('Hat', blob([
    22,38, 36,26, 50,18, 64,20, 76,30, 78,44, 70,50, 60,46, 56,54, 52,62, 46,62, 42,54, 38,46, 30,50, 24,46,
  ])),

  // 17. Organic Blob A — lumpy potato shape, one big bump
  () => make('Blob A', blob([
    34,16, 56,12, 72,22, 78,40, 70,56, 58,64, 44,68, 32,62, 26,50, 24,36, 30,24, 40,20,
  ])),

  // 18. Organic Blob B — three-lobed, like clover without symmetry
  () => make('Blob B', blob([
    40,14, 56,18, 64,32, 72,28, 80,40, 74,52, 62,54, 54,62, 44,58, 34,64, 26,56, 22,42, 30,32, 38,36, 46,28,
  ])),

  // 19. Flame — fire shape leaning left
  () => make('Flame', blob([
    50,10, 62,28, 72,42, 74,56, 66,68, 54,74, 42,70, 34,60, 32,48, 38,36, 44,28, 42,40, 48,52, 56,50, 58,38,
  ])),

  // 20. Scroll — curled edge shape, like a ribbon
  () => make('Scroll', blob([
    24,30, 40,22, 60,20, 76,28, 78,44, 70,56, 56,60, 42,58, 32,50, 28,38, 38,34, 52,32, 64,38, 62,48, 50,50,
  ])),

  // 21. Crown — three peaks but irregular heights
  () => make('Crown', blob([
    24,44, 32,30, 40,38, 50,24, 60,38, 68,30, 76,44, 70,54, 60,58, 50,60, 40,58, 30,54,
  ])),

  // 22. Snail Shell — spiral-ish closed shape
  () => make('Shell', blob([
    34,36, 44,28, 58,26, 68,34, 70,46, 62,56, 50,60, 40,56, 34,48, 38,42, 46,44, 52,42, 54,36, 48,32, 42,34, 40,40, 46,52, 56,50, 60,42, 56,34, 48,32,
  ])),

  // 23. Boot — cartoon boot shape
  () => make('Boot', blob([
    34,26, 50,22, 64,26, 70,36, 72,48, 66,56, 58,58, 56,64, 52,72, 44,72, 40,64, 38,56, 36,48, 30,44, 24,38, 26,30,
  ])),

  // 24. Bell — asymmetrical bell shape
  () => make('Bell', blob([
    34,22, 50,14, 66,22, 74,34, 76,48, 72,58, 64,64, 56,62, 56,70, 44,70, 44,62, 36,64, 28,58, 24,48, 26,34,
  ])),
];

export function getShapeCount() { return ALL_SHAPES.length; }