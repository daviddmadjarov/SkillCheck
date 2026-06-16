'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';

type MouseMode = 'symbol' | 'cps' | 'tracking';

type MouseProtocolsProps = {
  initialCpsDuration?: 5 | 10 | 15;
  initialTraceMode?: TraceMode;
  mode: MouseMode;
  isSignedIn: boolean;
};

type MouseShellProps = {
  title: string;
  kicker: string;
  description: string;
  accent: string;
  isSignedIn: boolean;
  stats: Array<{ label: string; value: string; detail: string }>;
  children: ReactNode;
};

type Point = { x: number; y: number };
type TraceMode = 'assist' | 'memory';

type TraceSymbol = {
  key: string;
  label: string;
  points: Point[];
};

const MODE_META: Record<MouseMode, { title: string; kicker: string; description: string; accent: string }> = {
  symbol: {
    title: 'Symbol Tracing',
    kicker: 'Path precision',
    description: 'Trace each target shape as precisely as possible.',
    accent: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  cps: {
    title: 'CPS Tester',
    kicker: 'Click speed',
    description: 'Measure your click speed over a short burst.',
    accent: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  },
  tracking: {
    title: 'Tracking Test',
    kicker: 'Cursor control',
    description: 'Keep your pointer inside the moving target for the full run.',
    accent: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(points: Point[]) {
  if (points.length < 2) {
    return 0;
  }

  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    sum += distance(points[i - 1], points[i]);
  }
  return sum;
}

function resamplePath(points: Point[], targetCount: number) {
  if (points.length === 0) {
    return [] as Point[];
  }

  if (points.length === 1 || targetCount <= 1) {
    return [points[0]];
  }

  const totalLength = pathLength(points);
  if (totalLength === 0) {
    return Array.from({ length: targetCount }, () => points[0]);
  }

  const step = totalLength / (targetCount - 1);
  const sampled: Point[] = [points[0]];
  let accumulated = 0;
  let segmentStart = points[0];
  let index = 1;

  while (index < points.length) {
    const segmentEnd = points[index];
    const segmentLength = distance(segmentStart, segmentEnd);

    if (segmentLength === 0) {
      index += 1;
      continue;
    }

    if (accumulated + segmentLength >= step) {
      const remain = step - accumulated;
      const t = remain / segmentLength;
      const point = {
        x: segmentStart.x + (segmentEnd.x - segmentStart.x) * t,
        y: segmentStart.y + (segmentEnd.y - segmentStart.y) * t,
      };
      sampled.push(point);
      segmentStart = point;
      accumulated = 0;
    } else {
      accumulated += segmentLength;
      segmentStart = segmentEnd;
      index += 1;
    }
  }

  while (sampled.length < targetCount) {
    sampled.push(points[points.length - 1]);
  }

  return sampled;
}

function makeSpiralPoints() {
  const points: Point[] = [];
  const turns = 2.3;
  const steps = 140;

  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const angle = t * turns * Math.PI * 2;
    const radius = 4 + t * 28;
    points.push({
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius,
    });
  }

  return points;
}

function makeInfinityPoints() {
  const points: Point[] = [];
  const steps = 180;

  for (let i = 0; i < steps; i += 1) {
    const t = (i / (steps - 1)) * Math.PI * 2;
    points.push({
      x: 50 + 26 * Math.sin(t),
      y: 50 + 12 * Math.sin(t) * Math.cos(t),
    });
  }

  return points;
}

function useHighScoreChime() {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (audioContextRef.current !== null) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return useCallback(() => {
    if (typeof window === 'undefined' || window.AudioContext === undefined) {
      return;
    }

    if (audioContextRef.current === null) {
      try {
        audioContextRef.current = new window.AudioContext();
      } catch {
        return;
      }
    }

    const context = audioContextRef.current;
    if (context === null) {
      return;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.2, now + 0.005);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    master.connect(context.destination);

    const notes = [1318.5, 1568, 1975.5];
    notes.forEach((frequency, index) => {
      const start = now + index * 0.045;
      const stop = start + 0.15;
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);

      const gainNode = context.createGain();
      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.exponentialRampToValueAtTime(0.12, start + 0.008);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stop);

      oscillator.connect(gainNode);
      gainNode.connect(master);
      oscillator.start(start);
      oscillator.stop(stop);
    });
  }, []);
}

