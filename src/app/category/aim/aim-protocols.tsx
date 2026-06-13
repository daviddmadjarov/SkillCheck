'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';

import { reactionMsToLeaderboardScore } from '@/lib/scoring/reaction';

type AimMode = 'trainer' | 'moving' | 'tracking' | 'split';

type AimProtocolsProps = {
  mode: AimMode;
  isSignedIn: boolean;
};

type AimShellProps = {
  title: string;
  kicker: string;
  description: string;
  accent: string;
  isSignedIn: boolean;
  stats: Array<{ label: string; value: string; detail: string }>;
  children: ReactNode;
};

type Point = { x: number; y: number };

type SplitShapeKey = string;
type SplitHandle = 'left' | 'right';
type SplitShape = {
  key: SplitShapeKey;
  label: string;
  stroke: string;
  fill: string;
  svgPath?: string;
  points: Point[];
  defaultLeft: number;
  defaultRight: number;
};

const MODE_META: Record<AimMode, { title: string; kicker: string; description: string; accent: string }> = {
  trainer: {
    title: 'Aim Trainer',
    kicker: 'Precision warm-up',
    description: 'Click the target where it appears. Twenty-five hits complete the drill.',
    accent: 'border-cyan-200 bg-cyan-50 text-cyan-900',
  },
  moving: {
    title: 'Moving Targets',
    kicker: 'Motion reading',
    description: 'Chase the drifting target before it relocates.',
    accent: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  tracking: {
    title: 'Tracking Test',
    kicker: 'Cursor control',
    description: 'Keep your pointer inside the moving target for the full run.',
    accent: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  },
  split: {
    title: 'Perfect Split',
    kicker: 'Geometric precision',
    description: 'Move two points around the border and split the shape as evenly as possible.',
    accent: 'border-amber-200 bg-amber-50 text-amber-900',
  },
};

const SPLIT_SHAPES: SplitShape[] = [
  {
    key: 'koralle',
    label: 'Coral',
    stroke: '#ea580c',
    fill: '#fed7aa',
    defaultLeft: 0.08,
    defaultRight: 0.56,
    svgPath: 'M48 83 C44 72 44 64 46 56 C39 59 32 58 26 54 C31 49 37 47 45 48 C40 41 39 34 41 26 C48 30 51 36 53 44 C56 34 61 27 69 24 C70 33 67 40 62 47 C70 46 77 48 83 53 C77 58 70 59 63 56 C65 65 64 74 60 84 Z',
    points: [
      { x: 41, y: 26 }, { x: 48, y: 31 }, { x: 52, y: 45 }, { x: 58, y: 31 }, { x: 69, y: 24 }, { x: 66, y: 44 }, { x: 83, y: 53 },
      { x: 65, y: 56 }, { x: 60, y: 84 }, { x: 48, y: 83 }, { x: 46, y: 56 }, { x: 26, y: 54 }, { x: 45, y: 48 },
    ],
  },
  {
    key: 'alge',
    label: 'Seaweed',
    stroke: '#15803d',
    fill: '#bbf7d0',
    defaultLeft: 0.07,
    defaultRight: 0.61,
    svgPath: 'M42 86 C38 71 39 57 43 43 C46 31 53 21 62 14 C64 27 61 38 56 48 C63 45 70 45 76 49 C68 54 61 56 53 56 C57 64 57 74 53 84 Z',
    points: [
      { x: 42, y: 86 }, { x: 39, y: 64 }, { x: 43, y: 43 }, { x: 50, y: 24 }, { x: 62, y: 14 }, { x: 58, y: 39 }, { x: 76, y: 49 }, { x: 53, y: 56 }, { x: 53, y: 84 },
    ],
  },
  {
    key: 'qualle',
    label: 'Jellyfish',
    stroke: '#7c3aed',
    fill: '#ddd6fe',
    defaultLeft: 0.1,
    defaultRight: 0.57,
    svgPath: 'M24 48 C24 31 36 20 50 20 C65 20 76 31 76 48 C68 51 61 53 54 53 L57 83 L49 83 L48 58 L44 83 L36 83 L40 53 C34 53 29 51 24 48 Z',
    points: [
      { x: 24, y: 48 }, { x: 29, y: 30 }, { x: 43, y: 20 }, { x: 58, y: 21 }, { x: 71, y: 31 }, { x: 76, y: 48 }, { x: 54, y: 53 }, { x: 57, y: 83 }, { x: 49, y: 83 }, { x: 48, y: 58 }, { x: 44, y: 83 }, { x: 36, y: 83 }, { x: 40, y: 53 },
    ],
  },
  {
    key: 'muschel',
    label: 'Shell',
    stroke: '#0f766e',
    fill: '#ccfbf1',
    defaultLeft: 0.12,
    defaultRight: 0.59,
    svgPath: 'M50 12 L55 22 L60 25 L63 18 L68 32 L70 28 L75 38 L76 32 L80 45 L77 40 L78 55 L74 48 L68 65 L50 70 L32 65 L26 48 L23 55 L20 40 L24 45 L20 32 L25 38 L27 28 L32 32 L35 18 L40 25 L45 22 Z',
    points: [
      { x: 50, y: 12 }, { x: 68, y: 32 }, { x: 80, y: 45 }, { x: 78, y: 55 }, { x: 68, y: 65 }, { x: 50, y: 70 }, { x: 32, y: 65 }, { x: 20, y: 40 }, { x: 24, y: 45 }, { x: 32, y: 32 },
    ],
  },
  {
    key: 'tannenzapfen',
    label: 'Pinecone',
    stroke: '#92400e',
    fill: '#d6b38a',
    defaultLeft: 0.09,
    defaultRight: 0.55,
    svgPath: 'M50 16 C62 24 70 40 69 57 C68 70 60 80 50 84 C40 80 32 70 31 57 C30 40 38 24 50 16 Z',
    points: [
      { x: 50, y: 16 }, { x: 61, y: 25 }, { x: 68, y: 40 }, { x: 69, y: 57 }, { x: 63, y: 74 }, { x: 50, y: 84 }, { x: 37, y: 74 }, { x: 31, y: 57 }, { x: 32, y: 40 }, { x: 39, y: 25 },
    ],
  },
  {
    key: 'kaktus',
    label: 'Cactus',
    stroke: '#15803d',
    fill: '#86efac',
    defaultLeft: 0.08,
    defaultRight: 0.53,
    svgPath: 'M39 84 L39 58 C30 58 24 51 24 42 C24 34 29 28 35 28 C39 28 42 32 42 37 L42 25 C42 18 46 14 50 14 C55 14 58 18 58 25 L58 47 C58 40 61 35 67 35 C74 35 79 42 79 50 C79 58 73 64 64 64 L64 84 Z',
    points: [
      { x: 39, y: 84 }, { x: 39, y: 58 }, { x: 29, y: 58 }, { x: 24, y: 48 }, { x: 26, y: 34 }, { x: 35, y: 28 }, { x: 42, y: 37 }, { x: 42, y: 25 }, { x: 50, y: 14 }, { x: 58, y: 25 }, { x: 58, y: 47 }, { x: 67, y: 35 }, { x: 79, y: 50 }, { x: 74, y: 62 }, { x: 64, y: 64 }, { x: 64, y: 84 },
    ],
  },
  {
    key: 'bonsai',
    label: 'Bonsai Silhouette',
    stroke: '#166534',
    fill: '#bbf7d0',
    defaultLeft: 0.07,
    defaultRight: 0.58,
    svgPath: 'M24 60 C23 48 32 38 43 36 C44 28 50 22 59 22 C68 22 75 28 77 36 C84 38 88 44 88 52 C88 61 81 68 70 69 L59 69 L59 84 L41 84 L41 69 L33 69 C28 69 24 65 24 60 Z',
    points: [
      { x: 24, y: 60 }, { x: 28, y: 44 }, { x: 43, y: 36 }, { x: 46, y: 26 }, { x: 59, y: 22 }, { x: 73, y: 30 }, { x: 88, y: 52 }, { x: 82, y: 66 }, { x: 59, y: 69 }, { x: 59, y: 84 }, { x: 41, y: 84 }, { x: 41, y: 69 }, { x: 28, y: 68 },
    ],
  },
  {
    key: 'ast',
    label: 'Branch with Twigs',
    stroke: '#92400e',
    fill: '#d7b899',
    defaultLeft: 0.05,
    defaultRight: 0.6,
    svgPath: 'M18 62 C31 60 41 55 51 48 C59 42 67 33 75 20 C76 31 73 39 67 47 C75 47 82 49 88 54 C79 58 70 59 61 57 C53 64 44 69 34 73 C27 76 22 74 18 70 Z',
    points: [
      { x: 18, y: 62 }, { x: 36, y: 58 }, { x: 51, y: 48 }, { x: 67, y: 32 }, { x: 75, y: 20 }, { x: 74, y: 44 }, { x: 88, y: 54 }, { x: 61, y: 57 }, { x: 34, y: 73 }, { x: 20, y: 70 },
    ],
  },
  {
    key: 'baumwurzel',
    label: 'Tree Root',
    stroke: '#78350f',
    fill: '#e7c7a2',
    defaultLeft: 0.08,
    defaultRight: 0.56,
    svgPath: 'M44 18 L56 18 L58 40 L71 55 L66 60 L58 53 L57 78 L49 78 L49 56 L40 75 L33 72 L41 50 L28 63 L22 57 L39 41 Z',
    points: [
      { x: 44, y: 18 }, { x: 56, y: 18 }, { x: 58, y: 40 }, { x: 71, y: 55 }, { x: 66, y: 60 }, { x: 58, y: 53 }, { x: 57, y: 78 }, { x: 49, y: 78 }, { x: 49, y: 56 }, { x: 40, y: 75 }, { x: 33, y: 72 }, { x: 41, y: 50 }, { x: 28, y: 63 }, { x: 22, y: 57 }, { x: 39, y: 41 },
    ],
  },
  {
    key: 'schluessel',
    label: 'Key',
    stroke: '#ca8a04',
    fill: '#fde68a',
    defaultLeft: 0.09,
    defaultRight: 0.58,
    svgPath: 'M36 32 C36 23 43 16 52 16 C61 16 68 23 68 32 C68 39 63 45 56 47 L56 58 L67 58 L67 65 L74 65 L74 72 L56 72 L56 47 C45 47 36 40 36 32 Z',
    points: [
      { x: 36, y: 32 }, { x: 41, y: 20 }, { x: 52, y: 16 }, { x: 63, y: 20 }, { x: 68, y: 32 }, { x: 63, y: 43 }, { x: 56, y: 47 }, { x: 56, y: 58 }, { x: 74, y: 72 }, { x: 56, y: 72 },
    ],
  },
  {
    key: 'regenschirm',
    label: 'Umbrella',
    stroke: '#2563eb',
    fill: '#bfdbfe',
    defaultLeft: 0.11,
    defaultRight: 0.6,
    svgPath: 'M18 47 C23 28 36 18 50 18 C64 18 77 28 82 47 L18 47 Z M50 47 L50 77 C50 83 47 86 42 86 C38 86 35 83 35 79 C38 79 40 78 40 75 C40 71 43 68 47 68 L47 47 Z',
    points: [
      { x: 18, y: 47 }, { x: 26, y: 30 }, { x: 39, y: 20 }, { x: 50, y: 18 }, { x: 61, y: 20 }, { x: 74, y: 30 }, { x: 82, y: 47 }, { x: 50, y: 47 }, { x: 50, y: 77 }, { x: 42, y: 86 }, { x: 35, y: 79 }, { x: 47, y: 68 },
    ],
  },
  {
    key: 'giesskanne',
    label: 'Watering Can',
    stroke: '#0284c7',
    fill: '#bae6fd',
    defaultLeft: 0.09,
    defaultRight: 0.54,
    svgPath: 'M26 66 L29 34 L56 34 L63 44 L74 44 L86 36 L78 51 L77 66 Z M26 66 C18 66 16 58 20 51 C22 47 26 45 32 46',
    points: [
      { x: 26, y: 66 }, { x: 29, y: 34 }, { x: 56, y: 34 }, { x: 63, y: 44 }, { x: 74, y: 44 }, { x: 86, y: 36 }, { x: 78, y: 51 }, { x: 77, y: 66 }, { x: 20, y: 51 }, { x: 26, y: 45 },
    ],
  },
  {
    key: 'teekanne',
    label: 'Teapot',
    stroke: '#9333ea',
    fill: '#e9d5ff',
    defaultLeft: 0.12,
    defaultRight: 0.57,
    svgPath: 'M28 52 C28 40 37 32 50 32 C63 32 72 40 72 52 L72 68 C72 76 67 82 60 84 L40 84 C33 82 28 76 28 68 Z M38 25 C38 22 42 19 50 19 C58 19 62 22 62 25 L60 32 C58 31 54 30 50 30 C46 30 42 31 40 32 Z M72 48 C80 49 86 52 86 59 C86 65 80 68 72 68 M22 60 L14 62 C12 60 12 56 14 54 L22 56 Z',
    points: [
      { x: 28, y: 52 }, { x: 33, y: 38 }, { x: 44, y: 32 }, { x: 56, y: 32 }, { x: 67, y: 38 }, { x: 72, y: 52 }, { x: 72, y: 68 }, { x: 60, y: 84 }, { x: 40, y: 84 }, { x: 28, y: 68 }, { x: 50, y: 19 }, { x: 62, y: 25 }, { x: 86, y: 59 }, { x: 72, y: 68 }, { x: 14, y: 54 },
    ],
  },
  {
    key: 'hammer',
    label: 'Hammer',
    stroke: '#78350f',
    fill: '#d97706',
    defaultLeft: 0.08,
    defaultRight: 0.55,
    svgPath: 'M25 22 L65 22 L70 26 L72 34 L70 38 L65 40 L60 38 L60 50 L58 72 L54 76 L46 76 L42 72 L42 50 L30 45 L25 36 Z M42 50 L60 50',
    points: [
      { x: 25, y: 22 }, { x: 65, y: 22 }, { x: 72, y: 34 }, { x: 70, y: 38 }, { x: 60, y: 38 }, { x: 60, y: 50 }, { x: 58, y: 72 }, { x: 54, y: 76 }, { x: 46, y: 76 }, { x: 42, y: 72 }, { x: 42, y: 50 }, { x: 30, y: 45 },
    ],
  },
  {
    key: 'gluehbirne',
    label: 'Light Bulb',
    stroke: '#ca8a04',
    fill: '#fef3c7',
    defaultLeft: 0.11,
    defaultRight: 0.59,
    svgPath: 'M50 18 C64 18 75 29 75 42 C75 52 69 60 61 66 L61 77 L39 77 L39 66 C31 60 25 52 25 42 C25 29 36 18 50 18 Z M41 81 L59 81 L59 86 L41 86 Z',
    points: [
      { x: 25, y: 42 }, { x: 31, y: 27 }, { x: 45, y: 18 }, { x: 58, y: 18 }, { x: 71, y: 27 }, { x: 75, y: 42 }, { x: 69, y: 59 }, { x: 61, y: 66 }, { x: 61, y: 77 }, { x: 39, y: 77 }, { x: 39, y: 66 }, { x: 31, y: 59 }, { x: 41, y: 86 }, { x: 59, y: 86 },
    ],
  },
  {
    key: 'kerze',
    label: 'Candle',
    stroke: '#0f172a',
    fill: '#fef3c7',
    defaultLeft: 0.08,
    defaultRight: 0.53,
    svgPath: 'M41 30 L59 30 L59 81 L41 81 Z M50 16 C55 21 56 26 50 30 C44 26 45 21 50 16 Z',
    points: [
      { x: 41, y: 30 }, { x: 59, y: 30 }, { x: 59, y: 81 }, { x: 41, y: 81 }, { x: 50, y: 16 }, { x: 56, y: 27 }, { x: 50, y: 30 }, { x: 44, y: 27 },
    ],
  },
  {
    key: 'trophaee',
    label: 'Trophy',
    stroke: '#ca8a04',
    fill: '#fde68a',
    defaultLeft: 0.09,
    defaultRight: 0.56,
    svgPath: 'M30 24 L70 24 L67 42 C65 50 59 55 53 57 L53 69 L63 74 L63 80 L37 80 L37 74 L47 69 L47 57 C41 55 35 50 33 42 Z M30 28 C22 28 18 33 18 40 C18 47 23 52 30 52 M70 28 C78 28 82 33 82 40 C82 47 77 52 70 52',
    points: [
      { x: 30, y: 24 }, { x: 70, y: 24 }, { x: 67, y: 42 }, { x: 59, y: 55 }, { x: 53, y: 57 }, { x: 53, y: 69 }, { x: 63, y: 74 }, { x: 63, y: 80 }, { x: 37, y: 80 }, { x: 37, y: 74 }, { x: 47, y: 69 }, { x: 47, y: 57 }, { x: 33, y: 42 }, { x: 18, y: 40 }, { x: 30, y: 52 }, { x: 82, y: 40 }, { x: 70, y: 52 },
    ],
  },
  {
    key: 'trankflasche',
    label: 'Potion Bottle',
    stroke: '#7c3aed',
    fill: '#ddd6fe',
    defaultLeft: 0.11,
    defaultRight: 0.58,
    svgPath: 'M42 18 L58 18 L58 32 L67 45 L67 69 C67 78 60 84 50 84 C40 84 33 78 33 69 L33 45 L42 32 Z',
    points: [
      { x: 42, y: 18 }, { x: 58, y: 18 }, { x: 58, y: 32 }, { x: 67, y: 45 }, { x: 67, y: 69 }, { x: 60, y: 84 }, { x: 40, y: 84 }, { x: 33, y: 69 }, { x: 33, y: 45 }, { x: 42, y: 32 },
    ],
  },
  {
    key: 'zauberstab',
    label: 'Magic Wand',
    stroke: '#7c3aed',
    fill: '#e9d5ff',
    defaultLeft: 0.07,
    defaultRight: 0.61,
    svgPath: 'M70 18 L73 27 L82 27 L75 33 L78 42 L70 36 L62 42 L65 33 L58 27 L67 27 Z M24 76 L67 33 L72 38 L29 81 Z',
    points: [
      { x: 70, y: 18 }, { x: 73, y: 27 }, { x: 82, y: 27 }, { x: 75, y: 33 }, { x: 78, y: 42 }, { x: 70, y: 36 }, { x: 62, y: 42 }, { x: 58, y: 27 }, { x: 67, y: 27 }, { x: 24, y: 76 }, { x: 67, y: 33 }, { x: 72, y: 38 }, { x: 29, y: 81 },
    ],
  },
  {
    key: 'schatztruhe',
    label: 'Treasure Chest',
    stroke: '#92400e',
    fill: '#fcd34d',
    defaultLeft: 0.09,
    defaultRight: 0.56,
    svgPath: 'M24 44 C24 31 35 22 50 22 C65 22 76 31 76 44 L76 76 L24 76 Z M24 44 L76 44',
    points: [
      { x: 24, y: 44 }, { x: 28, y: 30 }, { x: 39, y: 22 }, { x: 50, y: 22 }, { x: 61, y: 22 }, { x: 72, y: 30 }, { x: 76, y: 44 }, { x: 76, y: 76 }, { x: 24, y: 76 },
    ],
  },
  {
    key: 'kristall',
    label: 'Crystal',
    stroke: '#0ea5e9',
    fill: '#bae6fd',
    defaultLeft: 0.08,
    defaultRight: 0.54,
    svgPath: 'M50 12 L60 20 L64 16 L70 28 L68 35 L80 42 L75 48 L85 58 L78 62 L82 72 L60 80 L55 75 L58 85 L40 85 L43 75 L40 80 L18 72 L22 62 L15 58 L25 48 L20 42 L32 35 L30 28 L36 16 L40 20 Z',
    points: [
      { x: 50, y: 12 }, { x: 70, y: 28 }, { x: 80, y: 42 }, { x: 85, y: 58 }, { x: 82, y: 72 }, { x: 60, y: 80 }, { x: 40, y: 85 }, { x: 18, y: 72 }, { x: 15, y: 58 }, { x: 25, y: 48 }, { x: 20, y: 42 }, { x: 32, y: 35 }, { x: 36, y: 16 },
    ],
  },
  {
    key: 'alien',
    label: 'Alien Head',
    stroke: '#4d7c0f',
    fill: '#d9f99d',
    defaultLeft: 0.11,
    defaultRight: 0.56,
    svgPath: 'M50 16 C62 16 72 24 76 35 L80 38 C82 40 82 44 80 46 L75 48 C77 56 78 66 72 78 L68 80 C65 82 62 80 60 78 C58 81 54 84 50 84 C46 84 42 81 40 78 C38 80 35 82 32 80 L28 78 C22 66 23 56 25 48 L20 46 C18 44 18 40 20 38 L24 35 C28 24 38 16 50 16 Z M40 40 C36 40 33 44 33 48 C33 52 36 56 40 56 C44 56 47 52 47 48 C47 44 44 40 40 40 Z M60 40 C56 40 53 44 53 48 C53 52 56 56 60 56 C64 56 67 52 67 48 C67 44 64 40 60 40 Z',
    points: [
      { x: 50, y: 16 }, { x: 76, y: 35 }, { x: 80, y: 46 }, { x: 72, y: 78 }, { x: 50, y: 84 }, { x: 28, y: 78 }, { x: 20, y: 46 }, { x: 24, y: 35 }, { x: 40, y: 56 }, { x: 60, y: 56 },
    ],
  },
  {
    key: 'raumschiff',
    label: 'Spaceship',
    stroke: '#0f172a',
    fill: '#cbd5e1',
    defaultLeft: 0.09,
    defaultRight: 0.59,
    svgPath: 'M17 60 C24 43 36 33 50 29 C64 33 76 43 83 60 C74 64 65 66 56 66 L50 79 L44 66 C35 66 26 64 17 60 Z',
    points: [
      { x: 17, y: 60 }, { x: 26, y: 43 }, { x: 38, y: 33 }, { x: 50, y: 29 }, { x: 62, y: 33 }, { x: 74, y: 43 }, { x: 83, y: 60 }, { x: 68, y: 66 }, { x: 56, y: 66 }, { x: 50, y: 79 }, { x: 44, y: 66 }, { x: 32, y: 66 },
    ],
  },
  {
    key: 'meteorit',
    label: 'Meteorite',
    stroke: '#92400e',
    fill: '#d6b38a',
    defaultLeft: 0.08,
    defaultRight: 0.54,
    svgPath: 'M28 75 L18 56 L25 36 L43 22 L63 24 L80 38 L84 58 L71 76 L49 82 Z',
    points: [
      { x: 18, y: 56 }, { x: 25, y: 36 }, { x: 43, y: 22 }, { x: 63, y: 24 }, { x: 80, y: 38 }, { x: 84, y: 58 }, { x: 71, y: 76 }, { x: 49, y: 82 }, { x: 28, y: 75 },
    ],
  },
  {
    key: 'dungeon',
    label: 'Dungeon Room',
    stroke: '#334155',
    fill: '#cbd5e1',
    defaultLeft: 0.07,
    defaultRight: 0.55,
    svgPath: 'M24 24 L76 24 L76 43 L66 43 L66 57 L76 57 L76 76 L24 76 L24 57 L34 57 L34 43 L24 43 Z',
    points: [
      { x: 24, y: 24 }, { x: 76, y: 24 }, { x: 76, y: 43 }, { x: 66, y: 43 }, { x: 66, y: 57 }, { x: 76, y: 57 }, { x: 76, y: 76 }, { x: 24, y: 76 }, { x: 24, y: 57 }, { x: 34, y: 57 }, { x: 34, y: 43 }, { x: 24, y: 43 },
    ],
  },
  {
    key: 'tintenfleck',
    label: 'Ink Blot',
    stroke: '#1e293b',
    fill: '#cbd5e1',
    defaultLeft: 0.13,
    defaultRight: 0.61,
    svgPath: 'M29 74 C19 69 17 57 24 49 C17 42 20 30 31 28 C34 19 44 15 53 18 C60 13 71 15 76 23 C86 24 91 34 87 44 C92 50 92 60 86 67 C79 75 68 78 58 75 C49 80 38 80 29 74 Z',
    points: [
      { x: 24, y: 49 }, { x: 20, y: 34 }, { x: 31, y: 28 }, { x: 44, y: 15 }, { x: 53, y: 18 }, { x: 71, y: 15 }, { x: 87, y: 44 }, { x: 86, y: 67 }, { x: 68, y: 78 }, { x: 49, y: 80 }, { x: 29, y: 74 }, { x: 17, y: 57 },
    ],
  },
  {
    key: 'farbklecks',
    label: 'Paint Splatter',
    stroke: '#be185d',
    fill: '#fbcfe8',
    defaultLeft: 0.12,
    defaultRight: 0.6,
    svgPath: 'M22 59 C22 46 31 36 43 36 C45 25 54 19 63 22 C70 18 79 22 82 31 C89 35 92 45 88 53 C90 62 85 72 74 75 C66 81 55 82 46 77 C34 78 25 71 22 59 Z',
    points: [
      { x: 22, y: 59 }, { x: 26, y: 42 }, { x: 43, y: 36 }, { x: 48, y: 24 }, { x: 63, y: 22 }, { x: 82, y: 31 }, { x: 88, y: 53 }, { x: 84, y: 70 }, { x: 66, y: 81 }, { x: 46, y: 77 }, { x: 28, y: 71 },
    ],
  },
  {
    key: 'amoebe',
    label: 'Amoeba',
    stroke: '#0f766e',
    fill: '#ccfbf1',
    defaultLeft: 0.11,
    defaultRight: 0.58,
    svgPath: 'M24 59 C20 48 24 36 34 30 C42 21 54 20 64 25 C75 28 82 39 82 51 C82 64 74 75 62 78 C51 83 38 80 29 72 C24 69 22 64 24 59 Z',
    points: [
      { x: 24, y: 59 }, { x: 24, y: 40 }, { x: 34, y: 30 }, { x: 49, y: 20 }, { x: 64, y: 25 }, { x: 78, y: 36 }, { x: 82, y: 51 }, { x: 78, y: 68 }, { x: 62, y: 78 }, { x: 45, y: 81 }, { x: 29, y: 72 },
    ],
  },
  {
    key: 'fluessigkeitsspritzer',
    label: 'Liquid Splash',
    stroke: '#2563eb',
    fill: '#bfdbfe',
    defaultLeft: 0.08,
    defaultRight: 0.54,
    svgPath: 'M47 18 C54 26 56 34 54 42 C61 39 69 40 75 45 C68 48 61 49 55 49 C60 57 60 66 56 74 C50 69 47 62 46 55 C39 60 31 61 24 59 C30 53 36 50 44 49 C39 42 39 33 47 18 Z',
    points: [
      { x: 47, y: 18 }, { x: 54, y: 42 }, { x: 75, y: 45 }, { x: 55, y: 49 }, { x: 56, y: 74 }, { x: 46, y: 55 }, { x: 24, y: 59 }, { x: 44, y: 49 },
    ],
  },
  {
    key: 'rauchwolke',
    label: 'Smoke Cloud',
    stroke: '#64748b',
    fill: '#e2e8f0',
    defaultLeft: 0.1,
    defaultRight: 0.58,
    svgPath: 'M27 65 C18 63 14 56 15 49 C16 41 23 36 31 36 C33 28 39 23 47 22 C54 21 60 24 64 29 C67 27 71 26 75 27 C83 29 88 35 88 43 C93 46 95 52 94 58 C92 68 82 74 69 74 L34 74 C31 74 29 70 27 65 Z',
    points: [
      { x: 15, y: 49 }, { x: 23, y: 36 }, { x: 31, y: 36 }, { x: 39, y: 23 }, { x: 47, y: 22 }, { x: 64, y: 29 }, { x: 75, y: 27 }, { x: 88, y: 43 }, { x: 94, y: 58 }, { x: 82, y: 74 }, { x: 34, y: 74 }, { x: 20, y: 67 },
    ],
  },
  {
    key: 'puzzle',
    label: 'Puzzle Piece',
    stroke: '#2563eb',
    fill: '#dbeafe',
    defaultLeft: 0.08,
    defaultRight: 0.54,
    svgPath: 'M29 26 L45 26 C45 21 49 17 54 17 C59 17 63 21 63 26 L76 26 L76 43 C81 43 85 47 85 52 C85 57 81 61 76 61 L76 74 L58 74 C58 69 54 65 49 65 C44 65 40 69 40 74 L24 74 L24 58 C19 58 15 54 15 49 C15 44 19 40 24 40 L24 31 Z',
    points: [
      { x: 29, y: 26 }, { x: 45, y: 26 }, { x: 54, y: 17 }, { x: 63, y: 26 }, { x: 76, y: 26 }, { x: 76, y: 43 }, { x: 85, y: 52 }, { x: 76, y: 61 }, { x: 76, y: 74 }, { x: 58, y: 74 }, { x: 49, y: 65 }, { x: 40, y: 74 }, { x: 24, y: 74 }, { x: 24, y: 58 }, { x: 15, y: 49 }, { x: 24, y: 40 }, { x: 24, y: 31 },
    ],
  },
  {
    key: 'stern',
    label: 'Irregular Star',
    stroke: '#f59e0b',
    fill: '#fde68a',
    defaultLeft: 0.07,
    defaultRight: 0.55,
    svgPath: 'M50 17 L59 34 L79 31 L66 47 L76 67 L56 61 L47 82 L40 60 L21 66 L33 47 L19 31 L40 34 Z',
    points: [
      { x: 50, y: 17 }, { x: 59, y: 34 }, { x: 79, y: 31 }, { x: 66, y: 47 }, { x: 76, y: 67 }, { x: 56, y: 61 }, { x: 47, y: 82 }, { x: 40, y: 60 }, { x: 21, y: 66 }, { x: 33, y: 47 }, { x: 19, y: 31 }, { x: 40, y: 34 },
    ],
  },
  {
    key: 'fraktal',
    label: 'Fractal Form',
    stroke: '#7c3aed',
    fill: '#e9d5ff',
    defaultLeft: 0.06,
    defaultRight: 0.57,
    svgPath: 'M50 18 L58 30 L71 27 L67 39 L80 43 L69 50 L76 61 L63 62 L60 76 L50 66 L40 76 L37 62 L24 61 L31 50 L20 43 L33 39 L29 27 L42 30 Z',
    points: [
      { x: 50, y: 18 }, { x: 58, y: 30 }, { x: 71, y: 27 }, { x: 67, y: 39 }, { x: 80, y: 43 }, { x: 69, y: 50 }, { x: 76, y: 61 }, { x: 63, y: 62 }, { x: 60, y: 76 }, { x: 50, y: 66 }, { x: 40, y: 76 }, { x: 37, y: 62 }, { x: 24, y: 61 }, { x: 31, y: 50 }, { x: 20, y: 43 }, { x: 33, y: 39 }, { x: 29, y: 27 }, { x: 42, y: 30 },
    ],
  },
  {
    key: 'blob',
    label: 'Random Blob',
    stroke: '#0f766e',
    fill: '#ccfbf1',
    defaultLeft: 0.13,
    defaultRight: 0.61,
    svgPath: 'M25 59 C21 47 25 33 36 27 C45 20 58 20 67 26 C78 29 84 40 84 52 C84 64 77 75 66 79 C56 84 43 84 33 77 C27 73 23 67 25 59 Z',
    points: [
      { x: 25, y: 59 }, { x: 24, y: 40 }, { x: 36, y: 27 }, { x: 51, y: 20 }, { x: 67, y: 26 }, { x: 80, y: 37 }, { x: 84, y: 52 }, { x: 80, y: 70 }, { x: 66, y: 79 }, { x: 49, y: 84 }, { x: 33, y: 77 }, { x: 24, y: 66 },
    ],
  },
];

function randomPercent(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function formatMs(value: number | null) {
  return value === null ? '--' : `${value} ms`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPoint(value: number) {
  return Number(value.toFixed(3));
}

function useLabHitSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (audioContextRef.current !== null) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return () => {
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
    master.gain.exponentialRampToValueAtTime(0.25, now + 0.006);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    master.connect(context.destination);

    const toneA = context.createOscillator();
    toneA.type = 'square';
    toneA.frequency.setValueAtTime(1046.5, now);

    const toneB = context.createOscillator();
    toneB.type = 'square';
    toneB.frequency.setValueAtTime(1318.5, now + 0.03);

    const toneAGain = context.createGain();
    toneAGain.gain.setValueAtTime(0.0001, now);
    toneAGain.gain.exponentialRampToValueAtTime(0.22, now + 0.004);
    toneAGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    const toneBGain = context.createGain();
    toneBGain.gain.setValueAtTime(0.0001, now + 0.03);
    toneBGain.gain.exponentialRampToValueAtTime(0.18, now + 0.036);
    toneBGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

    const shimmer = context.createOscillator();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(2093, now);

    const shimmerGain = context.createGain();
    shimmerGain.gain.setValueAtTime(0.0001, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.05, now + 0.004);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1750, now);
    filter.Q.setValueAtTime(1.2, now);

    toneA.connect(toneAGain);
    toneB.connect(toneBGain);
    shimmer.connect(shimmerGain);

    toneAGain.connect(filter);
    toneBGain.connect(filter);
    shimmerGain.connect(filter);
    filter.connect(master);

    toneA.start(now);
    toneB.start(now + 0.03);
    shimmer.start(now);

    toneA.stop(now + 0.1);
    toneB.stop(now + 0.18);
    shimmer.stop(now + 0.08);
  };
}

function useSplitSubmissionSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (audioContextRef.current !== null) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return (balanceScore: number) => {
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

    const highScore = balanceScore >= 90;
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.24, now + 0.006);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    master.connect(context.destination);

    const noteStep = 0.045;
    const noteLength = 0.12;
    const frequencies = highScore
      ? [1174.7, 1318.5, 1568, 1760]
      : [784, 880, 987.8, 1046.5];

    frequencies.forEach((frequency, index) => {
      const start = now + index * noteStep;
      const stop = start + noteLength;

      const oscillator = context.createOscillator();
      oscillator.type = highScore ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);

      const noteGain = context.createGain();
      noteGain.gain.setValueAtTime(0.0001, start);
      noteGain.gain.exponentialRampToValueAtTime(highScore ? 0.16 : 0.14, start + 0.008);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, stop);

      oscillator.connect(noteGain);
      noteGain.connect(master);

      oscillator.start(start);
      oscillator.stop(stop);
    });
  };
}

