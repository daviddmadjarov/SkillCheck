'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';

type TypingProtocolProps = {
  initialDuration?: DurationSeconds;
  initialLanguage?: LanguageKey;
  isSignedIn: boolean;
};

type LanguageKey = 'english' | 'german' | 'spanish';
type DurationSeconds = 30 | 60;

const WORD_BANKS: Record<LanguageKey, string[]> = {
  english: [
    'time', 'light', 'planet', 'pulse', 'target', 'vector', 'module', 'focus', 'signal', 'memory', 'motion', 'status', 'vision', 'system', 'pattern',
    'rhythm', 'switch', 'method', 'result', 'record', 'socket', 'cursor', 'bridge', 'sensor', 'calm', 'rapid', 'stable', 'energy', 'future', 'random',
  ],
  german: [
    'zeit', 'licht', 'planet', 'impuls', 'ziel', 'vektor', 'modul', 'fokus', 'signal', 'speicher', 'bewegung', 'status', 'muster', 'system', 'rhythmus',
    'wechsel', 'methode', 'ergebnis', 'rekord', 'sensor', 'tastatur', 'tempo', 'praezision', 'schnell', 'stabil', 'zufall', 'analyse', 'reaktion', 'training', 'labor',
  ],
  spanish: [
    'tiempo', 'luz', 'planeta', 'pulso', 'objetivo', 'vector', 'modulo', 'enfoque', 'senal', 'memoria', 'movimiento', 'estado', 'sistema', 'patron', 'ritmo',
    'cambio', 'metodo', 'resultado', 'record', 'sensor', 'teclado', 'velocidad', 'precision', 'rapido', 'estable', 'azar', 'analisis', 'reaccion', 'entreno', 'laboratorio',
  ],
};

const LANGUAGE_LABELS: Record<LanguageKey, string> = {
  english: 'English',
  german: 'Deutsch',
  spanish: 'Espanol',
};

function randomWords(language: LanguageKey, count: number) {
  const bank = WORD_BANKS[language];
  const generated: string[] = [];

  for (let i = 0; i < count; i += 1) {
    let candidate = bank[Math.floor(Math.random() * bank.length)];

    if (bank.length > 1 && i > 0) {
      while (candidate === generated[i - 1]) {
        candidate = bank[Math.floor(Math.random() * bank.length)];
      }
    }

    generated.push(candidate);
  }

  return generated;
}

