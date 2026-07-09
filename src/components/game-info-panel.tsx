"use client";

import {
  BrainCircuit,
  Target,
  Lightbulb,
  BarChart3,
  Sparkles,
} from 'lucide-react';

type GameInfoPanelProps = {
  title: string;
  description: string;
  skillDescription: string;
  howScoringWorks: string;
  tips: string[];
  whyUseful: string;
};

export function GameInfoPanel({
  title,
  description,
  skillDescription,
  howScoringWorks,
  tips,
  whyUseful,
}: GameInfoPanelProps) {
  return (
    <section className="lab-card overflow-hidden p-0">
      {/* ── Lab notebook header strip ── */}
      <div className="flex items-center gap-3 border-b-2 border-dashed border-slate-200 bg-gradient-to-r from-cyan-50 to-blue-50 px-5 py-4 sm:px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-[0_3px_0_rgba(14,116,144,1)]">
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-600">
            Lab Report &middot; Cognitive Profile
          </p>
          <h2 className="text-lg font-black tracking-tight text-slate-800">{title}</h2>
        </div>
      </div>

      {/* ── Description with quote style ── */}
      <div className="relative border-b-2 border-dashed border-slate-100 px-5 py-4 sm:px-6">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-cyan-400 to-blue-400 rounded-r-full" />
        <p className="pl-4 text-sm font-medium leading-6 text-slate-600 italic">
          &ldquo;{description}&rdquo;
        </p>
      </div>

      {/* ── Two-column grid: skill + scoring ── */}
      <div className="grid gap-0 sm:grid-cols-2">
        <div className="border-b-2 border-r-0 border-dashed border-slate-100 p-5 sm:border-b-0 sm:border-r-2 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Target className="h-4 w-4" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
              What It Tests
            </p>
          </div>
          <div className="relative rounded-xl border-2 border-amber-100 bg-amber-50/50 p-4">
            <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-[10px] font-black text-amber-800">
              !
            </div>
            <p className="text-sm font-medium leading-6 text-slate-600">{skillDescription}</p>
          </div>
        </div>

        <div className="border-b-2 border-dashed border-slate-100 p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <BarChart3 className="h-4 w-4" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
              Scoring Formula
            </p>
          </div>
          <div className="relative rounded-xl border-2 border-blue-100 bg-blue-50/50 p-4">
            <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-200 text-[10px] font-black text-blue-800">
              ƒ
            </div>
            <p className="text-sm font-medium leading-6 text-slate-600">{howScoringWorks}</p>
          </div>
        </div>
      </div>

      {/* ── Second row: tips + why useful ── */}
      <div className="grid gap-0 sm:grid-cols-2">
        <div className="border-b-2 border-r-0 border-dashed border-slate-100 p-5 sm:border-b-0 sm:border-r-2 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Lightbulb className="h-4 w-4" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              Training Notes
            </p>
          </div>
          <div className="space-y-2">
            {tips.map((tip, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-xl border-2 border-emerald-100 bg-emerald-50/50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-emerald-200 bg-white text-[11px] font-black text-emerald-600">
                  {index + 1}
                </span>
                <p className="text-sm font-medium leading-5 text-slate-600">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-700">
              Real-World Value
            </p>
          </div>
          <div className="relative rounded-xl border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-4">
            <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-purple-200 text-[10px] font-black text-purple-800">
              &#9733;
            </div>
            <p className="text-sm font-medium leading-6 text-slate-600">{whyUseful}</p>
          </div>

          {/* ── Skill meter ── */}
          <div className="mt-4 rounded-xl border-2 border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                Trainability
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600">
                Improves with practice
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}