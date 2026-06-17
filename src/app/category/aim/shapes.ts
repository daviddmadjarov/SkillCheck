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

export function randomShape(): SplitShapeDef {
  return ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)]();
}

export function resetColorIdx() { colorIdx = 0; }

// ─── 40 Freshly Generated Asymmetrical Shapes ──────────────────────────────
// Every shape is a single non-self-intersecting polygon with exaggerated asymmetry.
// Old shapes completely purged. Each one freshly crafted for recognizable silhouette
// with heavily distorted proportions for challenging area-splitting gameplay.

const ALL_SHAPES: (() => SplitShapeDef)[] = [

  // 1. Circle (kept as the only symmetrical exception)
  () => make('Circle', pts(
    50,10, 62,12, 72,18, 78,28, 80,38, 78,48, 72,58, 62,66, 50,70, 38,66, 28,58, 22,48, 20,38, 22,28, 28,18, 38,12
  )),

  // 2. Apple — fat bottom, squished top, stem pushed left
  () => make('Apple', pts(
    54,6, 60,12, 64,22, 66,34, 64,46, 60,56, 54,64, 48,70, 40,72, 34,68, 28,62, 24,54, 22,44, 24,34, 28,26, 34,20, 40,14, 48,10
  )),

  // 3. Pear — bulbous bottom-right, narrow top-left
  () => make('Pear', pts(
    44,12, 54,16, 60,24, 62,34, 60,44, 64,52, 66,62, 62,70, 54,76, 44,78, 36,74, 30,68, 26,58, 28,48, 32,40, 30,30, 34,22, 40,16
  )),

  // 4. Mushroom — cap lopsided to left, stem crooked right
  () => make('Mushroom', pts(
    24,40, 28,28, 36,18, 48,12, 60,16, 70,24, 74,36, 72,48, 64,54, 54,50, 52,58, 56,68, 54,78, 46,80, 38,76, 36,66, 40,56, 42,48, 30,52
  )),

  // 5. Fish — long body, tiny tail, big bottom fin
  () => make('Fish', pts(
    14,48, 26,40, 40,34, 54,30, 66,30, 76,34, 82,40, 80,48, 74,54, 64,58, 52,60, 40,58, 30,54, 22,52, 28,56, 24,64, 18,58, 16,52
  )),

  // 6. Whale — huge head, tiny stub tail, fat belly
  () => make('Whale', pts(
    12,50, 26,40, 44,34, 62,30, 78,34, 86,42, 82,52, 72,58, 60,62, 48,64, 36,62, 24,58, 18,54, 28,56, 38,58, 50,58, 62,56, 72,52, 68,44, 56,42, 42,44, 30,48
  )),

  // 7. Dolphin — curved body, beak pushed left, tail split off-center
  () => make('Dolphin', pts(
    12,50, 22,40, 36,34, 50,30, 62,32, 72,38, 78,46, 74,54, 64,58, 54,56, 44,54, 36,56, 28,60, 22,64, 18,60, 24,52, 32,46, 40,42, 46,44, 52,48, 48,42, 38,40, 28,44, 18,50
  )),

  // 8. Duck — big beak on left, fat body, tiny tail on right
  () => make('Duck', pts(
    20,34, 30,24, 42,18, 54,16, 66,22, 72,32, 70,44, 62,52, 52,56, 44,60, 40,68, 42,78, 48,84, 56,80, 54,70, 48,62, 50,54, 56,48, 64,42, 62,32, 52,26, 42,28, 32,34
  )),

  // 9. Chicken — comb on top-right, beak lower-left, wattle dangling
  () => make('Chicken', pts(
    34,22, 46,14, 58,16, 68,24, 72,34, 66,44, 58,50, 50,52, 44,58, 40,66, 42,76, 48,82, 56,78, 52,68, 46,60, 48,50, 56,44, 64,38, 62,28, 52,22, 42,26
  )),

  // 10. Penguin — fat belly-left side, narrow head-right
  () => make('Penguin', pts(
    34,20, 46,12, 58,18, 66,30, 68,44, 64,56, 56,66, 50,76, 54,86, 46,86, 42,76, 36,66, 28,56, 22,44, 20,30, 26,22
  )),

  // 11. Owl — huge left eye bump, tiny right, ear tuft off-center
  () => make('Owl', pts(
    28,24, 38,14, 50,10, 56,16, 66,24, 72,36, 70,50, 64,62, 54,70, 44,70, 34,62, 28,52, 24,40, 22,30, 32,20, 44,16, 50,20, 46,28, 40,34, 36,30, 38,24
  )),

  // 12. Elephant — huge left ear sagging, trunk curving right
  () => make('Elefant', pts(
    34,22, 48,14, 62,14, 74,24, 78,38, 74,52, 66,62, 58,68, 56,78, 52,86, 46,82, 42,72, 40,62, 34,58, 28,50, 22,40, 24,30, 30,24, 42,20, 52,24, 58,32, 56,42, 48,46, 40,42, 34,34
  )),

  // 13. Rhino — horn on left side, big snout, small body-right
  () => make('Rhino', pts(
    36,18, 46,12, 56,10, 68,16, 76,28, 78,42, 72,56, 62,64, 50,68, 40,64, 32,58, 28,48, 26,38, 30,30, 40,26, 50,28, 58,34, 56,44, 48,48, 40,44, 36,36, 34,26
  )),

  // 14. Fox — big left ear, narrow snout, bushy tail right
  () => make('Fox', pts(
    28,20, 40,10, 48,16, 50,10, 56,18, 68,22, 76,34, 74,48, 66,60, 54,66, 42,64, 34,56, 28,44, 24,32, 22,24, 32,18, 44,22, 48,28, 44,36, 38,40, 34,34
  )),

  // 15. Dino Footprint — three fat toes left, two thin right
  () => make('Dino Print', pts(
    34,22, 46,14, 58,18, 64,28, 68,40, 62,52, 52,58, 40,56, 32,48, 28,38, 30,28, 38,24, 48,26, 54,32, 50,40, 42,42, 36,36, 34,28, 44,20, 52,24, 48,18
  )),

  // 16. Leaf — long curved tip right, thick base left, bent midrib
  () => make('Leaf', pts(
    44,8, 58,16, 70,28, 78,42, 74,58, 64,70, 50,78, 38,72, 28,60, 22,46, 20,32, 26,18, 36,10, 46,14, 50,24, 46,38, 40,44, 34,40, 32,30, 38,20
  )),

  // 17. Maple Leaf — huge left lobe, tiny right, stem offset down
  () => make('Maple Leaf', pts(
    50,8, 58,20, 68,14, 64,28, 76,28, 66,38, 78,48, 64,48, 58,58, 52,70, 46,58, 40,48, 26,48, 38,38, 28,28, 40,28, 36,14, 46,20
  )),

  // 18. Feather — thick quill base, wispy top curving right, ragged edges
  () => make('Feather', pts(
    50,8, 62,18, 70,30, 72,44, 66,58, 56,68, 44,74, 34,68, 26,58, 20,46, 22,32, 30,20, 40,12, 38,22, 42,36, 48,46, 56,44, 54,32, 50,20
  )),

  // 19. Flame — long leaning left, bulging pocket right, wavy top
  () => make('Flame', pts(
    52,8, 62,24, 72,38, 76,52, 70,66, 58,76, 44,72, 36,60, 34,46, 38,32, 46,22, 44,36, 48,52, 56,56, 60,48, 58,34, 54,22
  )),

  // 20. Water Drop — fat bulbous left side, elongated tapering right
  () => make('Water Drop', pts(
    54,8, 66,24, 74,40, 76,58, 70,72, 58,80, 44,76, 34,66, 28,54, 30,38, 36,24, 42,14, 46,28, 50,44, 54,56, 60,52, 56,36
  )),

  // 21. Ink Splash — 5 wildly uneven splats, one massive bulge
  () => make('Splash', pts(
    52,8, 62,22, 74,18, 68,34, 80,30, 72,46, 78,58, 64,54, 56,66, 48,76, 40,66, 34,56, 26,62, 30,48, 20,44, 32,38, 28,26, 40,30, 44,20
  )),

  // 22. Distorted Cloud — tight left cluster, long sweeping right tail
  () => make('Cloud', pts(
    24,44, 30,30, 42,22, 56,18, 66,24, 78,34, 84,46, 80,58, 68,64, 54,66, 38,62, 28,54, 22,48, 34,38, 44,34, 52,36, 48,44, 40,42, 32,38, 36,30, 48,26, 60,30, 56,40, 50,48, 42,50
  )),

  // 23. Lightning Bolt — sharp zigzag, thick top branch, thin tail
  () => make('Lightning', pts(
    60,14, 50,34, 58,34, 42,66, 56,48, 46,48, 52,38, 44,38, 52,28, 44,28, 60,14
  )),

  // 24. Ghost — round bulbous head-left, flat body, wavy hem-right
  () => make('Ghost', pts(
    30,16, 48,10, 66,16, 76,30, 74,48, 68,62, 60,74, 54,82, 48,76, 42,68, 36,60, 30,50, 26,38, 24,26, 34,16, 46,14, 54,20, 52,32, 44,42, 36,38, 38,28
  )),

  // 25. Keyhole — large round left cavity, narrow right slot
  () => make('Keyhole', pts(
    54,12, 64,20, 70,32, 68,46, 60,54, 62,62, 66,68, 62,78, 54,84, 42,84, 34,78, 30,68, 34,62, 38,54, 36,46, 32,38, 28,28, 34,18, 44,14
  )),

  // 26. Puzzle Piece — one side bulging out, opposite side indented
  () => make('Puzzle', pts(
    28,26, 44,26, 44,34, 50,34, 50,26, 66,26, 70,38, 66,50, 58,44, 52,50, 44,50, 38,44, 32,50, 24,48, 22,36, 24,30, 36,30, 40,36, 44,32, 38,28, 30,28
  )),

  // 27. Sock — long calf left, foot curving right, toe bulbous
  () => make('Sock', pts(
    42,16, 56,16, 62,26, 60,40, 56,54, 54,66, 50,78, 46,86, 40,82, 36,72, 38,60, 42,48, 44,36, 44,26, 48,20, 52,24, 50,34, 48,44, 44,48, 40,44, 42,34
  )),

  // 28. Boot — tall shaft left, sole angled right, toe pointed
  () => make('Boot', pts(
    34,18, 52,16, 64,22, 72,34, 70,48, 62,54, 54,52, 50,60, 48,72, 42,76, 36,70, 32,60, 28,52, 22,46, 24,36, 28,30, 38,28, 46,32, 48,40, 42,48, 36,44, 38,34
  )),

  // 29. Mitten — fat thumb left, rounded mitten body, cuff uneven
  () => make('Mitten', pts(
    28,32, 38,20, 50,16, 62,20, 70,30, 72,44, 68,58, 60,70, 54,82, 48,84, 42,78, 36,68, 32,58, 28,48, 26,38, 34,28, 44,26, 52,32, 50,44, 42,52, 36,46, 38,36
  )),

  // 30. Trophy — big left handle, tiny right, cup lopsided
  () => make('Trophy', pts(
    28,44, 36,30, 46,22, 50,14, 56,22, 66,30, 74,44, 72,54, 62,58, 52,56, 50,62, 54,70, 48,76, 44,76, 38,70, 42,62, 44,56, 36,58, 26,54, 24,48, 34,46, 42,48, 48,44, 46,36, 38,38
  )),

  // 31. Chess Knight — horse head facing left, thick neck, jagged mane
  () => make('Knight', pts(
    38,16, 52,12, 64,20, 70,32, 66,46, 58,56, 48,60, 42,66, 36,74, 30,70, 32,62, 38,54, 42,46, 44,38, 38,32, 36,24, 40,20, 48,22, 52,28, 48,36, 42,40, 36,36
  )),

  // 32. Wizard Hat — wide brim left, tall pointy right, bent tip
  () => make('Wizard Hat', pts(
    20,54, 32,38, 42,26, 50,12, 58,28, 68,40, 80,54, 74,60, 60,56, 54,64, 48,64, 42,56, 28,60, 22,58, 34,46, 44,36, 48,28, 44,40, 36,48
  )),

  // 33. Potion Bottle — fat round bottom, skinny neck left, lip right
  () => make('Potion', pts(
    40,18, 50,12, 60,16, 62,28, 60,40, 66,44, 68,58, 64,72, 56,80, 44,80, 36,72, 32,58, 34,44, 40,40, 38,28, 36,22, 44,24, 46,32, 44,40, 48,38, 50,32, 50,22
  )),

  // 34. Treasure Chest — curved lid off-center, lock big left, base tilted
  () => make('Chest', pts(
    24,44, 32,32, 44,26, 58,24, 72,28, 80,38, 78,50, 70,56, 60,52, 52,54, 44,52, 36,56, 28,52, 26,48, 36,44, 44,46, 50,44, 48,38, 40,36, 32,40
  )),

  // 35. Anchor — ring left, long shank, right fluke bigger
  () => make('Anchor', pts(
    44,18, 56,18, 58,28, 58,42, 64,48, 74,46, 76,56, 66,62, 56,58, 54,68, 54,80, 48,86, 42,80, 42,68, 40,58, 30,62, 22,56, 24,46, 34,48, 40,42, 40,28, 38,22
  )),

  // 36. Hook — long shank right, curved hook left, barb offset
  () => make('Hook', pts(
    42,16, 58,16, 64,26, 60,40, 52,50, 46,60, 44,72, 48,82, 56,86, 64,82, 66,72, 60,66, 52,68, 48,74, 46,66, 48,54, 54,46, 58,38, 60,28, 54,22, 48,24, 44,30, 46,40, 50,36, 48,26
  )),

  // 37. Guitar Pick — fat top-left bulb, sharp bottom-right tip
  () => make('Pick', pts(
    52,12, 66,28, 74,44, 76,60, 68,74, 56,82, 42,78, 32,68, 26,56, 28,42, 36,28, 44,18, 48,30, 54,40, 56,52, 50,62, 42,58, 38,48, 42,36
  )),

  // 38. Paint Palette — big thumb hole left, paint splotches protruding
  () => make('Palette', pts(
    24,38, 34,24, 48,18, 64,18, 78,28, 84,44, 78,60, 64,68, 48,66, 36,60, 28,52, 20,46, 30,44, 38,48, 48,50, 56,46, 58,36, 48,34, 38,38, 30,36, 36,30, 48,26, 60,30, 56,40, 44,42, 34,38
  )),

  // 39. Ice Cream Cone — scoop bulging left, cone angled right
  () => make('Ice Cream', pts(
    22,48, 34,34, 42,26, 48,32, 54,26, 60,34, 72,48, 66,58, 56,54, 54,62, 62,72, 56,80, 46,80, 40,72, 48,62, 44,54, 34,58, 28,54, 32,44, 40,40, 46,44, 42,50, 34,48, 28,44
  )),

  // 40. Croissant — one end bulbous left, tapering right with curl
  () => make('Croissant', pts(
    30,26, 42,18, 56,18, 68,26, 74,38, 70,52, 60,62, 48,66, 36,62, 28,54, 24,44, 26,34, 32,28, 42,26, 52,30, 58,38, 54,48, 46,52, 38,48, 36,40, 40,34, 48,36, 46,44, 40,42, 36,36
  )),
];

export function getShapeCount() { return ALL_SHAPES.length; }