function AimShell({ title, kicker, description, accent, isSignedIn, stats, children }: AimShellProps) {
  return (
    <section className="lab-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Aim Category</p>
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

function AimTrainer({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('aim-trainer');
  const [target, setTarget] = useState<Point>({ x: 50, y: 50 });
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [bestRun, setBestRun] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [targetVisible, setTargetVisible] = useState(true);
  const [targetSeed, setTargetSeed] = useState(0);
  const playHitSound = useLabHitSound();

  const hitsLeft = Math.max(25 - reactionTimes.length, 0);
  const averageReactionMs = reactionTimes.length > 0 ? Math.round(reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length) : null;
  const isFinished = reactionTimes.length >= 25;
  const currentLabScore = averageReactionMs === null ? null : reactionMsToLeaderboardScore(averageReactionMs);
  const bestLabScore = bestRun === null ? null : reactionMsToLeaderboardScore(bestRun);
  const displayedLabScore = bestLabScore ?? currentLabScore;

  function spawnTarget(nextTarget: Point = { x: randomPercent(18, 82), y: randomPercent(18, 82) }) {
    setTarget(nextTarget);
    setTargetVisible(false);
    setTargetSeed((current) => current + 1);
    requestAnimationFrame(() => setTargetVisible(true));
  }

  function startRun() {
    setReactionTimes([]);
    setRunning(true);
    setStartedAt(performance.now());
    spawnTarget();
  }

  function handleTargetClick() {
    if (!running) {
      startRun();
      return;
    }

    playHitSound();

    const now = performance.now();
    const reaction = startedAt === null ? null : Math.round(now - startedAt);

    if (reaction !== null) {
      const nextTimes = [...reactionTimes, reaction];
      setReactionTimes(nextTimes);
      if (nextTimes.length >= 25) {
        const averageForRun = Math.round(nextTimes.reduce((sum, value) => sum + value, 0) / nextTimes.length);
        setBestRun((currentBest) => (currentBest === null ? averageForRun : Math.min(currentBest, averageForRun)));

        if (isSignedIn) {
          void (async () => {
            const response = await fetch('/api/scores/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                testSlug: 'aim-trainer',
                score: reactionMsToLeaderboardScore(averageForRun),
                ...multiplayerMeta,
              }),
            });

            if (response.ok && isMultiplayerSession) {
              goToIntermission();
            }
          })();
        }

        setRunning(false);
        setStartedAt(null);
        setTargetVisible(false);
        return;
      }
    }

    setStartedAt(now);
    spawnTarget();
  }

  return (
    <AimShell
      title={MODE_META.trainer.title}
      kicker={MODE_META.trainer.kicker}
      description={MODE_META.trainer.description}
      accent={MODE_META.trainer.accent}
      isSignedIn={isSignedIn}
      stats={[
        { label: 'Targets left', value: String(hitsLeft), detail: 'Finish all 25 targets to complete the drill.' },
        { label: 'Average reaction', value: formatMs(averageReactionMs), detail: 'Average across all successful target hits.' },
        { label: 'Lab score', value: displayedLabScore === null ? '--' : String(displayedLabScore), detail: bestRun !== null ? `Best completed average: ${bestRun} ms.` : currentLabScore !== null ? 'Live score based on your current average.' : 'Calculated from your average reaction time.' },
        { label: 'Status', value: isFinished ? 'Done' : !running ? 'Ready' : 'Live', detail: isFinished ? 'Use Try again to run another set.' : !running ? 'Click the center target to begin.' : 'Click each target as it appears.' },
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="cursor-pointer rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">{hitsLeft} targets left</div>
        </div>

        <div className="relative min-h-[24rem] cursor-pointer overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4 sm:min-h-[28rem]">
          <button
            key={targetSeed}
            className={`absolute h-[88px] w-[88px] cursor-pointer rounded-full border-0 bg-transparent transition-[transform,opacity] duration-150 ease-out ${targetVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
            onClick={handleTargetClick}
            type="button"
            style={{ left: `clamp(18px, ${target.x}%, calc(100% - 90px))`, top: `clamp(18px, ${target.y}%, calc(100% - 90px))`, transform: 'translate(-50%, -50%)' }}
          >
            <span className="flex flex-col items-center">
              <span className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border-[8px] border-blue-600 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.12)]">
                <span className="absolute h-[68px] w-[68px] rounded-full border-[8px] border-white bg-blue-600" />
                <span className="absolute h-[42px] w-[42px] rounded-full border-[7px] border-white bg-blue-300" />
                <span className="absolute h-[18px] w-[18px] rounded-full border-4 border-white bg-blue-700" />
              </span>
              {!running && !isFinished && <span className="mt-3 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">CLICK TO START</span>}
            </span>
          </button>

          {isFinished && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="lab-button" onClick={startRun} type="button">Try again</button>
            </div>
          )}
        </div>
      </div>
    </AimShell>
  );
}

function MovingTargets({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('aim-moving-targets');
  const [target, setTarget] = useState<Point>({ x: 50, y: 50 });
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [bestRun, setBestRun] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [targetVisible, setTargetVisible] = useState(true);
  const [targetSeed, setTargetSeed] = useState(0);
  const playHitSound = useLabHitSound();
  const velocityRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  const hitsLeft = Math.max(25 - hits, 0);
  const averageReactionMs = reactionTimes.length > 0 ? Math.round(reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length) : null;
  const currentLabScore = averageReactionMs === null ? null : reactionMsToLeaderboardScore(averageReactionMs);
  const bestLabScore = bestRun === null ? null : reactionMsToLeaderboardScore(bestRun);
  const displayedLabScore = bestLabScore ?? currentLabScore;
  const isFinished = hits >= 25;

  function getRandomVelocity() {
    const angle = Math.random() * Math.PI * 2;
    const speed = 22 + Math.random() * 12;
    return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  }

  function spawnTarget(nextTarget: Point = { x: randomPercent(18, 82), y: randomPercent(18, 82) }) {
    velocityRef.current = getRandomVelocity();
    setTarget(nextTarget);
    setTargetVisible(false);
    setTargetSeed((current) => current + 1);
    requestAnimationFrame(() => setTargetVisible(true));
  }

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (!running) {
      lastFrameRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      const previous = lastFrameRef.current ?? timestamp;
      const deltaSeconds = (timestamp - previous) / 1000;
      lastFrameRef.current = timestamp;

      setTarget((current) => {
        let nextX = current.x + velocityRef.current.x * deltaSeconds;
        let nextY = current.y + velocityRef.current.y * deltaSeconds;

        if (nextX <= 12 || nextX >= 88) {
          velocityRef.current.x *= -1;
          nextX = Math.min(88, Math.max(12, nextX));
        }

        if (nextY <= 14 || nextY >= 86) {
          velocityRef.current.y *= -1;
          nextY = Math.min(86, Math.max(14, nextY));
        }

        return { x: nextX, y: nextY };
      });

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      lastFrameRef.current = null;
    };
  }, [running]);

  function startRun() {
    setHits(0);
    setMisses(0);
    setReactionTimes([]);
    setRunning(true);
    setStartedAt(performance.now());
    spawnTarget();
  }

  function handleTargetClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (!running) {
      startRun();
      return;
    }

    playHitSound();

    const now = performance.now();
    const reaction = startedAt === null ? null : Math.round(now - startedAt);
    const nextHits = hits + 1;
    setHits(nextHits);

    if (reaction !== null) {
      const nextTimes = [...reactionTimes, reaction];
      setReactionTimes(nextTimes);
      if (nextHits >= 25) {
        const averageForRun = Math.round(nextTimes.reduce((sum, value) => sum + value, 0) / nextTimes.length);
        setBestRun((currentBest) => (currentBest === null ? averageForRun : Math.min(currentBest, averageForRun)));

        if (isSignedIn) {
          void (async () => {
            const response = await fetch('/api/scores/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                testSlug: 'aim-moving-targets',
                score: reactionMsToLeaderboardScore(averageForRun),
                ...multiplayerMeta,
              }),
            });

            if (response.ok && isMultiplayerSession) {
              goToIntermission();
            }
          })();
        }
      }
    }

    if (nextHits >= 25) {
      setRunning(false);
      setStartedAt(null);
      setTargetVisible(false);
      return;
    }

    setStartedAt(now);
    spawnTarget();
  }

  return (
    <AimShell
      title={MODE_META.moving.title}
      kicker={MODE_META.moving.kicker}
      description={MODE_META.moving.description}
      accent={MODE_META.moving.accent}
      isSignedIn={isSignedIn}
      stats={[
        { label: 'Targets left', value: String(hitsLeft), detail: 'Finish all 25 moving targets to complete the drill.' },
        { label: 'Average reaction', value: formatMs(averageReactionMs), detail: 'Average across all successful moving-target hits.' },
        { label: 'Lab score', value: displayedLabScore === null ? '--' : String(displayedLabScore), detail: bestRun !== null ? `Best completed average: ${bestRun} ms.` : currentLabScore !== null ? 'Live score based on your current average.' : 'Calculated from your average reaction time.' },
        { label: 'Status', value: isFinished ? 'Done' : running ? 'Live' : 'Ready', detail: isFinished ? 'Use Try again to run another set.' : !running ? 'Click the center target to begin.' : `Track the green target and hit it before it escapes. Misses: ${misses}.` },
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="cursor-pointer rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">{hitsLeft} targets left</div>
        </div>

        <div className="relative min-h-[24rem] cursor-pointer overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 sm:min-h-[28rem]" onClick={() => setMisses((current) => current + 1)}>
          <button
            key={targetSeed}
            className={`absolute h-[88px] w-[88px] cursor-pointer rounded-full border-0 bg-transparent transition-[transform,opacity] duration-150 ease-out ${targetVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
            onClick={handleTargetClick}
            type="button"
            style={{ left: `clamp(18px, ${target.x}%, calc(100% - 90px))`, top: `clamp(18px, ${target.y}%, calc(100% - 90px))`, transform: 'translate(-50%, -50%)' }}
          >
            <span className="flex flex-col items-center">
              <span className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border-[8px] border-emerald-600 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.12)]">
                <span className="absolute h-[68px] w-[68px] rounded-full border-[8px] border-white bg-emerald-600" />
                <span className="absolute h-[42px] w-[42px] rounded-full border-[7px] border-white bg-emerald-300" />
                <span className="absolute h-[18px] w-[18px] rounded-full border-4 border-white bg-emerald-700" />
              </span>
              {!running && !isFinished && <span className="mt-3 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">CLICK TO START</span>}
            </span>
          </button>

          {isFinished && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="rounded-2xl border-b-4 border-emerald-800 bg-emerald-600 px-6 py-3 font-bold text-white transition-all duration-150 hover:-translate-y-1 hover:border-emerald-700 hover:bg-emerald-500 active:translate-y-1 active:border-b-0" onClick={startRun} type="button">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </AimShell>
  );
}

function TrackingTest({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('aim-tracking-test');
  const ROUND_MS = 20000;
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [running, setRunning] = useState(false);
  const [runComplete, setRunComplete] = useState(false);
  const [trackPoint, setTrackPoint] = useState({ x: 50, y: 50 });
  const [cursorInside, setCursorInside] = useState(false);
  const [timeInsideMs, setTimeInsideMs] = useState(0);

  const cursorInsideRef = useRef(false);
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLButtonElement | null>(null);
  const pointRef = useRef(trackPoint);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const pointerClientRef = useRef<{ x: number; y: number } | null>(null);
  const pointerInArenaRef = useRef(false);
  const velocityRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const runStartRef = useRef<number | null>(null);
  const elapsedMsRef = useRef(0);
  const playInsideSound = useLabHitSound();
  const hasSavedRunRef = useRef(false);

  const labScore = Math.round((timeInsideMs / ROUND_MS) * 1000);

  useEffect(() => {
    pointRef.current = trackPoint;
  }, [trackPoint]);

  function updateInsideState(nextInside: boolean) {
    const wasInside = cursorInsideRef.current;
    cursorInsideRef.current = nextInside;
    setCursorInside(nextInside);

    if (running && nextInside && !wasInside) {
      playInsideSound();
    }
  }

  function randomVelocity() {
    const angle = Math.random() * Math.PI * 2;
    const speed = 10 + Math.random() * 6;
    return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  }

  function resolvePointerPosition(event: React.PointerEvent<HTMLDivElement>) {
    pointerClientRef.current = { x: event.clientX, y: event.clientY };
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    return { x, y };
  }

  function resolvePointerFromClientPoint(clientX: number, clientY: number) {
    const arena = arenaRef.current;
    if (!arena) {
      return null;
    }

    pointerClientRef.current = { x: clientX, y: clientY };

    const rect = arena.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    const isInsideArena =
      relativeX >= 0 && relativeX <= rect.width && relativeY >= 0 && relativeY <= rect.height;

    pointerInArenaRef.current = isInsideArena;

    if (!isInsideArena) {
      pointerPositionRef.current = null;
      return null;
    }

    const pointer = {
      x: (relativeX / rect.width) * 100,
      y: (relativeY / rect.height) * 100,
    };

    pointerPositionRef.current = pointer;
    return pointer;
  }

  useEffect(() => {
    if (!running) {
      return;
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      const pointer = resolvePointerFromClientPoint(event.clientX, event.clientY);

      if (pointer === null) {
        updateInsideState(false);
        return;
      }

      const distance = Math.hypot(pointer.x - pointRef.current.x, pointer.y - pointRef.current.y);
      updateInsideState(distance < 10);
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
    };
  }, [running]);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (!running) {
      lastFrameRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      const previous = lastFrameRef.current ?? timestamp;
      const deltaMs = timestamp - previous;
      const frameDeltaMs = Math.max(deltaMs, 0);
      const deltaSeconds = Math.max(deltaMs / 1000, 0.016);
      lastFrameRef.current = timestamp;

      const runStart = runStartRef.current ?? timestamp;
      elapsedMsRef.current = Math.max(0, timestamp - runStart);
      const remainingMs = Math.max(0, ROUND_MS - elapsedMsRef.current);
      const progress = Math.min(1, elapsedMsRef.current / ROUND_MS);
      const speedMultiplier = 0.45 + progress * 1.2;
      setSecondsLeft(Math.ceil(remainingMs / 1000));

      if (cursorInsideRef.current) {
        setTimeInsideMs((current) => Math.min(ROUND_MS, current + frameDeltaMs));
      }

      const jitter = 10 + progress * 18;
      velocityRef.current.x += (Math.random() - 0.5) * jitter * deltaSeconds;
      velocityRef.current.y += (Math.random() - 0.5) * jitter * deltaSeconds;

      const velocityMagnitude = Math.hypot(velocityRef.current.x, velocityRef.current.y);
      const maxSpeed = 20 + progress * 28;
      if (velocityMagnitude > maxSpeed) {
        velocityRef.current.x = (velocityRef.current.x / velocityMagnitude) * maxSpeed;
        velocityRef.current.y = (velocityRef.current.y / velocityMagnitude) * maxSpeed;
      }

      const minSpeed = 7 + progress * 6;
      if (velocityMagnitude < minSpeed) {
        velocityRef.current = randomVelocity();
      }

      if (Math.random() < 0.015) {
        velocityRef.current = randomVelocity();
      }

      const currentPoint = pointRef.current;
      let nextX = currentPoint.x + velocityRef.current.x * deltaSeconds * speedMultiplier;
      let nextY = currentPoint.y + velocityRef.current.y * deltaSeconds * speedMultiplier;

      if (nextX <= 10 || nextX >= 90) {
        velocityRef.current.x *= -1;
        nextX = Math.min(90, Math.max(10, nextX));
      }

      if (nextY <= 12 || nextY >= 88) {
        velocityRef.current.y *= -1;
        nextY = Math.min(88, Math.max(12, nextY));
      }

      const nextPoint = { x: nextX, y: nextY };
      pointRef.current = nextPoint;
      setTrackPoint(nextPoint);

      const pointerClient = pointerClientRef.current;
      const targetNode = targetRef.current;

      if (!pointerClient || !targetNode) {
        updateInsideState(false);
      } else {
        const hovered = document.elementFromPoint(pointerClient.x, pointerClient.y);
        const insideTarget = hovered instanceof Element && targetNode.contains(hovered);
        updateInsideState(insideTarget);
      }

      if (elapsedMsRef.current >= ROUND_MS) {
        updateInsideState(false);
        if (isSignedIn && !hasSavedRunRef.current) {
          const finalInsideMs = Math.min(ROUND_MS, timeInsideMs + (cursorInsideRef.current ? frameDeltaMs : 0));
          const finalScore = Math.round((finalInsideMs / ROUND_MS) * 1000);
          hasSavedRunRef.current = true;

          void (async () => {
            const response = await fetch('/api/scores/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ testSlug: 'aim-tracking-test', score: finalScore, ...multiplayerMeta }),
            });

            if (response.ok && isMultiplayerSession) {
              goToIntermission();
            }
          })();
        }

        setRunning(false);
        setRunComplete(true);
        setTrackPoint({ x: 50, y: 50 });
        return;
      }

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      lastFrameRef.current = null;
    };
  }, [goToIntermission, isMultiplayerSession, running, multiplayerMeta]);

  function startRun(initialPointer: { x: number; y: number } | null = null) {
    hasSavedRunRef.current = false;
    setRunComplete(false);
    setRunning(true);
    setSecondsLeft(20);
    setTimeInsideMs(0);
    setCursorInside(false);
    cursorInsideRef.current = false;
    pointerPositionRef.current = initialPointer;
    pointerInArenaRef.current = initialPointer !== null;
    if (initialPointer !== null && arenaRef.current) {
      const rect = arenaRef.current.getBoundingClientRect();
      pointerClientRef.current = {
        x: rect.left + (initialPointer.x / 100) * rect.width,
        y: rect.top + (initialPointer.y / 100) * rect.height,
      };
    }
    elapsedMsRef.current = 0;
    runStartRef.current = performance.now();
    setTrackPoint({ x: 50, y: 50 });
    velocityRef.current = randomVelocity();
    lastFrameRef.current = performance.now() - 16;
  }

  function storePointerPositionFromClientPoint(clientX: number, clientY: number) {
    const pointer = resolvePointerFromClientPoint(clientX, clientY);

    if (pointer === null) {
      pointerInArenaRef.current = true;
      return null;
    }

    return pointer;
  }

  function handleTargetClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!running) {
      const pointer = storePointerPositionFromClientPoint(event.clientX, event.clientY);
      startRun(pointer);
    }
  }

  return (
    <AimShell
      title={MODE_META.tracking.title}
      kicker={MODE_META.tracking.kicker}
      description={MODE_META.tracking.description}
      accent={MODE_META.tracking.accent}
      isSignedIn={isSignedIn}
      stats={[
        { label: 'Seconds left', value: `${secondsLeft}s`, detail: 'The tracking window lasts twenty seconds.' },
        { label: 'Time inside target', value: `${(timeInsideMs / 1000).toFixed(2)}s`, detail: 'Total time your cursor stayed inside the target.' },
        { label: 'Lab score', value: String(labScore), detail: 'Based on how long you stayed inside the target.' },
        {
          label: 'Status',
          value: running ? 'Live' : runComplete ? 'Done' : 'Ready',
          detail: running
            ? 'Keep your cursor inside as long as possible.'
            : runComplete
              ? 'Run complete. Review your lab score and start again when ready.'
              : 'Click the target to begin.',
        },
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="cursor-pointer rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">Pointer stay challenge</div>
        </div>

        <div
          id="tracking-test-arena"
          ref={arenaRef}
          className="relative min-h-[24rem] cursor-pointer overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-4 sm:min-h-[28rem]"
          onPointerEnter={(event) => {
            const pointer = resolvePointerPosition(event);
            pointerInArenaRef.current = true;
            pointerPositionRef.current = pointer;
          }}
          onPointerLeave={() => {
            pointerInArenaRef.current = false;
            pointerPositionRef.current = null;
            updateInsideState(false);
          }}
          onPointerMove={(event) => {
            const pointer = resolvePointerPosition(event);
            pointerPositionRef.current = pointer;
          }}
        >
          <button
            ref={targetRef}
            className="absolute h-[72px] w-[72px] cursor-pointer rounded-full border-0 bg-transparent transition-[transform,opacity] duration-75"
            onClick={handleTargetClick}
            type="button"
            style={{ left: `${trackPoint.x}%`, top: `${trackPoint.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <span className={`relative flex h-full w-full items-center justify-center rounded-full border-[6px] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.12)] ${cursorInside ? 'border-indigo-400' : 'border-indigo-500'}`}>
              <span className={`absolute h-[54px] w-[54px] rounded-full border-[6px] border-white ${cursorInside ? 'bg-indigo-400' : 'bg-indigo-500'}`} />
              <span className={`absolute h-[32px] w-[32px] rounded-full border-[5px] border-white ${cursorInside ? 'bg-indigo-200' : 'bg-indigo-300'}`} />
              <span className={`absolute h-[12px] w-[12px] rounded-full border-2 border-white ${cursorInside ? 'bg-indigo-600' : 'bg-indigo-700'}`} />
            </span>

            {!running && (
              <span className="pointer-events-none absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                CLICK TO START
              </span>
            )}
          </button>

          {runComplete && !running && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-slate-800">{labScore}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Time inside target: {(timeInsideMs / 1000).toFixed(2)}s</p>
                <button className="lab-button mt-4" onClick={() => startRun()} type="button">Start New ...</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AimShell>
  );
}

function getSplitShape(shape: SplitShapeKey) {
  return SPLIT_SHAPES.find((entry) => entry.key === shape) ?? SPLIT_SHAPES[0];
}

function boundaryPoint(shape: SplitShapeKey, progress: number): Point {
  const normalized = ((progress % 1) + 1) % 1;
  const points = getSplitShape(shape).points;
  const edgeLengths = points.map((point, index) => {
    const nextPoint = points[(index + 1) % points.length];
    return Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y);
  });
  const perimeter = edgeLengths.reduce((sum, length) => sum + length, 0);
  let distance = normalized * perimeter;

  for (let index = 0; index < points.length; index += 1) {
    const currentPoint = points[index];
    const nextPoint = points[(index + 1) % points.length];
    const edgeLength = edgeLengths[index];

    if (distance <= edgeLength) {
      const ratio = edgeLength === 0 ? 0 : distance / edgeLength;
      return {
        x: currentPoint.x + (nextPoint.x - currentPoint.x) * ratio,
        y: currentPoint.y + (nextPoint.y - currentPoint.y) * ratio,
      };
    }

    distance -= edgeLength;
  }

  return points[0];
}

function closestBoundaryProgress(shape: SplitShapeKey, point: Point) {
  const samples = 360;
  let bestProgress = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < samples; index += 1) {
    const progress = index / samples;
    const sample = boundaryPoint(shape, progress);
    const distance = Math.hypot(sample.x - point.x, sample.y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProgress = progress;
    }
  }

  return bestProgress;
}

function pointInsideShape(shape: SplitShapeKey, point: Point) {
  const points = getSplitShape(shape).points;
  let inside = false;

  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const current = points[index];
    const prior = points[previous];
    const intersects = ((current.y > point.y) !== (prior.y > point.y))
      && (point.x < ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) + current.x);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function evaluateSplit(shape: SplitShapeKey, leftProgress: number, rightProgress: number) {
  const leftPoint = boundaryPoint(shape, leftProgress);
  const rightPoint = boundaryPoint(shape, rightProgress);
  const gridSize = 72;
  let leftCount = 0;
  let rightCount = 0;

  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const x = (column + 0.5) * (100 / gridSize);
      const y = (row + 0.5) * (100 / gridSize);
      const samplePoint = { x, y };

      if (!pointInsideShape(shape, samplePoint)) {
        continue;
      }

      const side = (rightPoint.x - leftPoint.x) * (samplePoint.y - leftPoint.y) - (rightPoint.y - leftPoint.y) * (samplePoint.x - leftPoint.x);
      if (side >= 0) {
        leftCount += 1;
      } else {
        rightCount += 1;
      }
    }
  }

  const totalCount = leftCount + rightCount;
  const leftPercent = totalCount === 0 ? 0 : (leftCount / totalCount) * 100;
  const rightPercent = totalCount === 0 ? 0 : (rightCount / totalCount) * 100;
  const balanceScore = totalCount === 0 ? 0 : Math.max(0, 100 - Math.round((Math.abs(leftCount - rightCount) / totalCount) * 100));

  return {
    leftPoint: { x: roundPoint(leftPoint.x), y: roundPoint(leftPoint.y) },
    rightPoint: { x: roundPoint(rightPoint.x), y: roundPoint(rightPoint.y) },
    leftPercent,
    rightPercent,
    balanceScore,
  };
}

function PerfectSplit({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('aim-perfect-split');
  const [running, setRunning] = useState(false);
  const [shapeIndex, setShapeIndex] = useState(0);
  const [solvedShapes, setSolvedShapes] = useState(0);
  const [completedBalances, setCompletedBalances] = useState<number[]>([]);
  const [shuffledShapes, setShuffledShapes] = useState<typeof SPLIT_SHAPES>(SPLIT_SHAPES);
  const [leftProgress, setLeftProgress] = useState(0.15);
  const [rightProgress, setRightProgress] = useState(0.6);
  const [activeHandle, setActiveHandle] = useState<SplitHandle | null>(null);
  const [submittedResult, setSubmittedResult] = useState<ReturnType<typeof evaluateSplit> | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const hasSavedRunRef = useRef(false);
  const playSplitSubmissionSound = useSplitSubmissionSound();

  const currentShape = shuffledShapes[shapeIndex] ?? shuffledShapes[0];
  const splitResult = useMemo(() => evaluateSplit(currentShape.key, leftProgress, rightProgress), [currentShape.key, leftProgress, rightProgress]);
  const isReviewing = submittedResult !== null;
  const isFinished = !running && solvedShapes >= 4;
  const showShape = running || isReviewing || isFinished;
  const reviewedBalances = submittedResult === null ? completedBalances : [...completedBalances, submittedResult.balanceScore];
  const averageBalance = reviewedBalances.length === 0
    ? null
    : Math.round(reviewedBalances.reduce((sum, value) => sum + value, 0) / reviewedBalances.length);
  const labScore = averageBalance === null ? null : averageBalance * 10;

  useEffect(() => {
    if (!isSignedIn || !isFinished || labScore === null || hasSavedRunRef.current) {
      return;
    }

    hasSavedRunRef.current = true;

    void (async () => {
      const response = await fetch('/api/scores/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testSlug: 'aim-perfect-split', score: labScore, ...multiplayerMeta }),
      });

      if (response.ok && isMultiplayerSession) {
        goToIntermission();
      }
    })();
  }, [goToIntermission, isFinished, isMultiplayerSession, isSignedIn, labScore, multiplayerMeta]);

  useEffect(() => {
    if (activeHandle === null) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const board = boardRef.current;
      if (board === null) {
        return;
      }

      const rect = board.getBoundingClientRect();
      const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
      const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
      const nextProgress = closestBoundaryProgress(currentShape.key, { x, y });

      if (activeHandle === 'left') {
        setLeftProgress(nextProgress);
      } else {
        setRightProgress(nextProgress);
      }
    };

    const handleUp = () => setActiveHandle(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [activeHandle, currentShape.key]);

  function resetHandles(shape: SplitShapeKey) {
    const definition = getSplitShape(shape);
    setLeftProgress(definition.defaultLeft);
    setRightProgress(definition.defaultRight);
  }

  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function startRun() {
    hasSavedRunRef.current = false;
    const randomized = shuffleArray(SPLIT_SHAPES);
    setShuffledShapes(randomized);
    setRunning(true);
    setShapeIndex(0);
    setSolvedShapes(0);
    setCompletedBalances([]);
    resetHandles(randomized[0].key);
    setActiveHandle(null);
    setSubmittedResult(null);
  }

  function handleSubmitShape() {
    if (!running || isReviewing) {
      return;
    }

    playSplitSubmissionSound(splitResult.balanceScore);
    setSubmittedResult(splitResult);
    setActiveHandle(null);
  }

  function handleAdvanceShape() {
    if (submittedResult === null) {
      return;
    }

    const nextSolved = solvedShapes + 1;
    const nextIndex = shapeIndex + 1;
    setSolvedShapes(nextSolved);
    setCompletedBalances((current) => [...current, submittedResult.balanceScore]);
    setSubmittedResult(null);

    if (nextSolved >= 4) {
      setRunning(false);
      return;
    }

    setShapeIndex(nextIndex);
    resetHandles(shuffledShapes[nextIndex].key);
  }

  return (
    <AimShell
      title={MODE_META.split.title}
      kicker={MODE_META.split.kicker}
      description={MODE_META.split.description}
      accent={MODE_META.split.accent}
      isSignedIn={isSignedIn}
      stats={[
        { label: 'Rounds left', value: `${Math.max(4 - solvedShapes, 0)}`, detail: 'Solve the current shape and move to the next one.' },
        { label: 'Average Balance', value: averageBalance === null ? '--' : `${averageBalance}%`, detail: averageBalance === null ? 'Your balance average appears after your first submission.' : 'Average balance across submitted shapes so far.' },
        { label: 'Lab Score', value: labScore === null ? '--' : `${labScore}`, detail: labScore === null ? 'Your lab score is revealed after submission.' : 'Average balance scaled to a 1000-point score.' },
        { label: 'Status', value: isFinished ? 'Done' : running ? (submittedResult === null ? 'Split' : 'Review') : 'Ready', detail: isFinished ? 'Four rounds complete.' : submittedResult === null ? 'Arrange the border points, then press Done.' : 'Read the result, then advance to the next shape.' },
      ]}
    >
      <div className="space-y-4">
        <div ref={boardRef} className="relative mx-auto aspect-square w-full max-w-[38rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-4 pb-80">
          {showShape && (
            <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border-2 border-slate-200 bg-white/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 shadow-sm">
              {currentShape.label}
            </div>
          )}

          {showShape && (
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
              {currentShape.svgPath ? (
                <path
                  d={currentShape.svgPath}
                  fill={currentShape.fill}
                  fillOpacity="0.78"
                  stroke={currentShape.stroke}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              ) : (
                <polygon
                  points={currentShape.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill={currentShape.fill}
                  fillOpacity="0.72"
                  stroke={currentShape.stroke}
                  strokeLinejoin="round"
                  strokeWidth="2.4"
                />
              )}
              <line x1={splitResult.leftPoint.x} y1={splitResult.leftPoint.y} x2={splitResult.rightPoint.x} y2={splitResult.rightPoint.y} stroke="#0f172a" strokeDasharray="4 4" strokeLinecap="round" strokeWidth="2" />
            </svg>
          )}

          {showShape && (
            <button
              aria-label="Left edge point"
              className={`absolute z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white shadow-[0_10px_20px_rgba(15,23,42,0.2)] transition ${running && !isReviewing ? 'cursor-grab active:cursor-grabbing bg-slate-900' : 'cursor-default bg-slate-400'}`}
              onPointerDown={(event) => {
                event.preventDefault();
                if (!running || isReviewing) {
                  return;
                }
                setActiveHandle('left');
              }}
              style={{ left: `${splitResult.leftPoint.x}%`, top: `${splitResult.leftPoint.y}%` }}
              type="button"
            />
          )}

          {showShape && (
            <button
              aria-label="Right edge point"
              className={`absolute z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white shadow-[0_10px_20px_rgba(15,23,42,0.2)] transition ${running && !isReviewing ? 'cursor-grab active:cursor-grabbing bg-slate-900' : 'cursor-default bg-slate-400'}`}
              onPointerDown={(event) => {
                event.preventDefault();
                if (!running || isReviewing) {
                  return;
                }
                setActiveHandle('right');
              }}
              style={{ left: `${splitResult.rightPoint.x}%`, top: `${splitResult.rightPoint.y}%` }}
              type="button"
            />
          )}

          {showShape && isReviewing ? (
            <div className="absolute inset-x-4 bottom-4 z-20 flex items-end gap-3 rounded-[1.5rem] border-2 border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Balance</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-slate-800">{Math.round(splitResult.balanceScore)}%</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">Area split: {Math.round(splitResult.leftPercent)}% / {Math.round(splitResult.rightPercent)}%</p>
              </div>

              <button className="lab-button ml-auto shrink-0" onClick={handleAdvanceShape} type="button">
                {solvedShapes >= 4 ? 'Finish split test' : 'Next Shape'}
              </button>
            </div>
          ) : showShape ? (
            <div className="absolute inset-x-4 bottom-4 z-20 flex items-end justify-between gap-3 rounded-[1.5rem] border-2 border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Ready</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Arrange the split, then press Done to reveal the score.</p>
              </div>

              <button className="lab-button shrink-0" onClick={handleSubmitShape} type="button">
                Done
              </button>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="lab-button" onClick={startRun} type="button">Start Split Test</button>
            </div>
          )}

          {isReviewing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/45 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-5 py-4 text-center shadow-lg">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Result</p>
                <p className="mt-2 text-xl font-black tracking-tight text-slate-800">{Math.round(submittedResult.balanceScore)}% balanced</p>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                  Split ratio: {Math.round(submittedResult.leftPercent)}% / {Math.round(submittedResult.rightPercent)}%.
                </p>
              </div>
            </div>
          )}

          {isFinished && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-5 py-4 text-center shadow-lg">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Done</p>
                <p className="mt-2 text-xl font-black tracking-tight text-slate-800">Four rounds complete</p>
                <button className="mt-4 lab-button" onClick={startRun} type="button">Run again</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AimShell>
  );
}

export function AimProtocols({ mode, isSignedIn }: AimProtocolsProps) {
  if (mode === 'moving') {
    return <MovingTargets isSignedIn={isSignedIn} />;
  }

  if (mode === 'tracking') {
    return <TrackingTest isSignedIn={isSignedIn} />;
  }

  if (mode === 'split') {
    return <PerfectSplit isSignedIn={isSignedIn} />;
  }

  return <AimTrainer isSignedIn={isSignedIn} />;
}
