'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type SoundToggleContextValue = {
  soundEnabled: boolean;
  toggleSound: () => void;
};

const SoundToggleContext = createContext<SoundToggleContextValue | null>(null);
const STORAGE_KEY = 'skillcheck-sound-enabled';

export function SoundToggleProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setSoundEnabled(stored === 'true');
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');

      // When turning sounds back on, play a confirmation jiggle
      if (next) {
        // Use a small delay so the context updates before we try to play
        setTimeout(() => playSoundOnJiggle(), 50);
      }

      return next;
    });
  }, []);

  return (
    <SoundToggleContext.Provider value={{ soundEnabled, toggleSound }}>
      {children}
    </SoundToggleContext.Provider>
  );
}

export function useSoundToggle(): SoundToggleContextValue {
  const value = useContext(SoundToggleContext);
  if (!value) {
    throw new Error('useSoundToggle must be used within a SoundToggleProvider');
  }
  return value;
}

/** Tiny jiggle sound — two quick ascending notes to confirm sounds are back on. */
function playSoundOnJiggle() {
  const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  const ac = new AC();
  if (ac.state === 'suspended') {
    ac.resume().catch(() => {});
  }

  const now = ac.currentTime;

  // First quick note
  const osc1 = ac.createOscillator();
  const g1 = ac.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
  g1.gain.setValueAtTime(0.001, now);
  g1.gain.linearRampToValueAtTime(0.07, now + 0.003);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc1.connect(g1);
  g1.connect(ac.destination);
  osc1.start(now);
  osc1.stop(now + 0.1);

  // Second quick note
  const osc2 = ac.createOscillator();
  const g2 = ac.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1000, now + 0.08);
  osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.14);
  g2.gain.setValueAtTime(0.001, now + 0.08);
  g2.gain.linearRampToValueAtTime(0.05, now + 0.083);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc2.connect(g2);
  g2.connect(ac.destination);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.18);

  // Clean up the context after the sound plays
  setTimeout(() => {
    ac.close().catch(() => {});
  }, 500);
}