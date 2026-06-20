'use client';

import Link from 'next/link';
import {
  Activity,
  BrainCircuit,
  Crosshair,
  Keyboard,
  MousePointer2,
  Timer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useLoreGlitch } from '@/hooks/use-lore-glitch';

const ICON_MAP: Record<string, LucideIcon> = {
  reaction: Activity,
  aim: Crosshair,
  typing: Keyboard,
  mouse: MousePointer2,
  rhythm: Timer,
  thinking: BrainCircuit,
};

const LORE_LABELS: Record<string, string> = {
  'Reaction Protocol': 'Neural Latency Probe',
  'Aim Assessment': 'Targeting Calibration',
  'Keystroke Test': 'Motor Sequencing',
  'Mouse Control': 'Fine-Motor Precision',
  'Rhythm Sync': 'Internal Clock Calibration',
  'Cognitive Review': 'Synaptic Integrity Scan',
};

type GameModeCardProps = {
  href: string;
  iconKey: string;
  title: string;
  desc: string;
  color: string;
  bg: string;
  hasAnomalousAccess?: boolean;
};

export function GameModeCard({ href, iconKey, title, desc, color, bg, hasAnomalousAccess }: GameModeCardProps) {
  const Icon = ICON_MAP[iconKey];
  const loreTitle = LORE_LABELS[title] ?? title;

  const { displayText, isGlitching } = useLoreGlitch(title, loreTitle, hasAnomalousAccess !== undefined ? { hasAccessOverride: hasAnomalousAccess } : undefined);

  return (
    <Link href={href} className="lab-card-interactive min-h-[126px] p-5">
      <div className="flex items-start gap-4">
        <div className={`rounded-2xl border-2 border-white p-3 shadow-sm ${bg}`}>
          {Icon && <Icon className={`h-7 w-7 ${color}`} strokeWidth={2.5} />}
        </div>
        <div>
          <h2
            className={`protocol-title ${isGlitching ? 'glitch-active' : ''}`}
            data-text={isGlitching ? loreTitle : title}
          >
            {displayText}
          </h2>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
            {desc}
          </p>
        </div>
      </div>
    </Link>
  );
}