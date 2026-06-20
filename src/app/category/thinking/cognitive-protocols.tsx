'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { useDuelCountdown } from '@/components/use-duel-countdown';
import { playSliderMove, playCorrectChime, playWrongBuzz } from '@/lib/audio/sounds';
import { emitTelemetryAssessment } from '@/lib/lore/telemetry';

export type CognitiveMode = 'rotation' | 'estimation' | 'sequence';

export type CognitiveProtocolsProps = {
  isSignedIn: boolean;
  mode: CognitiveMode;
};

type Stat = { detail: string; label: string; value: string };

const MODE_META = {
  rotation: {
    accent: 'border-cyan-300 bg-cyan-100 text-cyan-800',
    description: 'A shape is shown as reference. Pick the option that is the same shape rotated to a different angle. Distractors are subtle shape variants from the same family.',
    kicker: 'Spatial Reasoning',
    title: 'Mental Rotation',
  },
  estimation: {
    accent: 'border-amber-300 bg-amber-100 text-amber-800',
    description: 'Each round randomises the task: estimate a line length, a fill percentage, an angle, or count a disappearing set of dots.',
    kicker: 'Perceptual Precision',
    title: 'Estimation Challenge',
  },
  sequence: {
    accent: 'border-emerald-300 bg-emerald-100 text-emerald-800',
    description: 'Watch the 3×3 grid light up in sequence, then tap the tiles back in the same order. One extra step is added each successful round.',
    kicker: 'Working Memory',
    title: 'Sequence Memory',
  },
} as const;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function CognitiveShell({
  accent, children, description, isSignedIn, kicker, stats, title,
}: {
  accent: string; children: React.ReactNode; description: string;
  isSignedIn: boolean; kicker: string; stats: Stat[]; title: string;
}) {
  return (
    <section className="lab-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Cognitive Category</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">{title}</h2>
          <p className={`mt-3 inline-flex rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${accent}`}>{kicker}</p>
        </div>
        <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
          {isSignedIn ? 'Leaderboard sync optional' : 'Guest mode'}
        </div>
      </div>
      <p className="mb-4 max-w-2xl text-sm font-medium leading-6 text-slate-500">{description}</p>
      {children}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{s.label}</p>
            <p className="mt-2 text-3xl font-black text-slate-800">{s.value}</p>
            <p className="mt-1 text-sm font-medium text-slate-500">{s.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENTAL ROTATION
// ═══════════════════════════════════════════════════════════════════════════════

type ShapeVariant = { label: string; pts: [number, number][] };
type ShapeFamily = { family: string; variants: ShapeVariant[] };

const ROT_SHAPE_FAMILIES: ShapeFamily[] = [
  {
    family: 'Arrow',
    variants: [
      { label: 'ArrowBase', pts: [[0, -25], [12, -5], [6, -5], [6, 25], [-6, 25], [-6, -5], [-12, -5]] },
      { label: 'ArrowNarrow', pts: [[0, -27], [9, -7], [4, -7], [4, 25], [-4, 25], [-4, -7], [-9, -7]] },
      { label: 'ArrowWide', pts: [[0, -22], [17, -3], [9, -3], [9, 24], [-9, 24], [-9, -3], [-17, -3]] },
      { label: 'ArrowOffset', pts: [[1, -25], [13, -7], [8, -1], [8, 25], [-5, 24], [-5, -5], [-10, -7]] },
    ],
  },
  {
    family: 'Chevron',
    variants: [
      { label: 'ChevronBase', pts: [[0, -25], [24, -2], [15, 6], [0, -10], [-15, 6], [-24, -2]] },
      { label: 'ChevronNarrow', pts: [[0, -26], [20, -5], [13, 2], [0, -13], [-13, 2], [-20, -5]] },
      { label: 'ChevronWide', pts: [[0, -22], [27, 0], [17, 10], [0, -6], [-17, 10], [-27, 0]] },
      { label: 'ChevronSkew', pts: [[2, -25], [26, -4], [16, 4], [2, -8], [-11, 8], [-22, 0]] },
    ],
  },
  {
    family: 'Diamond',
    variants: [
      { label: 'DiamondBase', pts: [[0, -26], [20, 0], [0, 26], [-20, 0]] },
      { label: 'DiamondTall', pts: [[0, -30], [17, 0], [0, 30], [-17, 0]] },
      { label: 'DiamondWide', pts: [[0, -22], [25, 0], [0, 22], [-25, 0]] },
      { label: 'DiamondOffset', pts: [[3, -26], [22, 2], [1, 27], [-18, -2]] },
    ],
  },
  {
    family: 'Bolt',
    variants: [
      { label: 'BoltBase', pts: [[5, -25], [-10, -2], [4, -2], [-6, 25], [10, 2], [-3, 2]] },
      { label: 'BoltSteep', pts: [[7, -27], [-8, -4], [2, -4], [-8, 27], [13, 5], [-1, 5]] },
      { label: 'BoltFlat', pts: [[4, -22], [-13, -1], [3, -1], [-9, 22], [8, 1], [-6, 1]] },
      { label: 'BoltShifted', pts: [[8, -25], [-7, -6], [6, -6], [-4, 24], [12, 4], [0, 4]] },
    ],
  },
  {
    family: 'Crescent',
    variants: [
      { label: 'CrescentBase', pts: [[18, -24], [-2, -24], [-20, -10], [-20, 10], [-2, 24], [18, 24], [14, 14], [-3, 14], [-3, -14], [14, -14]] },
      { label: 'CrescentThin', pts: [[20, -24], [2, -24], [-16, -10], [-16, 10], [2, 24], [20, 24], [14, 16], [2, 16], [2, -16], [14, -16]] },
      { label: 'CrescentThick', pts: [[21, -25], [-7, -25], [-22, -8], [-22, 8], [-7, 25], [21, 25], [11, 11], [-7, 11], [-7, -11], [11, -11]] },
      { label: 'CrescentSkew', pts: [[21, -22], [0, -25], [-18, -8], [-17, 12], [2, 24], [21, 22], [15, 12], [0, 15], [1, -12], [15, -15]] },
    ],
  },
  {
    family: 'Trident',
    variants: [
      { label: 'TridentBase', pts: [[-17, -25], [-10, -25], [-10, -7], [-4, -7], [-4, -25], [4, -25], [4, -7], [10, -7], [10, -25], [17, -25], [17, 0], [5, 0], [5, 25], [-5, 25], [-5, 0], [-17, 0]] },
      { label: 'TridentThin', pts: [[-16, -25], [-12, -25], [-12, -9], [-6, -9], [-6, -25], [6, -25], [6, -9], [12, -9], [12, -25], [16, -25], [16, 0], [3, 0], [3, 25], [-3, 25], [-3, 0], [-16, 0]] },
      { label: 'TridentWide', pts: [[-20, -24], [-9, -24], [-9, -6], [-2, -6], [-2, -24], [2, -24], [2, -6], [9, -6], [9, -24], [20, -24], [20, 2], [7, 2], [7, 25], [-7, 25], [-7, 2], [-20, 2]] },
      { label: 'TridentOffset', pts: [[-15, -25], [-8, -25], [-8, -6], [-2, -6], [-2, -25], [6, -25], [6, -9], [12, -9], [12, -25], [19, -25], [19, 0], [7, 0], [7, 25], [-3, 25], [-3, 0], [-15, 0]] },
    ],
  },
  {
    family: 'Hourglass',
    variants: [
      { label: 'HourglassBase', pts: [[-20, -24], [20, -24], [6, -1], [20, 24], [-20, 24], [-6, -1]] },
      { label: 'HourglassNarrow', pts: [[-17, -26], [17, -26], [3, -1], [17, 26], [-17, 26], [-3, -1]] },
      { label: 'HourglassWide', pts: [[-24, -22], [24, -22], [9, -1], [24, 22], [-24, 22], [-9, -1]] },
      { label: 'HourglassSkew', pts: [[-22, -24], [17, -24], [4, -2], [22, 24], [-17, 24], [-8, 1]] },
    ],
  },
  {
    family: 'Pinwheel',
    variants: [
      { label: 'PinwheelBase', pts: [[0, -26], [9, -9], [26, 0], [9, 9], [0, 26], [-9, 9], [-26, 0], [-9, -9]] },
      { label: 'PinwheelTight', pts: [[0, -23], [7, -8], [23, 0], [7, 8], [0, 23], [-7, 8], [-23, 0], [-7, -8]] },
      { label: 'PinwheelLong', pts: [[0, -29], [11, -10], [29, 0], [11, 10], [0, 29], [-11, 10], [-29, 0], [-11, -10]] },
      { label: 'PinwheelSkew', pts: [[2, -27], [11, -9], [28, 2], [7, 11], [-2, 25], [-11, 7], [-26, -2], [-7, -11]] },
    ],
  },
  {
    family: 'Crown',
    variants: [
      { label: 'CrownBase', pts: [[-24, 22], [24, 22], [20, -6], [9, 5], [0, -24], [-9, 5], [-20, -6]] },
      { label: 'CrownTall', pts: [[-23, 22], [23, 22], [18, -8], [7, 2], [0, -28], [-7, 2], [-18, -8]] },
      { label: 'CrownWide', pts: [[-27, 21], [27, 21], [23, -6], [11, 7], [0, -22], [-11, 7], [-23, -6]] },
      { label: 'CrownOffset', pts: [[-24, 22], [24, 22], [22, -4], [10, 4], [2, -25], [-6, 3], [-18, -8]] },
    ],
  },
  {
    family: 'Kite',
    variants: [
      { label: 'KiteBase', pts: [[0, -26], [18, 0], [0, 26], [-18, 0]] },
      { label: 'KiteLongTop', pts: [[0, -30], [16, 0], [0, 22], [-16, 0]] },
      { label: 'KiteWide', pts: [[0, -23], [23, 0], [0, 23], [-23, 0]] },
      { label: 'KiteSkew', pts: [[3, -26], [20, 2], [0, 25], [-16, -2]] },
    ],
  },
  {
    family: 'Anchor',
    variants: [
      { label: 'AnchorBase', pts: [[-20, 15], [-12, 24], [-2, 16], [-2, -18], [2, -18], [2, 16], [12, 24], [20, 15], [12, 6], [5, 10], [5, -18], [12, -18], [12, -24], [-12, -24], [-12, -18], [-5, -18], [-5, 10], [-12, 6]] },
      { label: 'AnchorThin', pts: [[-19, 14], [-11, 24], [-1, 17], [-1, -19], [1, -19], [1, 17], [11, 24], [19, 14], [11, 7], [4, 11], [4, -19], [11, -19], [11, -24], [-11, -24], [-11, -19], [-4, -19], [-4, 11], [-11, 7]] },
      { label: 'AnchorWide', pts: [[-22, 16], [-13, 25], [-3, 15], [-3, -17], [3, -17], [3, 15], [13, 25], [22, 16], [13, 5], [6, 9], [6, -17], [13, -17], [13, -23], [-13, -23], [-13, -17], [-6, -17], [-6, 9], [-13, 5]] },
      { label: 'AnchorOffset', pts: [[-19, 16], [-11, 24], [-1, 15], [-1, -18], [3, -18], [3, 17], [13, 24], [21, 14], [13, 5], [6, 9], [6, -18], [13, -18], [13, -24], [-11, -24], [-11, -18], [-4, -18], [-4, 10], [-11, 7]] },
    ],
  },
  {
    family: 'Orbit',
    variants: [
      { label: 'OrbitBase', pts: [[0, -28], [8, -8], [28, 0], [8, 8], [0, 28], [-8, 8], [-28, 0], [-8, -8], [0, -18], [5, -5], [18, 0], [5, 5], [0, 18], [-5, 5], [-18, 0], [-5, -5]] },
      { label: 'OrbitThin', pts: [[0, -27], [7, -9], [27, 0], [7, 9], [0, 27], [-7, 9], [-27, 0], [-7, -9], [0, -19], [4, -6], [16, 0], [4, 6], [0, 19], [-4, 6], [-16, 0], [-4, -6]] },
      { label: 'OrbitWide', pts: [[0, -29], [10, -7], [29, 0], [10, 7], [0, 29], [-10, 7], [-29, 0], [-10, -7], [0, -17], [6, -4], [20, 0], [6, 4], [0, 17], [-6, 4], [-20, 0], [-6, -4]] },
      { label: 'OrbitSkew', pts: [[2, -28], [10, -8], [28, 2], [7, 10], [-2, 27], [-9, 7], [-27, -2], [-7, -10], [1, -18], [6, -5], [18, 1], [5, 6], [-1, 17], [-6, 5], [-17, -1], [-5, -6]] },
    ],
  },
  {
    family: 'Shield',
    variants: [
      { label: 'ShieldBase', pts: [[0, -26], [20, -18], [20, 5], [0, 26], [-20, 5], [-20, -18]] },
      { label: 'ShieldTall', pts: [[0, -28], [19, -19], [19, 4], [0, 28], [-19, 4], [-19, -19]] },
      { label: 'ShieldWide', pts: [[0, -25], [22, -16], [22, 6], [0, 24], [-22, 6], [-22, -16]] },
      { label: 'ShieldOffset', pts: [[2, -26], [21, -17], [20, 6], [1, 26], [-19, 4], [-18, -19]] },
    ],
  },
  {
    family: 'Prism',
    variants: [
      { label: 'PrismBase', pts: [[-22, 8], [-8, -20], [16, -20], [22, 8], [8, 20], [-16, 20]] },
      { label: 'PrismTall', pts: [[-20, 7], [-7, -23], [14, -23], [20, 7], [7, 23], [-14, 23]] },
      { label: 'PrismWide', pts: [[-24, 9], [-10, -19], [18, -19], [24, 9], [10, 19], [-18, 19]] },
      { label: 'PrismSkew', pts: [[-21, 9], [-6, -21], [17, -19], [23, 10], [7, 20], [-17, 18]] },
    ],
  },
  {
    family: 'Anvil',
    variants: [
      { label: 'AnvilBase', pts: [[-26, 6], [-8, 6], [-2, -12], [18, -12], [26, -2], [12, -2], [8, 6], [26, 6], [26, 16], [-26, 16]] },
      { label: 'AnvilThin', pts: [[-25, 7], [-9, 7], [-3, -11], [17, -11], [24, -3], [11, -3], [7, 7], [24, 7], [24, 16], [-25, 16]] },
      { label: 'AnvilWide', pts: [[-28, 5], [-7, 5], [-1, -13], [19, -13], [27, -1], [13, -1], [9, 5], [27, 5], [27, 16], [-28, 16]] },
      { label: 'AnvilOffset', pts: [[-25, 6], [-7, 6], [-1, -12], [19, -12], [26, -2], [13, -2], [9, 6], [25, 7], [25, 16], [-26, 16]] },
    ],
  },
  {
    family: 'Compass',
    variants: [
      { label: 'CompassBase', pts: [[0, -28], [8, -8], [28, 0], [8, 8], [0, 28], [-8, 8], [-28, 0], [-8, -8]] },
      { label: 'CompassNarrow', pts: [[0, -29], [7, -9], [25, 0], [7, 9], [0, 29], [-7, 9], [-25, 0], [-7, -9]] },
      { label: 'CompassWide', pts: [[0, -26], [10, -7], [30, 0], [10, 7], [0, 26], [-10, 7], [-30, 0], [-10, -7]] },
      { label: 'CompassSkew', pts: [[2, -28], [10, -8], [28, 2], [7, 10], [-2, 26], [-9, 8], [-27, -1], [-7, -10]] },
    ],
  },
  {
    family: 'Spearhead',
    variants: [
      { label: 'SpearheadBase', pts: [[0, -30], [16, -6], [9, 0], [16, 6], [0, 30], [-16, 6], [-9, 0], [-16, -6]] },
      { label: 'SpearheadThin', pts: [[0, -30], [14, -7], [7, 0], [14, 7], [0, 30], [-14, 7], [-7, 0], [-14, -7]] },
      { label: 'SpearheadWide', pts: [[0, -28], [18, -5], [11, 0], [18, 5], [0, 28], [-18, 5], [-11, 0], [-18, -5]] },
      { label: 'SpearheadOffset', pts: [[2, -30], [17, -6], [10, 1], [17, 7], [1, 30], [-14, 6], [-7, -1], [-14, -7]] },
    ],
  },
  {
    family: 'Beacon',
    variants: [
      { label: 'BeaconBase', pts: [[-12, 24], [12, 24], [8, -6], [18, -6], [0, -28], [-18, -6], [-8, -6]] },
      { label: 'BeaconTall', pts: [[-11, 24], [11, 24], [7, -8], [17, -8], [0, -30], [-17, -8], [-7, -8]] },
      { label: 'BeaconWide', pts: [[-14, 23], [14, 23], [9, -5], [20, -5], [0, -27], [-20, -5], [-9, -5]] },
      { label: 'BeaconOffset', pts: [[-11, 24], [13, 24], [9, -6], [19, -5], [2, -28], [-16, -7], [-7, -6]] },
    ],
  },
  {
    family: 'Clamp',
    variants: [
      { label: 'ClampBase', pts: [[-24, -20], [-4, -20], [-4, -10], [14, -10], [14, -20], [24, -20], [24, 20], [14, 20], [14, 10], [-4, 10], [-4, 20], [-24, 20]] },
      { label: 'ClampThin', pts: [[-24, -19], [-6, -19], [-6, -11], [12, -11], [12, -19], [22, -19], [22, 19], [12, 19], [12, 11], [-6, 11], [-6, 19], [-24, 19]] },
      { label: 'ClampWide', pts: [[-26, -21], [-3, -21], [-3, -9], [16, -9], [16, -21], [25, -21], [25, 21], [16, 21], [16, 9], [-3, 9], [-3, 21], [-26, 21]] },
      { label: 'ClampOffset', pts: [[-24, -20], [-5, -20], [-5, -10], [15, -10], [15, -21], [24, -20], [24, 20], [15, 20], [15, 9], [-5, 11], [-5, 20], [-24, 20]] },
    ],
  },
  {
    family: 'Totem',
    variants: [
      { label: 'TotemBase', pts: [[-10, -28], [10, -28], [10, -16], [18, -8], [10, 0], [10, 12], [18, 20], [10, 28], [-10, 28], [-10, 20], [-18, 12], [-10, 4], [-10, -8], [-18, -16], [-10, -24]] },
      { label: 'TotemThin', pts: [[-8, -28], [8, -28], [8, -17], [16, -8], [8, 0], [8, 12], [16, 20], [8, 28], [-8, 28], [-8, 20], [-16, 12], [-8, 4], [-8, -8], [-16, -16], [-8, -24]] },
      { label: 'TotemWide', pts: [[-12, -27], [12, -27], [12, -15], [20, -7], [12, 1], [12, 13], [20, 21], [12, 27], [-12, 27], [-12, 19], [-20, 11], [-12, 3], [-12, -9], [-20, -17], [-12, -23]] },
      { label: 'TotemOffset', pts: [[-10, -28], [10, -28], [10, -16], [19, -7], [11, 1], [11, 12], [18, 20], [9, 28], [-11, 28], [-11, 20], [-17, 11], [-9, 3], [-9, -8], [-18, -17], [-10, -24]] },
    ],
  },
  {
    family: 'Fan',
    variants: [
      { label: 'FanBase', pts: [[-24, 20], [24, 20], [16, 6], [8, -2], [0, -8], [-8, -2], [-16, 6]] },
      { label: 'FanTight', pts: [[-22, 21], [22, 21], [15, 7], [7, -1], [0, -7], [-7, -1], [-15, 7]] },
      { label: 'FanWide', pts: [[-26, 19], [26, 19], [17, 5], [9, -3], [0, -10], [-9, -3], [-17, 5]] },
      { label: 'FanOffset', pts: [[-24, 20], [24, 20], [17, 6], [9, -1], [1, -8], [-6, -1], [-14, 7]] },
    ],
  },
  {
    family: 'Helix',
    variants: [
      { label: 'HelixBase', pts: [[-22, -20], [-8, -20], [2, -10], [14, -10], [22, -2], [10, -2], [0, 8], [-12, 8], [-22, 18], [-8, 18], [2, 8], [14, 8], [22, 0], [10, 0], [0, -10], [-12, -10]] },
      { label: 'HelixThin', pts: [[-22, -19], [-10, -19], [0, -11], [12, -11], [20, -3], [9, -3], [-1, 7], [-13, 7], [-22, 17], [-10, 17], [0, 9], [12, 9], [20, 1], [9, 1], [-1, -9], [-13, -9]] },
      { label: 'HelixWide', pts: [[-24, -20], [-7, -20], [3, -9], [16, -9], [24, -1], [11, -1], [1, 9], [-13, 9], [-24, 19], [-7, 19], [3, 7], [16, 7], [24, -1], [11, -1], [1, -11], [-13, -11]] },
      { label: 'HelixSkew', pts: [[-21, -20], [-8, -20], [3, -10], [15, -10], [22, -2], [11, -2], [1, 8], [-11, 8], [-21, 18], [-9, 18], [3, 8], [15, 8], [22, 0], [11, 0], [1, -10], [-11, -10]] },
    ],
  },
  {
    family: 'Chisel',
    variants: [
      { label: 'ChiselBase', pts: [[-24, 10], [-4, -22], [10, -22], [24, 0], [4, 22], [-10, 22]] },
      { label: 'ChiselThin', pts: [[-23, 9], [-5, -23], [9, -23], [22, 0], [5, 23], [-9, 23]] },
      { label: 'ChiselWide', pts: [[-25, 11], [-3, -21], [12, -21], [25, 1], [3, 21], [-12, 21]] },
      { label: 'ChiselSkew', pts: [[-23, 10], [-3, -22], [11, -21], [24, 2], [5, 22], [-9, 21]] },
    ],
  },
  {
    family: 'Rune',
    variants: [
      { label: 'RuneBase', pts: [[-22, -24], [-10, -24], [-2, -10], [10, -24], [22, -24], [8, 0], [22, 24], [10, 24], [-2, 10], [-10, 24], [-22, 24], [-8, 0]] },
      { label: 'RuneThin', pts: [[-21, -24], [-11, -24], [-3, -11], [9, -24], [21, -24], [7, 0], [21, 24], [9, 24], [-3, 11], [-11, 24], [-21, 24], [-7, 0]] },
      { label: 'RuneWide', pts: [[-23, -23], [-9, -23], [-1, -9], [11, -23], [23, -23], [9, 0], [23, 23], [11, 23], [-1, 9], [-9, 23], [-23, 23], [-9, 0]] },
      { label: 'RuneOffset', pts: [[-22, -24], [-10, -24], [-1, -11], [11, -23], [22, -24], [8, 1], [21, 24], [9, 24], [-3, 10], [-11, 24], [-22, 23], [-8, -1]] },
    ],
  },
  {
    family: 'Petal',
    variants: [
      { label: 'PetalBase', pts: [[0, -28], [11, -12], [22, 0], [11, 12], [0, 28], [-11, 12], [-22, 0], [-11, -12]] },
      { label: 'PetalNarrow', pts: [[0, -29], [9, -12], [19, 0], [9, 12], [0, 29], [-9, 12], [-19, 0], [-9, -12]] },
      { label: 'PetalWide', pts: [[0, -26], [13, -11], [24, 0], [13, 11], [0, 26], [-13, 11], [-24, 0], [-13, -11]] },
      { label: 'PetalOffset', pts: [[2, -28], [13, -12], [23, 1], [10, 13], [-1, 27], [-12, 11], [-22, -1], [-9, -13]] },
    ],
  },
];

const ROT_ANGLES = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

function rotPts(pts: [number, number][], deg: number): [number, number][] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

function ptsStr(pts: [number, number][]) {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function ShapeSvg({
  pts, deg, fill = '#e0e7ff', stroke = '#6366f1',
}: { pts: [number, number][]; deg: number; fill?: string; stroke?: string }) {
  return (
    <svg viewBox="-32 -32 64 64" className="h-full w-full">
      <polygon fill={fill} points={ptsStr(rotPts(pts, deg))} stroke={stroke} strokeLinejoin="round" strokeWidth="2.2" />
    </svg>
  );
}

type RotRound = {
  familyIdx: number;
  refVariantIdx: number;
  options: { correct: boolean; deg: number; variantIdx: number }[];
};

function makeRotRound(lastFamilyIdx: number): RotRound {
  const pool = ROT_SHAPE_FAMILIES.map((_, i) => i).filter(i => i !== lastFamilyIdx);
  const familyIdx = pool[Math.floor(Math.random() * pool.length)];
  const refVariantIdx = Math.floor(Math.random() * 4);
  const correctDeg = ROT_ANGLES[Math.floor(Math.random() * ROT_ANGLES.length)];
  const others = [0, 1, 2, 3].filter(i => i !== refVariantIdx);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const options: RotRound['options'] = [
    { variantIdx: refVariantIdx, deg: correctDeg, correct: true },
    ...others.map(idx => ({
      variantIdx: idx,
      deg: ROT_ANGLES[Math.floor(Math.random() * ROT_ANGLES.length)],
      correct: false,
    })),
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { familyIdx, refVariantIdx, options };
}

function MentalRotation({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('mental-rotation');
  const ROUNDS = 4;
  const cd = useDuelCountdown(isMultiplayerSession);
  const hasAutoStarted = useRef(false);
  const rotationAudioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!cd.launched || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    startRun();
  }, [cd.launched]); // eslint-disable-line

  const [phase, setPhase] = useState<'idle' | 'playing' | 'reveal' | 'finished'>('idle');
  const [roundIdx, setRoundIdx] = useState(0);
  const [round, setRound] = useState<RotRound | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [lastOk, setLastOk] = useState<boolean | null>(null);
  const lastFamilyIdx = useRef(-1);
  const hasSavedRunRef = useRef(false);

  const labScore = phase === 'finished' ? Math.round((correctCount / ROUNDS) * 1000) : null;

  useEffect(() => {
    if (!isSignedIn || phase !== 'finished' || labScore === null || hasSavedRunRef.current) {
      return;
    }

    hasSavedRunRef.current = true;

    void fetch('/api/scores/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testSlug: 'mental-rotation', score: labScore, ...multiplayerMeta }),
    }).then(() => {
      emitTelemetryAssessment('mental-rotation', labScore as number);
      if (isMultiplayerSession) goToIntermission();
    });
  }, [isSignedIn, labScore, phase, multiplayerMeta, goToIntermission, isMultiplayerSession]);

  function nextRound(idx: number) {
    const r = makeRotRound(lastFamilyIdx.current);
    lastFamilyIdx.current = r.familyIdx;
    setRound(r);
    setSelected(null);
    setLastOk(null);
    setRoundIdx(idx);
    setPhase('playing');
  }

  function startRun() {
    setCorrectCount(0);
    setLastOk(null);
    hasSavedRunRef.current = false;
    lastFamilyIdx.current = -1;
    nextRound(0);
  }

  function pick(i: number) {
    if (phase !== 'playing' || !round) return;
    setSelected(i);
    const ok = round.options[i].correct;
    setLastOk(ok);
    if (ok) setCorrectCount(c => c + 1);
    setPhase('reveal');
    if (ok) {
      playCorrectChime();
    } else {
      playWrongBuzz();
    }
  }

  function advance() {
    if (roundIdx + 1 >= ROUNDS) { setPhase('finished'); return; }
    nextRound(roundIdx + 1);
  }

  return (
    <CognitiveShell
      accent={MODE_META.rotation.accent}
      description={MODE_META.rotation.description}
      isSignedIn={isSignedIn}
      kicker={MODE_META.rotation.kicker}
      stats={[
        { label: 'Round', value: phase === 'idle' ? '--' : `${Math.min(roundIdx + 1, ROUNDS)} / ${ROUNDS}`, detail: `${ROUNDS} shapes per run.` },
        { label: 'Correct', value: `${correctCount}`, detail: 'Correct shapes identified so far.' },
        { label: 'Last', value: lastOk === null ? '--' : lastOk ? '✓ Correct' : '✗ Wrong', detail: 'Your previous round result.' },
        { label: 'Lab score', value: labScore === null ? '--' : String(labScore), detail: 'Accuracy across all 10 rounds scaled to 1000.' },
      ]}
      title={MODE_META.rotation.title}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
            {phase === 'playing' ? 'Select the matching rotation' : phase === 'reveal' ? `Round ${roundIdx + 1} result` : phase === 'finished' ? 'Run complete' : 'Press start'}
          </div>
        </div>

        <div className="relative min-h-[26rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-5 sm:min-h-[30rem]">
          {(phase === 'playing' || phase === 'reveal') && round && (
            <div className="flex h-full flex-col gap-5">
              <div className="flex flex-wrap items-center gap-4">
                <p className="shrink-0 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Reference</p>
                <div className="h-20 w-20 shrink-0 rounded-2xl border-2 border-cyan-200 bg-white p-2 shadow-sm">
                  <ShapeSvg deg={0} pts={ROT_SHAPE_FAMILIES[round.familyIdx].variants[round.refVariantIdx].pts} />
                </div>
                <p className="text-xs font-medium leading-5 text-slate-500">Which option is this exact shape rotated? The three distractors are subtle variants.</p>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {round.options.map((opt, i) => {
                  let cls = 'border-slate-200 bg-white';
                  let fillColor = '#e0e7ff';
                  let strokeColor = '#6366f1';
                  if (phase === 'reveal') {
                    if (opt.correct) { cls = 'border-emerald-400 bg-emerald-50'; fillColor = '#d1fae5'; strokeColor = '#059669'; }
                    else if (i === selected) { cls = 'border-rose-400 bg-rose-50'; fillColor = '#fee2e2'; strokeColor = '#ef4444'; }
                    else { cls = 'border-slate-100 bg-white opacity-40'; }
                  }
                  return (
                    <button
                      className={`aspect-square rounded-2xl border-2 p-3 transition-all duration-150 ${cls} ${phase === 'playing' ? 'cursor-pointer hover:border-cyan-300 hover:bg-cyan-50' : 'cursor-default'}`}
                      disabled={phase !== 'playing'}
                      key={i}
                      onClick={() => pick(i)}
                      type="button"
                    >
                      <ShapeSvg deg={opt.deg} fill={fillColor} pts={ROT_SHAPE_FAMILIES[round.familyIdx].variants[opt.variantIdx].pts} stroke={strokeColor} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === 'idle' && isMultiplayerSession && cd.active && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]">
              <div className="text-center">{cd.phase === 'go' ? <p className="text-7xl font-black text-emerald-600">GO</p> : <p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div>
            </div>
          )}
          {phase === 'idle' && !isMultiplayerSession && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Mental Rotation</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">Identify the correctly rotated shape among 4 options. 10 rounds.</p>
                <button data-start-game className="lab-button mt-4" onClick={startRun} type="button">Start</button>
              </div>
            </div>
          )}

          {phase === 'reveal' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Round {roundIdx + 1}</p>
                <p className={`mt-3 text-3xl font-black ${lastOk ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {lastOk ? 'Correct!' : 'Wrong'}
                </p>
                <button className="lab-button mt-4" onClick={advance} type="button">
                  {roundIdx + 1 >= ROUNDS ? 'See Score' : 'Next Shape'}
                </button>
              </div>
            </div>
          )}

          {phase === 'finished' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p>
                <p className="mt-3 text-4xl font-black text-slate-800">{labScore}</p>
                <p className="mt-1 text-sm text-slate-500">{correctCount} / {ROUNDS} correct</p>
                <button className="lab-button mt-4" onClick={startRun} type="button">Start New Run</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </CognitiveShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTIMATION CHALLENGE
// ═══════════════════════════════════════════════════════════════════════════════

type EstTask =
  | { type: 'line'; actualCm: number; targetPx: number }
  | { type: 'percent'; actual: number }
  | { type: 'angle'; actual: number }
  | { type: 'dots'; actual: number; dots: { color: string; r: number; x: number; y: number }[] }
  | { type: 'fireflies'; actual: number; flies: { x: number; y: number; vx: number; vy: number; r: number; speed: number; delay: number }[] }
  ;

const DOT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#e2e8f0'];

function makeEstTask(): EstTask {
  const kind = (['line', 'percent', 'angle', 'dots', 'fireflies'] as const)[Math.floor(Math.random() * 5)];
  
  if (kind === 'line') {
    const actualCm = Math.round((1.5 + Math.random() * 21.5) * 10) / 10;
    return { type: 'line', actualCm, targetPx: Math.round((actualCm / 5) * 60) };
  }
  if (kind === 'percent') return { type: 'percent', actual: Math.floor(Math.random() * 90) + 5 };
  if (kind === 'angle') return { type: 'angle', actual: Math.floor(Math.random() * 160) + 10 };
  if (kind === 'dots') {
    const actual = Math.floor(Math.random() * 40) + 10;
    return {
      type: 'dots',
      actual,
      dots: Array.from({ length: actual }, () => ({
        x: 5 + Math.random() * 90,
        y: 5 + Math.random() * 90,
        r: 1.5 + Math.random() * 3.5,
        color: DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)],
      })),
    };
  }
  if (kind === 'fireflies') {
    const actual = Math.floor(Math.random() * 30) + 16;
    return {
      type: 'fireflies',
      actual,
      flies: Array.from({ length: actual }, () => ({
        x: 8 + Math.random() * 84,
        y: 10 + Math.random() * 82,
        vx: (Math.random() - 0.5) * 2.4,
        vy: (Math.random() - 0.5) * 2.4,
        r: 1 + Math.random() * 1.6,
        speed: 0.42 + Math.random() * 0.48,
        delay: Math.random() * 1.2,
      })),
    };
  }
  const actual = Math.floor(Math.random() * 40) + 10;
  return {
    type: 'dots',
    actual,
    dots: Array.from({ length: actual }, () => ({
      x: 5 + Math.random() * 90,
      y: 5 + Math.random() * 90,
      r: 1.5 + Math.random() * 3.5,
      color: DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)],
    })),
  };
}

function estSlider(t: EstTask) {
  if (t.type === 'line') return { min: 1, max: 30, step: 0.1, init: 15, unit: ' cm' };
  if (t.type === 'percent') return { min: 0, max: 100, step: 1, init: 50, unit: '%' };
  if (t.type === 'angle') return { min: 0, max: 180, step: 1, init: 90, unit: '°' };
  return { min: 0, max: 100, step: 1, init: 50, unit: '' };
}

function estActualStr(t: EstTask) {
  if (t.type === 'line') return `${t.actualCm} cm`;
  if (t.type === 'percent') return `${t.actual}%`;
  if (t.type === 'angle') return `${t.actual}°`;
  return String(t.actual);
}

function estRoundScore(t: EstTask, guess: number): number {
  if (t.type === 'line') return clamp(Math.round(250 - (Math.abs(guess - t.actualCm) / t.actualCm) * 375), 0, 250);
  if (t.type === 'percent') return clamp(Math.round(250 - Math.abs(guess - t.actual) * 5), 0, 250);
  if (t.type === 'angle') return clamp(Math.round(250 - Math.abs(guess - t.actual) * 3), 0, 250);
  if (t.type === 'fireflies' || t.type === 'dots') {
    return clamp(Math.round(250 - (Math.abs(guess - t.actual) / t.actual) * 450), 0, 250);
  }
  return clamp(Math.round(250 - (Math.abs(guess - (t as any).actual) / (t as any).actual) * 375), 0, 250);
}

function estLabel(t: EstTask) {
  if (t.type === 'line') return 'Line Length';
  if (t.type === 'percent') return 'Fill %';
  if (t.type === 'angle') return 'Angle';
  if (t.type === 'fireflies') return 'Fireflies';
  return 'Dot Count';
}

function EstVisual({ dotsHidden, task }: { dotsHidden: boolean; task: EstTask }) {
  if (task.type === 'fireflies') {
    return (
      <div className="relative" style={{ width: 270, height: 210 }}>
        <p className="absolute left-1/2 top-0 z-20 -translate-x-1/2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Fireflies in a jar</p>

        <div
          className="absolute left-1/2 top-5 z-10 -translate-x-1/2 rounded-full border-2 border-amber-700 bg-amber-300"
          style={{ width: 140, height: 26, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }}
        />
        <div
          className="absolute left-1/2 top-[28px] z-10 -translate-x-1/2 rounded-full border-2 border-amber-700 bg-amber-200"
          style={{ width: 152, height: 10 }}
        />

        <div
          className="absolute left-1/2 top-8 -translate-x-1/2 overflow-hidden border-2 border-slate-500 bg-cyan-100/80"
          style={{
            width: 168,
            height: 170,
            borderRadius: '34% 34% 20% 20% / 16% 16% 24% 24%',
            boxShadow: 'inset 0 -20px 40px rgba(125, 211, 252, 0.2), inset 0 6px 10px rgba(255,255,255,0.45)',
          }}
        >
          <div
            className="pointer-events-none absolute left-3 top-7 h-20 w-8 rounded-full bg-white/30"
            style={{ filter: 'blur(0.5px)' }}
          />

          {!dotsHidden && task.flies.map((f, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${f.x}%`,
                top: `${f.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="firefly-orbit"
                style={{
                  animationDuration: `${f.speed}s`,
                  animationDelay: `${-f.delay}s`,
                  animationDirection: f.vx >= 0 ? 'normal' : 'reverse',
                }}
              >
                <div
                  className="firefly-dot"
                  style={{
                    width: f.r * 2.6,
                    height: f.r * 2.6,
                    animationDuration: `${Math.max(0.22, f.speed * 0.6)}s`,
                    animationDelay: `${-f.delay}s`,
                    transform: `scale(${1 + Math.abs(f.vy) * 0.08})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {dotsHidden && <p className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-500">Estimate fireflies</p>}

        <style jsx>{`
          .firefly-orbit {
            animation-name: firefly-drift;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
          }

          .firefly-dot {
            border-radius: 999px;
            background: #fde047;
            box-shadow: 0 0 6px rgba(250, 204, 21, 0.85), 0 0 10px rgba(250, 204, 21, 0.5);
            animation-name: firefly-flicker;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
          }

          @keyframes firefly-drift {
            0% { transform: translate(0px, 0px); }
            20% { transform: translate(5px, -7px); }
            40% { transform: translate(-6px, -2px); }
            60% { transform: translate(7px, 5px); }
            80% { transform: translate(-4px, 8px); }
            100% { transform: translate(0px, 0px); }
          }

          @keyframes firefly-flicker {
            0%, 100% { opacity: 0.5; filter: brightness(1); }
            50% { opacity: 1; filter: brightness(1.35); }
          }
        `}</style>
      </div>
    );
  }
  if (task.type === 'line') {
    return (
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">How long is the orange bar?</p>
        <svg className="overflow-visible" height="52" width="280">
          <rect fill="#1e293b" height="10" rx="4" width="60" x="0" y="5" />
          <text fill="#64748b" fontSize="10" fontWeight="bold" x="64" y="14">= 5 cm</text>
          <rect fill="#f97316" height="10" rx="4" width={Math.min(task.targetPx, 270)} x="0" y="30" />
          <text fill="#94a3b8" fontSize="10" x={Math.min(task.targetPx, 270) + 4} y="39">? cm</text>
        </svg>
      </div>
    );
  }

  if (task.type === 'percent') {
    return (
      <div className="w-full max-w-sm rounded-2xl border-2 border-slate-200 bg-white p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">What percentage is filled?</p>
        <div className="overflow-hidden rounded-full bg-slate-100" style={{ height: 40 }}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-slate-500"
            style={{ width: `${task.actual}%` }}
          />
        </div>
      </div>
    );
  }

  if (task.type === 'angle') {
    const cx = 90, cy = 90, len = 70, arcR = 28;
    const rad = (task.actual * Math.PI) / 180;
    const x2 = cx + Math.cos(rad) * len;
    const y2 = cy - Math.sin(rad) * len;
    const arcEndX = cx + Math.cos(rad) * arcR;
    const arcEndY = cy - Math.sin(rad) * arcR;
    const largeArc = task.actual > 180 ? 1 : 0;
    return (
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Estimate this angle</p>
        <svg className="h-24 w-52" viewBox="0 0 200 105">
          <line stroke="#1e293b" strokeLinecap="round" strokeWidth="3" x1={cx} x2={cx + len} y1={cy} y2={cy} />
          <line stroke="#f97316" strokeLinecap="round" strokeWidth="3" x1={cx} x2={x2} y1={cy} y2={y2} />
          <path
            d={`M ${cx + arcR} ${cy} A ${arcR} ${arcR} 0 ${largeArc} 0 ${arcEndX} ${arcEndY}`}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2"
          />
          <circle cx={cx} cy={cy} fill="#1e293b" r="3.5" />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-800" style={{ width: 260, height: 160 }}>
      {!dotsHidden
        ? task.dots.map((d, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${d.x}%`,
                top: `${d.y}%`,
                width: d.r * 2,
                height: d.r * 2,
                background: d.color,
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))
        : (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">How many dots?</p>
            </div>
          )}
    </div>
  );
}

function EstimationChallenge({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('estimation-challenge');
  const ROUNDS = 4;
  const estCd = useDuelCountdown(isMultiplayerSession);
  const estHasAutoStarted = useRef(false);

  useEffect(() => {
    if (!estCd.launched || estHasAutoStarted.current) return;
    estHasAutoStarted.current = true;
    startRun();
  }, [estCd.launched]); // eslint-disable-line

  const [phase, setPhase] = useState<'idle' | 'estimating' | 'reveal' | 'finished'>('idle');
  const [roundIdx, setRoundIdx] = useState(0);
  const [task, setTask] = useState<EstTask | null>(null);
  const [guess, setGuess] = useState(50);
  const [dotsHidden, setDotsHidden] = useState(false);
  const [scoreSum, setScoreSum] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastActual, setLastActual] = useState('');
  const dotsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSavedRunRef = useRef(false);
  const sliderAudioRef = useRef<AudioContext | null>(null);

  useEffect(() => () => {
    if (dotsTimerRef.current) clearTimeout(dotsTimerRef.current);
  }, []);

  const labScore = phase === 'finished' ? scoreSum : null;

  useEffect(() => {
    if (!isSignedIn || phase !== 'finished' || labScore === null || hasSavedRunRef.current) {
      return;
    }

    hasSavedRunRef.current = true;

    void fetch('/api/scores/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testSlug: 'estimation-challenge', score: labScore, ...multiplayerMeta }),
    }).then(() => {
      emitTelemetryAssessment('estimation-challenge', labScore as number);
      if (isMultiplayerSession) goToIntermission();
    });
  }, [isSignedIn, labScore, phase, multiplayerMeta, goToIntermission, isMultiplayerSession]);

  function startRound(idx: number) {
    if (dotsTimerRef.current) clearTimeout(dotsTimerRef.current);
    const t = makeEstTask();
    setTask(t);
    setRoundIdx(idx);
    const { init } = estSlider(t);
    setGuess(init);
    setDotsHidden(false);
    setLastScore(null);
    setPhase('estimating');
    if (t.type === 'dots') {
      dotsTimerRef.current = setTimeout(() => setDotsHidden(true), 2000);
    }
  }

  function startRun() {
    hasSavedRunRef.current = false;
    setScoreSum(0);
    startRound(0);
  }

  function lockGuess() {
    if (!task || phase !== 'estimating') return;
    const rs = estRoundScore(task, guess);
    setLastActual(estActualStr(task));
    setLastScore(rs);
    setScoreSum(s => s + rs);
    setPhase('reveal');
  }

  function advance() {
    if (roundIdx + 1 >= ROUNDS) { setPhase('finished'); return; }
    startRound(roundIdx + 1);
  }

  const cfg = task ? estSlider(task) : { min: 0, max: 100, step: 1, init: 50, unit: '' };

  return (
    <CognitiveShell
      accent={MODE_META.estimation.accent}
      description={MODE_META.estimation.description}
      isSignedIn={isSignedIn}
      kicker={MODE_META.estimation.kicker}
      stats={[
        { label: 'Round', value: phase === 'idle' ? '--' : `${Math.min(roundIdx + 1, ROUNDS)} / ${ROUNDS}`, detail: `${ROUNDS} estimation tasks per run.` },
        { label: 'Task', value: task ? estLabel(task) : '--', detail: 'Type randomises each round.' },
        { label: 'Last score', value: lastScore === null ? '--' : String(lastScore), detail: 'Points earned on the previous round (0–250).' },
        { label: 'Lab score', value: labScore === null ? '--' : String(labScore), detail: 'Average accuracy across all rounds, scaled to 1000.' },
      ]}
      title={MODE_META.estimation.title}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
            {phase === 'estimating' && task ? estLabel(task) : phase === 'reveal' ? 'Result' : phase === 'finished' ? 'Run complete' : 'Press start'}
          </div>
        </div>

        <div className="relative min-h-[24rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-5 sm:min-h-[28rem]">
          {(phase === 'estimating') && task && (
            <div className="flex h-full min-h-[20rem] flex-col items-center justify-center gap-6">
              <EstVisual dotsHidden={dotsHidden} task={task} />
              <div className="w-full max-w-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{cfg.min}{cfg.unit}</span>
                  <span className="text-2xl font-black text-slate-800">{guess}{cfg.unit}</span>
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{cfg.max}{cfg.unit}</span>
                </div>
                <input
                  className="w-full accent-amber-500"
                  max={cfg.max}
                  min={cfg.min}
                  onChange={(e) => { setGuess(Number(e.target.value)); playSliderMove(); }}
                  step={cfg.step}
                  type="range"
                  value={guess}
                />
                <button className="lab-button w-full" onClick={lockGuess} type="button">Lock In</button>
              </div>
            </div>
          )}

          {phase === 'idle' && isMultiplayerSession && estCd.active && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]">
              <div className="text-center">{estCd.phase === 'go' ? <p className="text-7xl font-black text-emerald-600">GO</p> : <p className="text-8xl font-black text-slate-800">{estCd.value}</p>}</div>
            </div>
          )}
          {phase === 'idle' && !isMultiplayerSession && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Estimation Challenge</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">Estimate lengths, fill percentages, angles and dot counts. 4 randomised rounds.</p>
                <button data-start-game className="lab-button mt-4" onClick={startRun} type="button">Start</button>
              </div>
            </div>
          )}

          {phase === 'reveal' && task && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Round {roundIdx + 1} — {estLabel(task)}</p>
                <p className="mt-2 text-sm text-slate-500">
                  Actual: <span className="font-black text-slate-800">{lastActual}</span>
                  {' '}· Your guess: <span className="font-bold">{guess}{cfg.unit}</span>
                </p>
                <p className={`mt-2 text-3xl font-black ${(lastScore ?? 0) >= 70 ? 'text-emerald-600' : (lastScore ?? 0) >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {lastScore} pts
                </p>
                <button className="lab-button mt-4" onClick={advance} type="button">
                  {roundIdx + 1 >= ROUNDS ? 'See Final Score' : 'Next Round'}
                </button>
              </div>
            </div>
          )}

          {phase === 'finished' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p>
                <p className="mt-3 text-4xl font-black text-slate-800">{labScore}</p>
                <p className="mt-1 text-sm text-slate-500">Avg round score: {Math.round(scoreSum / ROUNDS)} / 250</p>
                <button className="lab-button mt-4" onClick={startRun} type="button">Start New Run</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </CognitiveShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEQUENCE MEMORY
// ═══════════════════════════════════════════════════════════════════════════════

const TILE_COLORS = [
  '#f87171', '#fb923c', '#facc15',
  '#4ade80', '#22d3ee', '#818cf8',
  '#f472b6', '#a78bfa', '#2dd4bf',
];

const TILE_NOTES = [261, 293, 330, 349, 392, 440, 494, 523, 587];

function useSeqAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  function getCtx() {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    return ctxRef.current;
  }

  const unlock = async () => {
    const ctx = getCtx();
    if (ctx && ctx.state !== 'running') await ctx.resume();
  };

  const playNote = (tileIdx: number, dur = 0.35) => {
    const ctx = getCtx();
    if (!ctx) return;
    const freq = TILE_NOTES[clamp(tileIdx, 0, TILE_NOTES.length - 1)];
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  };

  return { unlock, playNote };
}

function SequenceMemory({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('sequence-memory');
  const [phase, setPhase] = useState<'idle' | 'showing' | 'input' | 'wrong'>('idle');
  const [sequence, setSequence] = useState<number[]>([]);
  const [inputSoFar, setInputSoFar] = useState<number[]>([]);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [flashTile, setFlashTile] = useState<{ idx: number; ok: boolean } | null>(null);
  const [bestLength, setBestLength] = useState(0);

  const audio = useSeqAudio();
  const seqRef = useRef<number[]>([]);
  const failedRef = useRef(false);
  const hasSavedRunRef = useRef(false);

  const labScore = useMemo(() => clamp(Math.round(sequence.length * 80), 0, 1000), [sequence.length]);

  useEffect(() => {
    if (!isSignedIn || phase !== 'wrong' || hasSavedRunRef.current) {
      return;
    }

    hasSavedRunRef.current = true;

    void fetch('/api/scores/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testSlug: 'sequence-memory', score: labScore, ...multiplayerMeta }),
    }).then(() => {
      emitTelemetryAssessment('sequence-memory', labScore);
      if (isMultiplayerSession) goToIntermission();
    });
  }, [isSignedIn, labScore, phase, multiplayerMeta, goToIntermission, isMultiplayerSession]);

  // Drive the showing animation via effect so it reacts to phase changes
  useEffect(() => {
    if (phase !== 'showing') return;
    const seq = seqRef.current;
    let cancelled = false;

    async function run() {
      await new Promise<void>(r => setTimeout(r, 500));
      for (let i = 0; i < seq.length; i++) {
        if (cancelled) return;
        setActiveTile(seq[i]);
        audio.playNote(seq[i]);
        await new Promise<void>(r => setTimeout(r, 420));
        if (cancelled) return;
        setActiveTile(null);
        if (i < seq.length - 1) await new Promise<void>(r => setTimeout(r, 180));
      }
      await new Promise<void>(r => setTimeout(r, 350));
      if (!cancelled) {
        setInputSoFar([]);
        setPhase('input');
      }
    }

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function startRun() {
    audio.unlock().catch(() => {});
    const first = Math.floor(Math.random() * 9);
    seqRef.current = [first];
    setSequence([first]);
    setInputSoFar([]);
    setFlashTile(null);
    setActiveTile(null);
    setBestLength(0);
    failedRef.current = false;
    hasSavedRunRef.current = false;
    setPhase('showing');
  }

  function handleTile(idx: number) {
    if (phase !== 'input' || failedRef.current) return;
    audio.playNote(idx, 0.2);

    const next = [...inputSoFar, idx];
    const expected = seqRef.current[next.length - 1];

    if (idx !== expected) {
      failedRef.current = true;
      setFlashTile({ idx, ok: false });
      setBestLength(b => Math.max(b, seqRef.current.length - 1));
      setTimeout(() => {
        setFlashTile(null);
        setPhase('wrong');
      }, 600);
      return;
    }

    setFlashTile({ idx, ok: true });
    setTimeout(() => setFlashTile(null), 180);

    if (next.length === seqRef.current.length) {
      setBestLength(b => Math.max(b, seqRef.current.length));
      const nextTile = Math.floor(Math.random() * 9);
      const nextSeq = [...seqRef.current, nextTile];
      seqRef.current = nextSeq;
      setSequence(nextSeq);
      setInputSoFar([]);
      setTimeout(() => setPhase('showing'), 500);
    } else {
      setInputSoFar(next);
    }
  }

  function tileStyle(idx: number): React.CSSProperties {
    const base = TILE_COLORS[idx];
    const isActive = activeTile === idx;
    const isFlash = flashTile?.idx === idx;
    if (isFlash) {
      return {
        background: flashTile.ok ? '#bbf7d0' : '#fecaca',
        boxShadow: `0 0 24px ${flashTile.ok ? '#4ade80' : '#f87171'}`,
        border: '2px solid transparent',
      };
    }
    if (isActive) {
      return {
        background: base,
        boxShadow: `0 0 32px ${base}`,
        filter: 'brightness(1.35)',
        border: '2px solid transparent',
      };
    }
    return { background: `${base}30`, border: `2px solid ${base}55` };
  }

  return (
    <CognitiveShell
      accent={MODE_META.sequence.accent}
      description={MODE_META.sequence.description}
      isSignedIn={isSignedIn}
      kicker={MODE_META.sequence.kicker}
      stats={[
        { label: 'Sequence length', value: phase === 'idle' ? '--' : String(sequence.length), detail: 'Current number of steps to remember.' },
        { label: 'Phase', value: phase === 'showing' ? 'Watch' : phase === 'input' ? 'Repeat' : phase === 'wrong' ? 'Wrong' : 'Ready', detail: 'Watch the sequence, then tap it back.' },
        { label: 'Best length', value: String(bestLength), detail: 'Longest sequence correctly reproduced this session.' },
        { label: 'Lab score', value: phase === 'wrong' ? String(labScore) : '--', detail: 'Score based on the sequence length you reached.' },
      ]}
      title={MODE_META.sequence.title}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
            {phase === 'showing'
              ? `Memorize — ${sequence.length} step${sequence.length !== 1 ? 's' : ''}`
              : phase === 'input'
                ? `Repeat the sequence (${inputSoFar.length} / ${sequence.length})`
                : phase === 'wrong'
                  ? 'Wrong tile — run ended'
                  : 'Press start'}
          </div>
        </div>

        <div className="relative min-h-[24rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-5 sm:min-h-[28rem]">
          {phase !== 'idle' && (
            <div className="flex items-center justify-center h-full min-h-[20rem]">
              <div className="grid w-full h-full max-w-md max-h-md grid-cols-3 gap-3" style={{ aspectRatio: '1/1' }}>
                {Array.from({ length: 9 }).map((_, idx) => (
                  <button
                    className="rounded-2xl transition-all duration-100 w-full h-full"
                    disabled={phase !== 'input'}
                    key={idx}
                    onClick={() => handleTile(idx)}
                    style={tileStyle(idx)}
                    type="button"
                  />
                ))}
              </div>
            </div>
          )}

          {phase === 'idle' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Sequence Memory</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">Watch the 3×3 grid light up, then tap the tiles in the same order. Sequence grows each round.</p>
                <button data-start-game className="lab-button mt-4" onClick={startRun} type="button">Start</button>
              </div>
            </div>
          )}

          {phase === 'wrong' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Wrong tile</p>
                <p className="mt-3 text-4xl font-black text-slate-800">{labScore}</p>
                <p className="mt-1 text-sm text-slate-500">Reached sequence length {sequence.length}</p>
                <button className="lab-button mt-4" onClick={startRun} type="button">Try Again</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </CognitiveShell>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function CognitiveProtocols({ isSignedIn, mode }: CognitiveProtocolsProps) {
  if (mode === 'estimation') return <EstimationChallenge isSignedIn={isSignedIn} />;
  if (mode === 'sequence') return <SequenceMemory isSignedIn={isSignedIn} />;
  return <MentalRotation isSignedIn={isSignedIn} />;
}