const TRACE_SYMBOLS: TraceSymbol[] = [
  {
    key: 'star',
    label: 'Star',
    points: [
      { x: 50, y: 16 }, { x: 58, y: 38 }, { x: 82, y: 38 }, { x: 62, y: 52 }, { x: 70, y: 76 },
      { x: 50, y: 61 }, { x: 30, y: 76 }, { x: 38, y: 52 }, { x: 18, y: 38 }, { x: 42, y: 38 }, { x: 50, y: 16 },
    ],
  },
  {
    key: 'arrow',
    label: 'Arrow',
    points: [
      { x: 18, y: 50 }, { x: 60, y: 50 }, { x: 60, y: 36 }, { x: 84, y: 50 }, { x: 60, y: 64 }, { x: 60, y: 50 }, { x: 18, y: 50 },
    ],
  },
  {
    key: 'heart',
    label: 'Heart',
    points: [
      { x: 50, y: 78 }, { x: 74, y: 55 }, { x: 80, y: 38 }, { x: 69, y: 27 }, { x: 56, y: 30 },
      { x: 50, y: 37 }, { x: 44, y: 30 }, { x: 31, y: 27 }, { x: 20, y: 38 }, { x: 26, y: 55 }, { x: 50, y: 78 },
    ],
  },
  {
    key: 'spiral',
    label: 'Spiral',
    points: makeSpiralPoints(),
  },
  {
    key: 'infinity',
    label: 'Infinity',
    points: makeInfinityPoints(),
  },
  {
    key: 'lightning',
    label: 'Lightning Bolt',
    points: [
      { x: 60, y: 14 }, { x: 38, y: 48 }, { x: 54, y: 48 }, { x: 40, y: 86 }, { x: 66, y: 46 }, { x: 50, y: 46 }, { x: 60, y: 14 },
    ],
  },
  {
    key: 'crown',
    label: 'Crown',
    points: [
      { x: 16, y: 72 }, { x: 26, y: 36 }, { x: 40, y: 58 }, { x: 50, y: 30 }, { x: 60, y: 58 }, { x: 74, y: 36 }, { x: 84, y: 72 }, { x: 16, y: 72 },
    ],
  },
  {
    key: 'wave',
    label: 'Sine Wave',
    points: [
      { x: 14, y: 50 }, { x: 22, y: 40 }, { x: 30, y: 32 }, { x: 38, y: 34 }, { x: 46, y: 44 }, { x: 54, y: 56 },
      { x: 62, y: 66 }, { x: 70, y: 68 }, { x: 78, y: 60 }, { x: 86, y: 50 },
    ],
  },
  {
    key: 'clover',
    label: 'Clover',
    points: [
      { x: 50, y: 50 }, { x: 44, y: 38 }, { x: 50, y: 28 }, { x: 56, y: 38 }, { x: 50, y: 50 },
      { x: 62, y: 44 }, { x: 72, y: 50 }, { x: 62, y: 56 }, { x: 50, y: 50 },
      { x: 56, y: 62 }, { x: 50, y: 72 }, { x: 44, y: 62 }, { x: 50, y: 50 },
      { x: 38, y: 56 }, { x: 28, y: 50 }, { x: 38, y: 44 }, { x: 50, y: 50 },
    ],
  },
  {
    key: 'diamond',
    label: 'Diamond',
    points: [{ x: 50, y: 18 }, { x: 80, y: 50 }, { x: 50, y: 82 }, { x: 20, y: 50 }, { x: 50, y: 18 }],
  },
  {
    key: 'hexagon',
    label: 'Hexagon',
    points: [{ x: 32, y: 24 }, { x: 68, y: 24 }, { x: 84, y: 50 }, { x: 68, y: 76 }, { x: 32, y: 76 }, { x: 16, y: 50 }, { x: 32, y: 24 }],
  },
  {
    key: 'crescent',
    label: 'Crescent',
    points: [
      { x: 72, y: 20 }, { x: 58, y: 18 }, { x: 46, y: 22 }, { x: 36, y: 32 }, { x: 32, y: 46 }, { x: 36, y: 60 },
      { x: 46, y: 70 }, { x: 58, y: 74 }, { x: 72, y: 72 }, { x: 62, y: 66 }, { x: 54, y: 58 }, { x: 50, y: 46 },
      { x: 54, y: 34 }, { x: 62, y: 26 }, { x: 72, y: 20 },
    ],
  },
  {
    key: 'mountain',
    label: 'Mountain',
    points: [{ x: 14, y: 76 }, { x: 36, y: 38 }, { x: 48, y: 58 }, { x: 58, y: 46 }, { x: 78, y: 76 }, { x: 14, y: 76 }],
  },
  {
    key: 'hourglass',
    label: 'Hourglass',
    points: [{ x: 24, y: 20 }, { x: 76, y: 20 }, { x: 54, y: 50 }, { x: 76, y: 80 }, { x: 24, y: 80 }, { x: 46, y: 50 }, { x: 24, y: 20 }],
  },
  {
    key: 'cloud',
    label: 'Cloud',
    points: [
      { x: 26, y: 58 }, { x: 22, y: 50 }, { x: 26, y: 42 }, { x: 34, y: 38 }, { x: 40, y: 30 }, { x: 50, y: 30 },
      { x: 58, y: 35 }, { x: 66, y: 34 }, { x: 74, y: 40 }, { x: 76, y: 50 }, { x: 72, y: 58 }, { x: 26, y: 58 },
    ],
  },
  {
    key: 'leaf',
    label: 'Leaf',
    points: [{ x: 20, y: 56 }, { x: 34, y: 34 }, { x: 54, y: 24 }, { x: 74, y: 34 }, { x: 80, y: 56 }, { x: 66, y: 72 }, { x: 44, y: 76 }, { x: 26, y: 68 }, { x: 20, y: 56 }],
  },
  {
    key: 'keyhole',
    label: 'Keyhole',
    points: [
      { x: 50, y: 20 }, { x: 60, y: 22 }, { x: 68, y: 30 }, { x: 70, y: 40 }, { x: 64, y: 48 }, { x: 56, y: 52 },
      { x: 56, y: 78 }, { x: 44, y: 78 }, { x: 44, y: 52 }, { x: 36, y: 48 }, { x: 30, y: 40 }, { x: 32, y: 30 },
      { x: 40, y: 22 }, { x: 50, y: 20 },
    ],
  },
  {
    key: 'comet',
    label: 'Comet',
    points: [{ x: 16, y: 62 }, { x: 36, y: 56 }, { x: 52, y: 48 }, { x: 66, y: 36 }, { x: 78, y: 24 }, { x: 70, y: 40 }, { x: 54, y: 54 }, { x: 36, y: 62 }, { x: 16, y: 62 }],
  },
  {
    key: 'trident',
    label: 'Trident',
    points: [
      { x: 34, y: 78 }, { x: 34, y: 30 }, { x: 28, y: 38 }, { x: 22, y: 26 }, { x: 28, y: 20 },
      { x: 34, y: 30 }, { x: 50, y: 78 }, { x: 50, y: 22 }, { x: 44, y: 30 }, { x: 50, y: 18 },
      { x: 56, y: 30 }, { x: 66, y: 78 }, { x: 66, y: 30 }, { x: 72, y: 38 }, { x: 78, y: 26 }, { x: 72, y: 20 }, { x: 66, y: 30 },
    ],
  },
  {
    key: 'droplet',
    label: 'Droplet',
    points: [{ x: 50, y: 16 }, { x: 66, y: 34 }, { x: 72, y: 52 }, { x: 64, y: 70 }, { x: 50, y: 80 }, { x: 36, y: 70 }, { x: 28, y: 52 }, { x: 34, y: 34 }, { x: 50, y: 16 }],
  },
  {
    key: 'orbital',
    label: 'Orbital Loop',
    points: [
      { x: 24, y: 50 }, { x: 34, y: 34 }, { x: 50, y: 26 }, { x: 66, y: 34 }, { x: 76, y: 50 }, { x: 66, y: 66 }, { x: 50, y: 74 }, { x: 34, y: 66 }, { x: 24, y: 50 },
      { x: 40, y: 50 }, { x: 50, y: 44 }, { x: 60, y: 50 }, { x: 50, y: 56 }, { x: 40, y: 50 },
    ],
  },
  {
    key: 'circuit',
    label: 'Circuit Path',
    points: [{ x: 18, y: 28 }, { x: 42, y: 28 }, { x: 42, y: 42 }, { x: 58, y: 42 }, { x: 58, y: 24 }, { x: 82, y: 24 }, { x: 82, y: 70 }, { x: 54, y: 70 }, { x: 54, y: 58 }, { x: 18, y: 58 }, { x: 18, y: 28 }],
  },
  {
    key: 'kite',
    label: 'Kite',
    points: [{ x: 50, y: 16 }, { x: 72, y: 50 }, { x: 50, y: 78 }, { x: 28, y: 50 }, { x: 50, y: 16 }, { x: 50, y: 88 }, { x: 44, y: 94 }, { x: 50, y: 88 }, { x: 56, y: 94 }],
  },
  {
    key: 'maze-turn',
    label: 'Maze Turn',
    points: [{ x: 18, y: 22 }, { x: 78, y: 22 }, { x: 78, y: 40 }, { x: 42, y: 40 }, { x: 42, y: 58 }, { x: 72, y: 58 }, { x: 72, y: 78 }, { x: 24, y: 78 }, { x: 24, y: 62 }, { x: 56, y: 62 }],
  },
];

function nearestDistanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const denom = dx * dx + dy * dy;

  if (denom === 0) {
    return distance(point, a);
  }

  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / denom, 0, 1);
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}

function nearestDistanceToPolyline(point: Point, path: Point[]) {
  if (path.length === 0) {
    return 0;
  }

  if (path.length === 1) {
    return distance(point, path[0]);
  }

  let closest = Number.POSITIVE_INFINITY;
  for (let i = 1; i < path.length; i += 1) {
    closest = Math.min(closest, nearestDistanceToSegment(point, path[i - 1], path[i]));
  }
  return closest;
}

function evaluateTrace(userPath: Point[], targetPath: Point[]) {
  if (userPath.length < 4) {
    return {
      accuracy: 0,
      deviation: 99,
      completion: 0,
      labScore: 0,
    };
  }

  const sampleCount = clamp(Math.min(userPath.length, targetPath.length), 56, 220);
  const userSampled = resamplePath(userPath, sampleCount);
  const targetSampled = resamplePath(targetPath, sampleCount);

  let userToTargetSum = 0;
  for (let i = 0; i < userSampled.length; i += 1) {
    userToTargetSum += nearestDistanceToPolyline(userSampled[i], targetSampled);
  }

  let targetToUserSum = 0;
  let coveredTargetPoints = 0;
  for (let i = 0; i < targetSampled.length; i += 1) {
    const nearest = nearestDistanceToPolyline(targetSampled[i], userSampled);
    targetToUserSum += nearest;
    if (nearest <= 2.4) {
      coveredTargetPoints += 1;
    }
  }

  const averageDeviation = userToTargetSum / userSampled.length * 0.65 + targetToUserSum / targetSampled.length * 0.35;
  const baseAccuracy = clamp(100 - averageDeviation * 3.45, 0, 100);

  const targetLen = Math.max(pathLength(targetPath), 0.001);
  const userLen = pathLength(userPath);
  const lengthRatio = userLen / targetLen;
  const lengthScore = clamp(100 - Math.abs(1 - lengthRatio) * 230, 0, 100);
  const coverage = clamp((coveredTargetPoints / targetSampled.length) * 100, 0, 100);

  const accuracy = Math.round(baseAccuracy);
  const completion = Math.round((coverage * 0.78) + (lengthScore * 0.22));

  const normalizedAccuracy = accuracy / 100;
  const normalizedCompletion = completion / 100;
  const qualityCore = normalizedAccuracy ** 2.15 * 0.78 + normalizedCompletion ** 2 * 0.22;

  const deviationPenalty = Math.max(0, averageDeviation - 2.2) * 48;
  const coveragePenalty = coverage < 85 ? (85 - coverage) * 4.1 : 0;
  const lengthDelta = Math.abs(1 - lengthRatio);
  const lengthPenalty = lengthDelta > 0.08 ? (lengthDelta - 0.08) * 560 : 0;

  const labScore = clamp(Math.round(qualityCore * 1000 - deviationPenalty - coveragePenalty - lengthPenalty), 0, 1000);

  return {
    accuracy,
    deviation: Number(averageDeviation.toFixed(2)),
    completion,
    labScore,
  };
}

