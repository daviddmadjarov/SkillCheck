"use client";

import { useState } from 'react';
import {
  BrainCircuit,
  Target,
  BarChart3,
  Lightbulb,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';

type GameInfoPanelProps = {
  title: string;
  description: string;
  skillDescription: string;
  howScoringWorks: string;
  tips: string[];
  whyUseful: string;
};

type TabKey = 'skill' | 'scoring' | 'tips' | 'value';

export function GameInfoPanel({
  title,
  description,
  skillDescription,
  howScoringWorks,
  tips,
  whyUseful,
}: GameInfoPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);

  const tabs: { key: TabKey; label: string; icon: typeof Target; color: string; bg: string; border: string }[] = [
    { key: 'skill', label: 'What It Tests', icon: Target, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    { key: 'scoring', label: 'How Scoring Works', icon: BarChart3, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    { key: 'tips', label: 'Tips', icon: Lightbulb, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { key: 'value', label: 'Why It Matters', icon: Sparkles, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  ];

  const contentMap: Record<TabKey, { text: string; items?: string[] }> = {
    skill: { text: skillDescription },
    scoring: { text: howScoringWorks },
    tips: { text: '', items: tips },
    value: { text: whyUseful },
  };

  return (
    <section className="lab-card overflow-hidden">
      {/* ── Header / toggle ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-[0_3px_0_rgba(14,116,144,1)]">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-600">
              Protocol Analysis &middot; {title}
            </p>
            <p className="truncate text-sm font-bold text-slate-700">
              {description.length > 80 ? description.slice(0, 80) + '…' : description}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isOpen && (
            <span className="rounded-full border-2 border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-700">
              Expand
            </span>
          )}
          <ChevronDown
            className={`h-5 w-5 text-slate-400 transition duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* ── Expandable content ── */}
      {isOpen && (
        <div className="border-t-2 border-dashed border-slate-200">
          {/* ── Description banner ── */}
          <div className="border-b-2 border-dashed border-slate-100 bg-slate-50 px-5 py-3 sm:px-6">
            <p className="text-sm font-medium leading-6 text-slate-600 italic">
              &ldquo;{description}&rdquo;
            </p>
          </div>

          {/* ── Tab bar ── */}
          <div className="flex flex-wrap border-b-2 border-slate-200 bg-white">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(isActive ? null : tab.key)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider transition ${
                    isActive
                      ? `${tab.border} ${tab.bg} ${tab.color}`
                      : 'border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  <span className={`ml-1 transition ${isActive ? 'rotate-90' : ''}`}>
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Tab content ── */}
          {activeTab && (
            <div className="px-5 py-4 sm:px-6">
              {activeTab === 'tips' ? (
                <div className="space-y-3">
                  {tips.slice(0, 3).map((tip, index) => (
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
              ) : (
                <div
                  className={`rounded-xl border-2 p-4 ${
                    activeTab === 'skill'
                      ? 'border-amber-100 bg-amber-50/50'
                      : activeTab === 'scoring'
                        ? 'border-blue-100 bg-blue-50/50'
                        : 'border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50'
                  }`}
                >
                  <p className="text-sm font-medium leading-6 text-slate-600">
                    {activeTab === 'skill'
                      ? skillDescription
                      : activeTab === 'scoring'
                        ? howScoringWorks
                        : whyUseful}
                  </p>
                </div>
              )}

              {/* ── Collapse hint ── */}
              <button
                onClick={() => setActiveTab(null)}
                className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition hover:text-slate-600"
              >
                <ChevronUp className="h-3 w-3" />
                Collapse section
              </button>
            </div>
          )}

          {/* ── No tab selected hint ── */}
          {!activeTab && (
            <div className="px-5 py-6 text-center sm:px-6">
              <p className="text-sm font-medium text-slate-400">
                Select a section above to learn more about this protocol
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}