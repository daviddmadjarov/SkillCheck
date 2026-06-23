'use client';

import { useState, useCallback, ReactNode } from 'react';
import { ModePicker, type ModeOption } from '@/components/mode-picker';

type CategoryShellProps = {
  /** Initial mode resolved from server */
  initialMode: string;
  /** All available modes */
  modes: ModeOption[];
  /** Renders the active game component */
  gameComponent: (mode: string) => ReactNode;
  /** Renders statistics below the game. Receives current mode id. */
  statistics?: (mode: string) => ReactNode;
  /** When true, hides mode picker and game content for session-based play */
  isSessionLocked?: boolean;
};

/**
 * Client wrapper that manages mode switching without page navigation.
 * The mode picker lives inline (compact) and game content updates instantly.
 */
export function CategoryShell({
  initialMode,
  modes,
  gameComponent,
  statistics,
  isSessionLocked,
}: CategoryShellProps) {
  const [activeMode, setActiveMode] = useState(initialMode);

  const handleModeChange = useCallback((modeId: string) => {
    setActiveMode(modeId);
  }, []);

  // For session-locked modes (multiplayer/daily), render game directly without picker
  if (isSessionLocked) {
    return <>{gameComponent(initialMode)}</>;
  }

  return (
    <>
      {/* Inline mode picker */}
      <div className="lab-card p-3 sm:p-4">
        <ModePicker
          modes={modes}
          activeMode={activeMode}
          onModeChange={handleModeChange}
        />
      </div>

      {/* Game content */}
      {gameComponent(activeMode)}

      {/* Statistics */}
      {statistics ? statistics(activeMode) : null}
    </>
  );
}