function MouseShell({ title, kicker, description, accent, isSignedIn, stats, children }: MouseShellProps) {
  return (
    <section className="lab-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Mouse Category</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">{title}</h2>
          <p className={`mt-3 inline-flex rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${accent}`}>{kicker}</p>
        </div>
        <div className="cursor-pointer rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
          {isSignedIn ? 'Leaderboard sync active' : 'Guest mode'}
        </div>
      </div>

      <p className="mb-4 max-w-2xl text-sm font-medium leading-6 text-slate-500">{description}</p>

      {children}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-black text-slate-800">{stat.value}</p>
            <p className="mt-1 text-sm font-medium text-slate-500">{stat.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SymbolTracing({ initialTraceMode = 'assist', isSignedIn }: { initialTraceMode?: TraceMode; isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('mouse-symbol-tracing');
  const TOTAL_ROUNDS = 4;
  const [traceMode, setTraceMode] = useState<TraceMode>(initialTraceMode);
  const [symbolOrder, setSymbolOrder] = useState<number[]>([0, 1, 2, 3]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [userPath, setUserPath] = useState<Point[]>([]);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [result, setResult] = useState<ReturnType<typeof evaluateTrace> | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const hideGuideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playHighScoreChime = useHighScoreChime();
  const hasSavedSessionRef = useRef(false);

  const symbol = TRACE_SYMBOLS[symbolOrder[roundIndex] ?? 0];
  const pathString = useMemo(() => userPath.map((p) => `${p.x},${p.y}`).join(' '), [userPath]);
  const averageLabScore = roundScores.length === 0 ? null : Math.round(roundScores.reduce((sum, value) => sum + value, 0) / roundScores.length);

  useEffect(() => {
    return () => {
      if (hideGuideTimeoutRef.current !== null) {
        clearTimeout(hideGuideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSignedIn || !sessionFinished || averageLabScore === null || hasSavedSessionRef.current) {
      return;
    }

    hasSavedSessionRef.current = true;

    void (async () => {
      const response = await fetch('/api/scores/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testSlug: 'mouse-symbol-tracing', score: averageLabScore, ...multiplayerMeta }),
      });

      if (response.ok && isMultiplayerSession) {
        goToIntermission();
      }
    })();
  }, [averageLabScore, goToIntermission, isMultiplayerSession, isSignedIn, sessionFinished, multiplayerMeta]);

  function getBoardPoint(clientX: number, clientY: number) {
    const board = boardRef.current;
    if (board === null) {
      return null;
    }

    const rect = board.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }

  function createRunOrder() {
    const indices = TRACE_SYMBOLS.map((_, index) => index);
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, Math.min(TOTAL_ROUNDS, indices.length));
  }

  function prepareRound(nextRoundIndex: number) {
    if (hideGuideTimeoutRef.current !== null) {
      clearTimeout(hideGuideTimeoutRef.current);
      hideGuideTimeoutRef.current = null;
    }

    setRoundIndex(nextRoundIndex);
    setRunning(true);
    setDrawing(false);
    setUserPath([]);
    setResult(null);
    setShowGuide(true);

    if (traceMode === 'memory') {
      hideGuideTimeoutRef.current = setTimeout(() => {
        setShowGuide(false);
      }, 3000);
    }
  }

  function startTraceRun() {
    const order = createRunOrder();
    setSymbolOrder(order);
    setRoundScores([]);
    setSessionFinished(false);
    hasSavedSessionRef.current = false;
    prepareRound(0);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!running) {
      return;
    }

    if (traceMode === 'memory' && showGuide) {
      return;
    }

    const point = getBoardPoint(event.clientX, event.clientY);
    if (point === null) {
      return;
    }

    setDrawing(true);
    setUserPath([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!running || !drawing) {
      return;
    }

    const point = getBoardPoint(event.clientX, event.clientY);
    if (point === null) {
      return;
    }

    setUserPath((current) => {
      if (current.length === 0) {
        return [point];
      }

      if (distance(current[current.length - 1], point) < 0.25) {
        return current;
      }

      return [...current, point];
    });
  }

  function handlePointerUp() {
    setDrawing(false);
  }

  function finishTraceRound() {
    if (!running) {
      return;
    }

    setRunning(false);
    setDrawing(false);
    setShowGuide(true);
    const traceResult = evaluateTrace(userPath, symbol.points);
    setResult(traceResult);

    if (traceResult.labScore >= 800) {
      playHighScoreChime();
    }
  }

  function advanceRound() {
    if (result === null) {
      return;
    }

    const nextScores = [...roundScores, result.labScore];
    setRoundScores(nextScores);

    const nextRoundIndex = roundIndex + 1;
    if (nextRoundIndex >= TOTAL_ROUNDS) {
      setSessionFinished(true);
      setResult(null);
      setRunning(false);
      return;
    }

    prepareRound(nextRoundIndex);
  }

  const isIdle = !running && !sessionFinished && result === null && roundScores.length === 0;
  const modeLocked = !sessionFinished && (running || result !== null || roundScores.length > 0);

  return (
    <MouseShell
      title={MODE_META.symbol.title}
      kicker={MODE_META.symbol.kicker}
      description={MODE_META.symbol.description}
      accent={MODE_META.symbol.accent}
      isSignedIn={isSignedIn}
      stats={[
        { label: 'Rounds left', value: `${Math.max(TOTAL_ROUNDS - roundScores.length - (result === null ? 0 : 1), 0)}`, detail: 'Complete four symbols per run.' },
        { label: 'Shape', value: symbol.label, detail: `Round ${Math.min(roundIndex + 1, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}` },
        { label: 'Last Accuracy', value: result === null ? '--' : `${result.accuracy}%`, detail: 'How closely your line matched the target path.' },
        { label: 'Lab score', value: sessionFinished ? `${averageLabScore ?? 0}` : result === null ? '--' : `${result.labScore}`, detail: sessionFinished ? 'Average lab score over all 4 rounds.' : 'Trace performance score on a 1000-point scale.' },
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${traceMode === 'assist' ? 'border-cyan-300 bg-cyan-100 text-cyan-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'} ${modeLocked ? 'cursor-not-allowed opacity-60' : ''}`}
            disabled={modeLocked}
            onClick={() => {
              if (modeLocked) {
                return;
              }
              setTraceMode('assist');
            }}
            type="button"
          >
            Trace Assist
          </button>
          <button
            className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${traceMode === 'memory' ? 'border-cyan-300 bg-cyan-100 text-cyan-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'} ${modeLocked ? 'cursor-not-allowed opacity-60' : ''}`}
            disabled={modeLocked}
            onClick={() => {
              if (modeLocked) {
                return;
              }
              setTraceMode('memory');
            }}
            type="button"
          >
            Memory Trace (3s)
          </button>

          {running && (
            <button className="lab-button" onClick={finishTraceRound} type="button">
              Done Trace
            </button>
          )}

          {!running && result !== null && !sessionFinished && (
            <button className="lab-button" onClick={advanceRound} type="button">
              Next Symbol
            </button>
          )}

          {sessionFinished && (
            <button className="lab-button" onClick={startTraceRun} type="button">
              Start New Run
            </button>
          )}
        </div>

        <div
          className="relative mx-auto aspect-square w-full max-w-[38rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={boardRef}
        >
          {traceMode === 'memory' && running && showGuide && (
            <div className="absolute left-4 top-4 z-20 rounded-full border-2 border-slate-200 bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 shadow-sm">
              Memorize shape...
            </div>
          )}

          {traceMode === 'memory' && running && !showGuide && (
            <div className="absolute left-4 top-4 z-20 rounded-full border-2 border-slate-200 bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 shadow-sm">
              Draw now
            </div>
          )}

          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
            {showGuide && (
              <polyline
                fill="none"
                points={symbol.points.map((point) => `${point.x},${point.y}`).join(' ')}
                stroke="#10b981"
                strokeDasharray="3 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.6"
                style={isIdle ? { filter: 'blur(1.8px)', opacity: 0.45 } : undefined}
              />
            )}

            <polyline
              fill="none"
              points={pathString}
              stroke="#0f172a"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3.4"
            />
          </svg>

          {isIdle && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/35 backdrop-blur-sm">
              <button className="lab-button" onClick={startTraceRun} type="button">
                Start Tracing
              </button>
            </div>
          )}

          {sessionFinished && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/45 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-5 py-4 text-center shadow-lg">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p>
                <p className="mt-2 text-xl font-black tracking-tight text-slate-800">Avg Lab Score: {averageLabScore ?? 0}</p>
                <button className="mt-4 lab-button" onClick={startTraceRun} type="button">
                  Start New Run
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MouseShell>
  );
}

function CpsTester({ initialDuration = 10, isSignedIn }: { initialDuration?: 5 | 10 | 15; isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('mouse-cps');
  const [duration, setDuration] = useState<5 | 10 | 15>(initialDuration);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const playHighScoreChime = useHighScoreChime();

  const secondsLeft = Math.max(0, duration - Math.floor(elapsedMs / 1000));

  const currentCps = useMemo(() => {
    if (clicks === 0) {
      return 0;
    }
    return Number((clicks / Math.max(elapsedMs / 1000, 1 / 1000)).toFixed(2));
  }, [clicks, elapsedMs]);

  const peakCps = useMemo(() => {
    if (timestamps.length === 0) {
      return 0;
    }

    let best = 0;
    for (let i = 0; i < timestamps.length; i += 1) {
      const anchor = timestamps[i];
      let count = 0;
      for (let j = i; j < timestamps.length; j += 1) {
        if (timestamps[j] - anchor <= 1000) {
          count += 1;
        }
      }
      best = Math.max(best, count);
    }

    return Number(best.toFixed(2));
  }, [timestamps]);

  const averageCps = Number((clicks / Math.max(duration, 1)).toFixed(2));
  const weightedCps = averageCps * 0.75 + peakCps * 0.25;
  const labScore = clamp(Math.round((weightedCps / 20) * 1000), 0, 1000);

  useEffect(() => {
    if (!started || finished || startMs === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextElapsed = performance.now() - startMs;
      if (nextElapsed >= duration * 1000) {
        const finalAverageCps = clicks / Math.max(duration, 1);
        const finalWeightedCps = finalAverageCps * 0.75 + peakCps * 0.25;
        const finalScore = clamp(Math.round((finalWeightedCps / 20) * 1000), 0, 1000);

        if (isSignedIn) {
          void (async () => {
            const response = await fetch('/api/scores/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ testSlug: 'mouse-cps', score: finalScore, ...multiplayerMeta }),
            });

            if (response.ok && isMultiplayerSession) {
              goToIntermission();
            }
          })();
        }

        if (finalScore >= 800) {
          playHighScoreChime();
        }

        setElapsedMs(duration * 1000);
        setStarted(false);
        setFinished(true);
        return;
      }

      setElapsedMs(nextElapsed);
    }, 30);

    return () => window.clearInterval(intervalId);
  }, [clicks, duration, finished, goToIntermission, isMultiplayerSession, isSignedIn, peakCps, playHighScoreChime, startMs, started, multiplayerMeta]);

  function resetRun(nextDuration: 5 | 10 | 15 = duration) {
    setDuration(nextDuration);
    setStarted(false);
    setFinished(false);
    setClicks(0);
    setElapsedMs(0);
    setStartMs(null);
    setTimestamps([]);
  }

  function handleClick() {
    if (finished) {
      return;
    }

    const now = performance.now();

    if (!started) {
      setStarted(true);
      setStartMs(now);
      setElapsedMs(0);
    }

    setClicks((current) => current + 1);
    setTimestamps((current) => [...current, now]);
  }

  return (
    <MouseShell
      title={MODE_META.cps.title}
      kicker={MODE_META.cps.kicker}
      description={MODE_META.cps.description}
      accent={MODE_META.cps.accent}
      isSignedIn={isSignedIn}
      stats={[
        { label: 'Seconds left', value: `${secondsLeft}s`, detail: 'Remaining time in this click sprint.' },
        { label: 'Clicks', value: `${clicks}`, detail: 'Total registered clicks this run.' },
        { label: 'CPS', value: `${currentCps}`, detail: 'Current average clicks per second.' },
        { label: 'Lab score', value: `${labScore}`, detail: 'CPS scaled to a 1000-point score.' },
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[5, 10, 15].map((value) => (
            <button
              className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${duration === value ? 'border-cyan-300 bg-cyan-100 text-cyan-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              key={value}
              onClick={() => resetRun(value as 5 | 10 | 15)}
              type="button"
            >
              {value}s
            </button>
          ))}
        </div>

        <div className="relative min-h-[24rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4 sm:min-h-[28rem]">
          <button
            className="flex h-full min-h-[20rem] w-full cursor-pointer items-center justify-center rounded-[1.5rem] border-2 border-cyan-200 bg-white/80 text-center shadow-sm transition hover:bg-white"
            onClick={handleClick}
            type="button"
          >
            <span>
              <span className="block text-5xl font-black tracking-tight text-slate-800">{clicks}</span>
              <span className="mt-2 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                {started ? 'Click as fast as possible' : 'Click to start'}
              </span>
            </span>
          </button>

          {finished && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-sm">
              <button className="lab-button" onClick={() => resetRun()} type="button">
                Start New Run
              </button>
            </div>
          )}
        </div>

        <p className="text-sm font-semibold text-slate-500">Peak burst: {peakCps} CPS over one second.</p>
      </div>
    </MouseShell>
  );
}

// ── Tracking Test ──

const TARGET_RADIUS_PERCENT = 6.5;
const TARGET_DISPLAY_SIZE = 72;
const ROUND_MS = 20000;

function TrackingTest({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('aim-tracking-test');

  const [running, setRunning] = useState(false);
  const [runComplete, setRunComplete] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [timeInsideMs, setTimeInsideMs] = useState(0);
  const [targetPercent, setTargetPercent] = useState({ x: 50, y: 50 });
  const [isInside, setIsInside] = useState(false);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const runStartRef = useRef<number>(0);
  const elapsedRef = useRef(0);
  const timeInsideRef = useRef(0);
  const insideRef = useRef(false);

  const angleRef = useRef(0);
  const radiusXRef = useRef(32);
  const radiusYRef = useRef(28);
  const centerRef = useRef({ x: 50, y: 50 });

  const pointerInArenaRef = useRef(false);
  const pointerPercentRef = useRef<{ x: number; y: number } | null>(null);
  const savedRunRef = useRef(false);
  const targetPosRef = useRef({ x: 50, y: 50 });
  const prevTsRef = useRef<number | null>(null);

  const accuracyPercent = ROUND_MS > 0 ? Math.round((timeInsideMs / ROUND_MS) * 100) : 0;
  const labScore = accuracyPercent * 10;

  const resolveFromClient = useCallback((cx: number, cy: number) => {
    const arena = arenaRef.current;
    if (!arena) return null;
    const rect = arena.getBoundingClientRect();
    const rx = cx - rect.left;
    const ry = cy - rect.top;
    const insideArena = rx >= 0 && rx <= rect.width && ry >= 0 && ry <= rect.height;
    pointerInArenaRef.current = insideArena;
    if (!insideArena) {
      pointerPercentRef.current = null;
      return null;
    }
    const pct = {
      x: (rx / rect.width) * 100,
      y: (ry / rect.height) * 100,
    };
    pointerPercentRef.current = pct;
    return pct;
  }, []);

  const checkCollision = useCallback((px: number, py: number, tx: number, ty: number) => {
    const dist = Math.hypot(px - tx, py - ty);
    return dist < TARGET_RADIUS_PERCENT;
  }, []);

  useEffect(() => {
    if (!running) return;

    const pointerHandler = (e: PointerEvent) => {
      const pct = resolveFromClient(e.clientX, e.clientY);
      if (!pct) {
        insideRef.current = false;
        setIsInside(false);
        return;
      }
      const colliding = checkCollision(pct.x, pct.y, targetPosRef.current.x, targetPosRef.current.y);
      insideRef.current = colliding;
      setIsInside(colliding);
    };
    window.addEventListener('pointermove', pointerHandler, { passive: true });

    const step = (ts: number) => {
      if (prevTsRef.current === null) {
        prevTsRef.current = ts;
        frameIdRef.current = requestAnimationFrame(step);
        return;
      }
      const dt = Math.min(ts - prevTsRef.current, 50);
      prevTsRef.current = ts;

      elapsedRef.current = ts - runStartRef.current;
      const remaining = Math.max(0, ROUND_MS - elapsedRef.current);
      const progress = Math.min(1, elapsedRef.current / ROUND_MS);
      setSecondsLeft(Math.ceil(remaining / 1000));

      if (insideRef.current) {
        timeInsideRef.current = Math.min(ROUND_MS, timeInsideRef.current + dt);
        setTimeInsideMs(timeInsideRef.current);
      }

      // Speed ramps from 0.6 → 3.0 over the run — faster at the end
      const baseSpeed = 0.6;
      const maxSpeed = 3.0;
      const angularSpeed = baseSpeed + progress * (maxSpeed - baseSpeed);

      angleRef.current += angularSpeed * (dt / 1000);

      // Multiple wobble layers for chaotic, less predictable motion
      const wobbleAmp = 4 + progress * 10;
      const mainWobble = Math.sin(angleRef.current * 1.7) * wobbleAmp * progress;
      const fastWobble = Math.sin(angleRef.current * 3.2) * 4 * progress;
      const jitter = Math.cos(angleRef.current * 5.1) * 2.5 * progress;
      const erratic = Math.sin(angleRef.current * 0.9 + progress * 8) * 3 * progress;

      // Center slowly drifts in a pseudo-random walk so the target doesn't orbit a fixed point
      const driftRate = 0.2 + progress * 0.5;
      centerRef.current.x += Math.sin(angleRef.current * 0.37 + 1.2) * driftRate * (dt / 1000);
      centerRef.current.y += Math.cos(angleRef.current * 0.53 + 0.8) * driftRate * (dt / 1000);
      centerRef.current.x = Math.min(70, Math.max(30, centerRef.current.x));
      centerRef.current.y = Math.min(70, Math.max(30, centerRef.current.y));

      // Radius pulses to further vary the path shape
      const pulse = 1 + 0.35 * Math.sin(angleRef.current * 0.25);
      const currentRadiusX = radiusXRef.current * pulse;
      const currentRadiusY = radiusYRef.current * pulse;

      const totalWobbleX = mainWobble + fastWobble + jitter + erratic;
      const totalWobbleY = mainWobble * 0.6 + fastWobble * 0.4 + jitter * 0.7 + erratic * 0.5;

      let nx = centerRef.current.x + Math.cos(angleRef.current) * (currentRadiusX + totalWobbleX);
      let ny = centerRef.current.y + Math.sin(angleRef.current * 0.85) * (currentRadiusY + totalWobbleY);

      const margin = 10;
      nx = Math.min(100 - margin, Math.max(margin, nx));
      ny = Math.min(100 - margin, Math.max(margin, ny));

      targetPosRef.current = { x: nx, y: ny };
      setTargetPercent({ x: nx, y: ny });

      const ptr = pointerPercentRef.current;
      if (ptr) {
        const coll = checkCollision(ptr.x, ptr.y, nx, ny);
        insideRef.current = coll;
        setIsInside(coll);
      }

      if (elapsedRef.current >= ROUND_MS) {
        insideRef.current = false;
        setIsInside(false);
        setRunning(false);
        setRunComplete(true);

        if (isSignedIn && !savedRunRef.current) {
          savedRunRef.current = true;
          const finalMs = timeInsideRef.current;
          const finalScore = Math.round((finalMs / ROUND_MS) * 1000);
          void (async () => {
            const res = await fetch('/api/scores/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ testSlug: 'aim-tracking-test', score: finalScore, ...multiplayerMeta }),
            });
            if (res.ok && isMultiplayerSession) goToIntermission();
          })();
        }
        return;
      }

      frameIdRef.current = requestAnimationFrame(step);
    };

    prevTsRef.current = null;
    frameIdRef.current = requestAnimationFrame(step);

    return () => {
      window.removeEventListener('pointermove', pointerHandler);
      if (frameIdRef.current !== null) cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    };
  }, [running, resolveFromClient, checkCollision, isSignedIn]);

  const startRun = useCallback((initPtr: { x: number; y: number } | null = null) => {
    savedRunRef.current = false;
    setRunning(true);
    setRunComplete(false);
    setSecondsLeft(20);
    setTimeInsideMs(0);
    setIsInside(false);
    timeInsideRef.current = 0;
    insideRef.current = false;
    pointerPercentRef.current = initPtr;
    pointerInArenaRef.current = initPtr !== null;
    elapsedRef.current = 0;
    runStartRef.current = performance.now();
    angleRef.current = Math.random() * Math.PI * 2;
    radiusXRef.current = 28 + Math.random() * 12;
    radiusYRef.current = 22 + Math.random() * 10;
    centerRef.current = { x: 50, y: 50 };
    setTargetPercent({ x: 50, y: 50 });
  }, []);

  const handleArenaPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (running) return;
    const pct = resolveFromClient(e.clientX, e.clientY);
    startRun(pct);
  }, [running, resolveFromClient, startRun]);

  return (
    <MouseShell
      title={MODE_META.tracking.title}
      kicker={MODE_META.tracking.kicker}
      description="Keep your pointer inside the moving target. Touch also works on mobile."
      accent={MODE_META.tracking.accent}
      isSignedIn={isSignedIn}
      stats={[
        { label: 'Seconds left', value: `${secondsLeft}s`, detail: 'The tracking window lasts exactly 20 seconds.' },
        { label: 'Time on target', value: `${(timeInsideMs / 1000).toFixed(2)}s`, detail: 'Total time your pointer stayed inside the target.' },
        { label: 'Accuracy', value: `${accuracyPercent}%`, detail: 'Percentage of the 20-second window spent on target.' },
        { label: 'Lab score', value: String(labScore), detail: '0–1000 scale based on tracking accuracy.' },
        { label: 'Status', value: running ? 'Live' : runComplete ? 'Done' : 'Ready', detail: running ? 'Keep your pointer inside the moving target.' : runComplete ? 'Run complete. Tap to try again.' : 'Tap anywhere in the arena to begin.' },
      ]}
    >
      <div className="space-y-4">
        {running && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-300 ease-linear"
              style={{ width: `${((ROUND_MS - secondsLeft * 1000) / ROUND_MS) * 100}%` }}
            />
          </div>
        )}

        <div
          ref={arenaRef}
          className="relative min-h-[18rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-4 sm:min-h-[26rem] touch-none select-none"
          onPointerDown={handleArenaPointerDown}
        >
          <div
            className={`absolute flex items-center justify-center rounded-full border-0 transition-[box-shadow] duration-100 ${running ? 'pointer-events-none' : 'pointer-events-auto'}`}
            style={{
              left: `${targetPercent.x}%`,
              top: `${targetPercent.y}%`,
              width: TARGET_DISPLAY_SIZE,
              height: TARGET_DISPLAY_SIZE,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className={`relative flex h-full w-full items-center justify-center rounded-full border-[6px] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.14)] transition-colors duration-150 ${
                isInside ? 'border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.4)]' : 'border-indigo-500'
              }`}
            >
              <span className={`absolute h-[54px] w-[54px] rounded-full border-[6px] border-white transition-colors duration-150 ${isInside ? 'bg-emerald-400' : 'bg-indigo-500'}`} />
              <span className={`absolute h-[32px] w-[32px] rounded-full border-[5px] border-white transition-colors duration-150 ${isInside ? 'bg-emerald-200' : 'bg-indigo-300'}`} />
              <span className={`absolute h-[12px] w-[12px] rounded-full border-2 border-white transition-colors duration-150 ${isInside ? 'bg-emerald-600' : 'bg-indigo-700'}`} />
            </span>
          </div>

          {!running && !runComplete && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <span className="rounded-full border-2 border-slate-200 bg-white/90 px-5 py-2.5 text-sm font-bold uppercase tracking-[0.2em] text-slate-500 shadow-sm">
                Tap to start
              </span>
            </div>
          )}

          {runComplete && !running && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <div className="mx-4 w-full max-w-xs rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-slate-800">{labScore}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Time on target: {(timeInsideMs / 1000).toFixed(2)}s ({accuracyPercent}%)
                </p>
                <button
                  className="mt-4 rounded-2xl border-b-4 border-indigo-700 bg-indigo-600 px-6 py-3 font-bold text-white transition-all duration-150 hover:-translate-y-1 hover:border-indigo-600 hover:bg-indigo-500 active:translate-y-1 active:border-b-0"
                  onClick={(e) => { e.stopPropagation(); startRun(); }}
                  type="button"
                >
                  Start New Run
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MouseShell>
  );
}

export function MouseProtocols({ initialCpsDuration = 10, initialTraceMode = 'assist', mode, isSignedIn }: MouseProtocolsProps) {
  if (mode === 'tracking') {
    return <TrackingTest isSignedIn={isSignedIn} />;
  }

  if (mode === 'cps') {
    return <CpsTester initialDuration={initialCpsDuration} isSignedIn={isSignedIn} />;
  }

  return <SymbolTracing initialTraceMode={initialTraceMode} isSignedIn={isSignedIn} />;
}
