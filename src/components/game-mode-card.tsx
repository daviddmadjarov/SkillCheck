'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { useAudioFeedback } from '@/components/use-audio-feedback';

type GameModeCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
  bg: string;
};

export function GameModeCard({ href, icon: Icon, title, desc, color, bg }: GameModeCardProps) {
  const { playHoverSound, playClickSound } = useAudioFeedback();

  return (
    <Link
      href={href}
      className="lab-card-interactive min-h-[126px] p-5"
      onMouseEnter={playHoverSound}
      onClick={playClickSound}
    >
      <div className="flex items-start gap-4">
        <div className={`rounded-2xl border-2 border-white p-3 shadow-sm ${bg}`}>
          <Icon className={`h-7 w-7 ${color}`} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="protocol-title">{title}</h2>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
            {desc}
          </p>
        </div>
      </div>
    </Link>
  );
}