function initialWords(language: LanguageKey, count: number) {
  const bank = WORD_BANKS[language];
  return Array.from({ length: count }, (_, index) => bank[index % bank.length]);
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

export function TypingProtocol({
  initialDuration = 30,
  initialLanguage = 'english',
  isSignedIn,
}: TypingProtocolProps) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('typing-speed');
  const [language, setLanguage] = useState<LanguageKey>(initialLanguage);
  const [duration, setDuration] = useState<DurationSeconds>(initialDuration);
  const [words, setWords] = useState<string[]>(() => initialWords(initialLanguage, 220));
  const [input, setInput] = useState('');
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const hasSavedRunRef = useRef(false);

  const targetText = useMemo(() => words.join(' '), [words]);
  const remainingSeconds = Math.max(0, duration - Math.floor(elapsedMs / 1000));

  const metrics = useMemo(() => {
    let correctChars = 0;
    let incorrectChars = 0;

    for (let i = 0; i < input.length; i += 1) {
      if (input[i] === targetText[i]) {
        correctChars += 1;
      } else {
        incorrectChars += 1;
      }
    }

    const totalTyped = input.length;
    const accuracy = totalTyped === 0 ? 100 : (correctChars / totalTyped) * 100;
    const elapsedMinutes = Math.max(elapsedMs / 60000, 1 / 60000);
    const wpm = Math.round((correctChars / 5) / elapsedMinutes);
    const speedFactor = Math.min(wpm / 120, 1);
    const accuracyFactor = Math.max(0, Math.min(accuracy / 100, 1));
    const labScore = Math.round(speedFactor * accuracyFactor * 1000);

    return {
      correctChars,
      accuracy,
      wpm,
      labScore,
    };
  }, [elapsedMs, input, targetText]);

  useEffect(() => {
    setWords(randomWords(initialLanguage, 220));
  }, [initialLanguage]);

  useEffect(() => {
    if (!started || finished || startMs === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextElapsed = performance.now() - startMs;
      if (nextElapsed >= duration * 1000) {
        setElapsedMs(duration * 1000);
        setFinished(true);
        setStarted(false);
        return;
      }

      setElapsedMs(nextElapsed);
    }, 50);

    return () => window.clearInterval(intervalId);
  }, [duration, finished, startMs, started]);

  useEffect(() => {
    if (!isSignedIn || !finished || hasSavedRunRef.current) {
      return;
    }

    hasSavedRunRef.current = true;

    void (async () => {
      const response = await fetch('/api/scores/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testSlug: 'typing-speed', score: metrics.labScore, ...multiplayerMeta }),
      });

      if (response.ok && isMultiplayerSession) {
        goToIntermission();
      }
    })();
  }, [finished, goToIntermission, isMultiplayerSession, isSignedIn, metrics.labScore, multiplayerMeta]);

  function resetRun(nextLanguage: LanguageKey = language, nextDuration: DurationSeconds = duration) {
    setWords(randomWords(nextLanguage, 220));
    setInput('');
    setStarted(false);
    setFinished(false);
    setStartMs(null);
    setElapsedMs(0);
    hasSavedRunRef.current = false;
  }

  function handleLanguageChange(nextLanguage: LanguageKey) {
    setLanguage(nextLanguage);
    resetRun(nextLanguage, duration);
  }

  function handleDurationChange(nextDuration: DurationSeconds) {
    setDuration(nextDuration);
    resetRun(language, nextDuration);
  }

  function handleInputChange(nextValue: string) {
    if (finished) {
      return;
    }

    if (!started) {
      const now = performance.now();
      setStarted(true);
      setStartMs(now);
    }

    const clamped = nextValue.slice(0, targetText.length);
    setInput(clamped);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        resetRun();
        return;
      }

      if (finished) {
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        setInput((current) => current.slice(0, -1));
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        handleInputChange(input + ' ');
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        handleInputChange(input + event.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [finished, input, resetRun]);

  const visibleWords = words.slice(0, 120);

  return (
    <section className="lab-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Typing Category</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">Typing Speed Test</h2>
        </div>
        <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
          {isSignedIn ? 'Leaderboard sync active' : 'Guest mode'}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(LANGUAGE_LABELS) as LanguageKey[]).map((key) => (
          <button
            key={key}
            className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${language === key ? 'border-cyan-300 bg-cyan-100 text-cyan-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            onClick={() => handleLanguageChange(key)}
            type="button"
          >
            {LANGUAGE_LABELS[key]}
          </button>
        ))}

        {[30, 60].map((value) => (
          <button
            key={value}
            className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${duration === value ? 'border-indigo-300 bg-indigo-100 text-indigo-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            onClick={() => handleDurationChange(value as DurationSeconds)}
            type="button"
          >
            {value}s
          </button>
        ))}

        <button className="rounded-full border-2 border-slate-800 bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700" onClick={() => resetRun()} type="button">
          New words
        </button>
      </div>

      <div className="rounded-[1.7rem] border-2 border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-4 sm:p-5">
        <div className="relative mb-4 rounded-[1.4rem] border-2 border-slate-200 bg-white/90 p-4 text-lg leading-8 text-slate-400 sm:text-xl sm:leading-9">
          <div className={finished ? 'pointer-events-none blur-[2.5px]' : ''}>
          {visibleWords.map((word, wordIndex) => {
            const beforeWord = visibleWords.slice(0, wordIndex).join(' ');
            const wordStart = beforeWord.length + (wordIndex === 0 ? 0 : 1);

            return (
              <span key={`${word}-${wordIndex}`} className="mr-3 inline-block">
                {word.split('').map((char, charIndex) => {
                  const globalIndex = wordStart + charIndex;
                  const typedChar = input[globalIndex];

                  let className = 'text-slate-400';
                  if (typedChar !== undefined) {
                    className = typedChar === char ? 'text-slate-800' : 'text-rose-500';
                  } else if (globalIndex === input.length) {
                    className = 'border-b-2 border-cyan-500 text-slate-600';
                  }

                  return (
                    <span key={`${globalIndex}-${charIndex}`} className={className}>
                      {char}
                    </span>
                  );
                })}
              </span>
            );
          })}
          </div>

          {finished && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-sm">
              <button className="lab-button" onClick={() => resetRun()} type="button">
                Try Again
              </button>
            </div>
          )}
        </div>

        <p className="text-sm font-semibold text-slate-500">
          Just start typing. Press Escape to reset.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Time left</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{remainingSeconds}s</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{started && !finished ? 'Test is live.' : finished ? 'Run complete.' : 'Start typing to begin.'}</p>
        </div>

        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">WPM</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{metrics.wpm}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Words per minute based on correct chars.</p>
        </div>

        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Accuracy</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{formatPercent(metrics.accuracy)}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Correct vs total typed characters.</p>
        </div>

        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Lab score</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{metrics.labScore}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">Combined speed and accuracy score out of 1000.</p>
        </div>

        <div className="cursor-pointer rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Status</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{finished ? 'Done' : started ? 'Live' : 'Ready'}</p>
          <p className="mt-1 text-sm font-medium text-slate-500">{finished ? 'Press Try Again for a new run.' : started ? 'Typing session running.' : 'Start typing to begin the timer.'}</p>
        </div>
      </div>
    </section>
  );
}
