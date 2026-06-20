'use client';

import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { useDuelCountdown } from '@/components/use-duel-countdown';
import { GameStatistics } from '@/components/game-statistics';
import { playTypingKeypress, playTypingComplete } from '@/lib/audio/sounds';
import { emitTelemetryAssessment } from '@/lib/lore/telemetry';

type TypingProtocolProps = {
  initialDuration?: DurationSeconds;
  initialLanguage?: LanguageKey;
  isSignedIn: boolean;
  isDailyGame?: boolean;
};

type LanguageKey = 'english' | 'german' | 'spanish';
type DurationSeconds = 30 | 60;

const WORD_BANKS: Record<LanguageKey, string[]> = {
  english: [
    'time', 'light', 'planet', 'pulse', 'target', 'vector', 'module', 'focus', 'signal', 'memory', 'motion', 'status', 'vision', 'system', 'pattern',
    'rhythm', 'switch', 'method', 'result', 'record', 'socket', 'cursor', 'bridge', 'sensor', 'calm', 'rapid', 'stable', 'energy', 'future', 'random',
    'velocity', 'hydrogen', 'molecule', 'synthesis', 'frequency', 'amplitude', 'spectrum', 'algorithm', 'dimension', 'threshold', 'triangle', 'protocol',
    'reaction', 'mechanism', 'radiation', 'infinity', 'metaphor', 'paradigm', 'transistor', 'capacitor', 'architecture', 'mathematics', 'computation',
    'transformation', 'oscillation', 'probability', 'calibration', 'resolution', 'navigation', 'projection', 'composition', 'atmosphere', 'resistance',
    'conduction', 'propulsion', 'extraction', 'absorption', 'perception', 'cognitive', 'experiment', 'hypothesis', 'phenomenon', 'convergence',
    'equilibrium', 'stellar', 'nebula', 'galactic', 'quantum', 'entropy', 'magnetism', 'electrode', 'particle', 'collision', 'synchronize',
    'demonstrate', 'application', 'fundamental', 'photographic', 'multiplatform', 'encapsulation', 'understanding', 'sophisticated', 'collaboration',
    'investigation', 'breakthrough', 'catastrophe', 'mathematical', 'philosophical', 'technological', 'revolutionary', 'infrastructure', 'communication',
    'instrumentation', 'bioengineering', 'environmental', 'neurological', 'computational', 'classification', 'verification', 'documentation',
  ],
  german: [
    'zeit', 'licht', 'planet', 'impuls', 'ziel', 'vektor', 'modul', 'fokus', 'signal', 'speicher', 'bewegung', 'status', 'muster', 'system', 'rhythmus',
    'wechsel', 'methode', 'ergebnis', 'rekord', 'sensor', 'tastatur', 'tempo', 'praezision', 'schnell', 'stabil', 'zufall', 'analyse', 'reaktion', 'training', 'labor',
    'geschwindigkeit', 'wissenschaft', 'technologie', 'kommunikation', 'information', 'verarbeitung', 'entwicklung', 'forschung', 'entdeckung', 'leistung',
    'beschleunigung', 'schwerkraft', 'elektrizitaet', 'molekuel', 'synthese', 'frequenz', 'spektrum', 'algorithmus', 'dimension', 'schwelle', 'protokoll',
    'mechanismus', 'strahlung', 'unendlichkeit', 'metapher', 'paradigma', 'transistor', 'architektur', 'mathematik', 'berechnung', 'transformation',
    'oszillation', 'wahrscheinlichkeit', 'kalibrierung', 'aufloesung', 'navigation', 'projektion', 'komposition', 'atmosphaere', 'widerstand',
    'extraktion', 'absorption', 'wahrnehmung', 'kognitiv', 'experiment', 'hypothese', 'phaenomen', 'konvergenz', 'gleichgewicht', 'magnetismus',
    'elektronik', 'kollision', 'synchronisation', 'gleichung', 'kristallstruktur', 'oberflaeche', 'niederspannung', 'hochgeschwindigkeit',
    'demonstrieren', 'anwendung', 'grundlegend', 'fotografisch', 'plattformuebergreifend', 'verkapselung', 'verstaendnis', 'anspruchsvoll',
    'zusammenarbeit', 'untersuchung', 'durchbruch', 'katastrophe', 'mathematisch', 'philosophisch', 'technologisch', 'revolutionaer',
    'infrastruktur', 'instrumentierung', 'umwelttechnik', 'neurologisch', 'berechnungsorientiert', 'klassifikation', 'verifikation', 'dokumentation',
  ],
  spanish: [
    'tiempo', 'luz', 'planeta', 'pulso', 'objetivo', 'vector', 'modulo', 'enfoque', 'senal', 'memoria', 'movimiento', 'estado', 'sistema', 'patron', 'ritmo',
    'cambio', 'metodo', 'resultado', 'record', 'sensor', 'teclado', 'velocidad', 'precision', 'rapido', 'estable', 'azar', 'analisis', 'reaccion', 'entreno', 'laboratorio',
    'velocimetro', 'cientifico', 'tecnologia', 'comunicacion', 'informacion', 'procesamiento', 'desarrollo', 'investigacion', 'descubrimiento', 'rendimiento',
    'aceleracion', 'gravedad', 'electricidad', 'molecula', 'sintesis', 'frecuencia', 'espectro', 'algoritmo', 'dimension', 'umbral', 'protocolo',
    'mecanismo', 'radiacion', 'infinidad', 'metafora', 'paradigma', 'transistor', 'arquitectura', 'matematicas', 'computacion', 'transformacion',
    'oscilacion', 'probabilidad', 'calibracion', 'resolucion', 'navegacion', 'proyeccion', 'composicion', 'atmosfera', 'resistencia', 'conduccion',
    'propulsion', 'extraccion', 'absorcion', 'percepcion', 'cognitivo', 'experimento', 'hipotesis', 'fenomeno', 'convergencia', 'equilibrio',
    'magnetismo', 'electrodo', 'particula', 'colision', 'sincronizar', 'ecuacion', 'superficie', 'cristalografia', 'electromagnetismo',
    'demostrar', 'aplicacion', 'fundamental', 'fotografico', 'multiplataforma', 'encapsulacion', 'comprension', 'sofisticado', 'colaboracion',
    'investigativo', 'descubrimiento', 'catastrofe', 'matematico', 'filosofico', 'tecnologico', 'revolucionario', 'infraestructura',
    'instrumentacion', 'bioingenieria', 'ambiental', 'neurologico', 'computacional', 'clasificacion', 'verificacion', 'documentacion',
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
  isDailyGame = false,
}: TypingProtocolProps) {
  const { goToIntermission, goToDailyResult, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('typing-speed');
  const typeCd = useDuelCountdown(isMultiplayerSession);
  const typeHasAutoStarted = useRef(false);

  useEffect(() => {
    if (!typeCd.launched || typeHasAutoStarted.current) return;
    typeHasAutoStarted.current = true;
    // Start timer immediately after countdown
    setStarted(true);
    setStartMs(performance.now());
    setElapsedMs(0);
  }, [typeCd.launched]); // eslint-disable-line

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
        playTypingComplete();
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

      if (response.ok) {
        emitTelemetryAssessment('typing-speed', metrics.labScore);
        if (isMultiplayerSession) {
          goToIntermission();
        } else if (multiplayerMeta.daily) {
          goToDailyResult();
        }
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

  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const wordsContainerRef = useRef<HTMLDivElement | null>(null);
  const cursorAnchorRef = useRef<HTMLSpanElement | null>(null);
  const typingAudioRef = useRef<AudioContext | null>(null);

  // Auto-scroll the words panel to keep the current typing position visible
  useEffect(() => {
    if (!started || finished) return;
    // Use a small delay so the DOM has rendered after the state update
    const id = setTimeout(() => {
      const anchor = cursorAnchorRef.current;
      const container = wordsContainerRef.current;
      if (anchor && container) {
        anchor.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 10);
    return () => clearTimeout(id);
  }, [input, started, finished]);

  function handleInputChange(nextValue: string) {
    if (finished) {
      return;
    }

    if (!started) {
      const now = performance.now();
      setStarted(true);
      setStartMs(now);
    }

    // Play keypress sound for each new character
    if (nextValue.length > input.length) {
      const newCharIndex = input.length;
      const isError = newCharIndex < targetText.length && nextValue[newCharIndex] !== targetText[newCharIndex];
      playTypingKeypress(isError);
    }

    const clamped = nextValue.slice(0, targetText.length);
    setInput(clamped);
  }

  // Handle keyboard input from physical keyboard (desktop)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // When the hidden input is focused (mobile keyboard active), let the input's
      // onChange handle everything to avoid double-processing
      if (document.activeElement === hiddenInputRef.current) {
        return;
      }

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
  }, [finished, hiddenInputRef, input, resetRun]);

  const visibleWords = words.slice(0, 120);

  function handlePanelClick() {
    hiddenInputRef.current?.focus();
  }

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

      {!isMultiplayerSession && !isDailyGame ? (
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
      ) : null}

      {typeCd.active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="text-center">
            {typeCd.phase === 'go' ? (
              <p className="text-7xl font-black tracking-tight text-emerald-600">GO</p>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Typing Speed Test</p>
                <p className="mt-2 text-8xl font-black tracking-tighter text-slate-800">{typeCd.value}</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="relative rounded-[1.7rem] border-2 border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-4 sm:p-5" onClick={handlePanelClick}>
        {/* Invisible input to capture keyboard on mobile — pinned to top so browser doesn't scroll mid-panel */}
        <input
          ref={hiddenInputRef}
          className="absolute left-0 right-0 top-0 z-10 h-0 w-full cursor-text overflow-hidden opacity-0"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          aria-label="Typing test input"
          tabIndex={0}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={(e) => {
            // Re-focus on blur so mobile keyboard stays open while typing
            if (!finished) {
              setTimeout(() => hiddenInputRef.current?.focus({ preventScroll: true }), 0);
            }
          }}
        />
        <div ref={wordsContainerRef} className="mb-4 max-h-96 overflow-auto rounded-[1.4rem] border-2 border-slate-200 bg-white/90 p-4 text-lg leading-8 text-slate-400 sm:text-xl sm:leading-9">
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
                  let charRef: React.RefObject<HTMLSpanElement | null> | undefined;
                  if (typedChar !== undefined) {
                    className = typedChar === char ? 'text-slate-800' : 'text-rose-500';
                  } else if (globalIndex === input.length) {
                    className = 'border-b-2 border-cyan-500 text-slate-600';
                    charRef = cursorAnchorRef;
                  }

                  return (
                    <span key={`${globalIndex}-${charIndex}`} className={className} ref={charRef}>
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
          Tap the words above to start typing on mobile.
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
      <p className="mt-1 text-sm font-medium text-slate-500">{finished ? 'Press Try Again for a new run.' : started ? 'Typing session running.' : isMultiplayerSession && typeCd.active ? 'Preparing...' : 'Start typing to begin the timer.'}</p>
        </div>
      </div>
    </section>
  );
}