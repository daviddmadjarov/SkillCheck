"use client";

import { BrainCircuit, Zap, Swords, Star } from 'lucide-react';

type GameInfoPanelProps = {
  title: string;
  description: string;
  skillDescription: string;
  howScoringWorks: string;
  tips: string[];
  whyUseful: string;
};

type BadgeColor = 'amber' | 'blue' | 'emerald' | 'purple';

const chipMap: Record<BadgeColor, { chip: string; text: string }> = {
  amber: { chip: 'bg-amber-400 text-amber-900', text: 'text-amber-600' },
  blue: { chip: 'bg-blue-400 text-blue-900', text: 'text-blue-600' },
  emerald: { chip: 'bg-emerald-400 text-emerald-900', text: 'text-emerald-600' },
  purple: { chip: 'bg-purple-400 text-purple-900', text: 'text-purple-600' },
};

function ComicChip({ label, color }: { label: string; color: BadgeColor }) {
  const c = chipMap[color];
  return (
    <span className={`${c.chip} inline-block -rotate-1 rounded-lg border-2 border-black px-2.5 py-0.5 text-[10px] font-black uppercase leading-none tracking-wider shadow-[2px_2px_0_rgba(0,0,0,0.4)]`}>
      {label}
    </span>
  );
}

function ComicBox({ children, color = 'amber', className = '' }: { children: React.ReactNode; color: BadgeColor; className?: string }) {
  const c = chipMap[color];
  return (
    <div className={`${c.chip.replace('text-', 'bg-')} ${className} relative rounded-xl border-[3px] border-black p-3 shadow-[4px_4px_0_rgba(0,0,0,0.35)]`}>
      <div className="absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-black bg-white text-xs font-black shadow-[2px_2px_0_rgba(0,0,0,0.3)]">
        <Zap className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />
      </div>
      {children}
    </div>
  );
}

export function GameInfoPanel({
  title,
  description,
  skillDescription,
  howScoringWorks,
  tips,
  whyUseful,
}: GameInfoPanelProps) {
  return (
    <section className="lab-card overflow-hidden border-2 border-black p-0 shadow-[0_6px_0_rgba(0,0,0,0.25)]">
      {/* ── Comic hero header ── */}
      <div className="relative flex items-center gap-3 border-b-[3px] border-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 px-5 py-4 sm:px-6">
        {/* Speed lines */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-2 left-[30%] h-1 w-16 bg-white/40 -rotate-6 rounded-full" />
          <div className="absolute bottom-3 right-[20%] h-1.5 w-24 bg-white/30 rotate-3 rounded-full" />
          <div className="absolute top-1/2 left-[60%] h-1 w-12 bg-white/30 -rotate-12 rounded-full" />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border-[3px] border-black bg-amber-400 shadow-[3px_3px_0_rgba(0,0,0,0.35)]">
          <BrainCircuit className="h-5.5 w-5.5 text-black" />
        </div>
        <div className="relative z-10">
          <ComicChip label="LAB REPORT" color="purple" />
          <h2 className="mt-1 text-xl font-black tracking-tight text-black drop-shadow-[1px_1px_0_rgba(255,255,255,0.5)]">
            {title}
          </h2>
        </div>
        {/* Exaggerated exclamation */}
        <div className="ml-auto hidden sm:block">
          <span className="inline-block -rotate-6 rounded-xl border-[3px] border-black bg-rose-400 px-4 py-1.5 text-sm font-black uppercase tracking-wider text-black shadow-[3px_3px_0_rgba(0,0,0,0.3)]">
            ⚡ TRY IT!
          </span>
        </div>
      </div>

      {/* ── Snappy one-liner ── */}
      <div className="relative border-b-[3px] border-black bg-yellow-200 px-5 py-[10px] sm:px-6">
        <p className="text-sm font-black leading-5 text-black">
          <span className="mr-1 inline-block -rotate-3 rounded border-2 border-black bg-white px-1.5 text-[10px] leading-5">💡</span>
          {description.length > 120 ? description.slice(0, 120) + '…' : description}
        </p>
      </div>

      {/* ── Two-column grid: skill + scoring ── */}
      <div className="grid gap-0 sm:grid-cols-2">
        <div className="border-b-[3px] border-r-0 border-black bg-slate-100 p-4 sm:border-b-0 sm:border-r-[3px] sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <ComicChip label="🎯 What It Tests" color="amber" />
          </div>
          <ComicBox color="amber">
            <p className="text-sm font-bold leading-5 text-black">
              {skillDescription.length > 100 ? skillDescription.slice(0, 100) + '…' : skillDescription}
            </p>
          </ComicBox>
        </div>

        <div className="border-b-[3px] border-black bg-slate-100 p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <ComicChip label="📊 Scoring" color="blue" />
          </div>
          <ComicBox color="blue">
            <p className="text-sm font-bold leading-5 text-black">
              {howScoringWorks.length > 100 ? howScoringWorks.slice(0, 100) + '…' : howScoringWorks}
            </p>
          </ComicBox>
        </div>
      </div>

      {/* ── Second row: tips + why useful ── */}
      <div className="grid gap-0 sm:grid-cols-2">
        <div className="border-b-[3px] border-r-0 border-black bg-slate-100 p-4 sm:border-b-0 sm:border-r-[3px] sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <ComicChip label="🔥 Tips" color="emerald" />
          </div>
          <div className="space-y-2">
            {tips.slice(0, 3).map((tip, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-xl border-[3px] border-black bg-emerald-300 p-2.5 shadow-[3px_3px_0_rgba(0,0,0,0.3)]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-[3px] border-black bg-white text-xs font-black text-black shadow-[2px_2px_0_rgba(0,0,0,0.25)]">
                  {index + 1}
                </span>
                <p className="text-xs font-bold leading-4 text-black">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-100 p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <ComicChip label="⭐ Why It Matters" color="purple" />
          </div>
          <ComicBox color="purple" className="!bg-purple-300">
            <p className="text-sm font-bold leading-5 text-black">
              {whyUseful.length > 100 ? whyUseful.slice(0, 100) + '…' : whyUseful}
            </p>
          </ComicBox>

          {/* ── Comic power meter ── */}
          <div className="mt-3 rounded-xl border-[3px] border-black bg-white p-3 shadow-[3px_3px_0_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between">
              <span className="inline-block rounded border-2 border-black bg-rose-300 px-2 py-0.5 text-[9px] font-black uppercase text-black">
                Power Level
              </span>
              <span className="text-[9px] font-black uppercase text-emerald-600">
                Gains possible 💪
              </span>
            </div>
            <div className="mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full border-[3px] border-black bg-slate-200 p-0.5">
              <div className="h-full w-1/5 rounded-full bg-red-400 border-r-2 border-black" />
              <div className="h-full w-1/5 rounded-full bg-orange-400 border-r-2 border-black" />
              <div className="h-full w-1/5 rounded-full bg-amber-400 border-r-2 border-black" />
              <div className="h-full w-1/5 rounded-full bg-lime-400 border-r-2 border-black" />
              <div className="h-full w-1/5 rounded-full bg-green-400" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}