'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { ModePicker, type ModeOption } from '@/components/mode-picker';

type ModePickerWrapperProps = {
  modes: ModeOption[];
  activeMode: string;
  /** When true, hides the picker entirely */
  hidden?: boolean;
};

/**
 * Thin client wrapper around ModePicker that syncs URL searchParams on change.
 * Renders inline — no function props, just data + children placement.
 */
export function ModePickerWrapper({ modes, activeMode, hidden }: ModePickerWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = useCallback((modeId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('mode', modeId);
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  if (hidden) return null;

  return (
    <div className="lab-card p-3 sm:p-4">
      <ModePicker
        modes={modes}
        activeMode={activeMode}
        onModeChange={handleChange}
      />
    </div>
  );
}
