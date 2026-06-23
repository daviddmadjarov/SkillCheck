'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export type ModeOption = {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
};

type ModePickerProps = {
  modes: ModeOption[];
  activeMode: string;
  onModeChange: (modeId: string) => void;
  /** When true, hides the mode picker entirely (e.g. multiplayer/daily sessions) */
  hidden?: boolean;
};

/**
 * Compact segmented control for switching game modes.
 * Replaces the separate tab-bar section in category pages.
 * Updates the URL query param on change (for deep-link support)
 * but does NOT cause a full page navigation.
 */
export function ModePicker({ modes, activeMode, onModeChange, hidden }: ModePickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (hidden) return null;

  function handleChange(modeId: string) {
    onModeChange(modeId);

    // Update URL for deep-link support without full navigation
    const next = new URLSearchParams(searchParams.toString());
    next.set('mode', modeId);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Game mode selector">
      {modes.map((mode) => {
        const isActive = activeMode === mode.id;
        return (
          <button
            key={mode.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => handleChange(mode.id)}
            className={`rounded-full border-2 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] transition-all duration-100 ${
              isActive
                ? 'border-cyan-300 bg-cyan-100 text-cyan-800 shadow-[0_2px_0_rgba(103,232,249,1)]'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {mode.shortLabel ?? mode.label}
            {mode.description && !isActive && (
              <span className="ml-1.5 hidden text-[10px] font-medium text-slate-400 sm:inline">
                {mode.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
