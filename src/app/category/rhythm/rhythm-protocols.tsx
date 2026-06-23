'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { BetweenRoundCountdown } from '@/components/between-round-countdown';
import { useDuelCountdown } from '@/components/use-duel-countdown';
import { ResponseTimer } from '@/components/response-timer';
import RhythmLockGame from '@/components/rhythm-lock-game';
import { emitTelemetryAssessment } from '@/lib/lore/telemetry';

type RhythmMode = 'sync' | 'timer' | 'overclock';

type RhythmProtocolsProps = {
  isSignedIn: boolean;
  mode: RhythmMode;
};

type RhythmStat = {
  detail: string;
  label: string;
  value: string;
};

type SaveState = 'idle' | 'guest';

const MODE_META = {
  sync: {
    accent: 'border-violet-300 bg-violet-100 text-violet-800',
    description: 'Listen to short grooves and estimate the BPM. Four rounds, one final accuracy score.',
    kicker: 'Flow Timing',
    title: 'Sync Test',
  },
  timer: {
    accent: 'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800',
    description: 'Memorize the early timer movement, then stop exactly at the target second while the display fades away.',
    kicker: 'Blind Time Control',
    title: 'Stop the Timer',
  },
  overclock: {
    accent: 'border-rose-300 bg-rose-100 text-rose-800',
    description: 'Hit the moving target as the ball orbits the ring — 30 seconds of escalating speed and reflex intensity.',
    kicker: 'Reflex Overdrive',
    title: 'Overclock',
  },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function useRhythmAudio() {
  const audioContextRef = useRef<AudioContext | null>(null);

  function getContext() {
    if (typeof window === 'undefined') {
      return null;
    }

    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) {
      return null;
    }

    if (audioContextRef.current === null) {
      audioContextRef.current = new Context();
    }

    return audioContextRef.current;
  }

  async function unlock() {
    const context = getContext();
    if (!context) {
      return;
    }

    if (context.state !== 'running') {
      await context.resume();
    }
  }

  function pulse(frequency: number, duration: number, gainValue: number, type: OscillatorType, whenOffset = 0) {
    const context = getContext();
    if (!context) {
      return;
    }

    const now = context.currentTime + whenOffset;
    const gain = context.createGain();
    const oscillator = context.createOscillator();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function playBeat(beatIndex: number) {
    if (beatIndex % 4 === 0) {
      pulse(72, 0.18, 0.28, 'triangle');
      pulse(40, 0.16, 0.16, 'sine');
      return;
    }

    if (beatIndex % 4 === 2) {
      pulse(220, 0.11, 0.16, 'square');
      pulse(150, 0.08, 0.09, 'triangle', 0.01);
      return;
    }

    pulse(950, 0.05, 0.06, 'square');
  }

  function playTapFeedback(tight: boolean) {
    if (tight) {
      pulse(620, 0.07, 0.1, 'triangle');
      return;
    }

    pulse(300, 0.05, 0.06, 'sine');
  }

  function playTimerStart() {
    pulse(420, 0.11, 0.11, 'triangle');
    pulse(620, 0.08, 0.08, 'triangle', 0.09);
  }

  function playTimerStop() {
    pulse(680, 0.1, 0.1, 'triangle');
    pulse(480, 0.1, 0.08, 'triangle', 0.1);
  }

  return {
    playBeat,
    playTapFeedback,
    playTimerStart,
    playTimerStop,
    unlock,
  };
}

function RhythmShell({
  accent,
  children,
  description,
  isSignedIn,
  kicker,
  stats,
  title,
}: {
  accent: string;
  children: React.ReactNode;
  description: string;
  isSignedIn: boolean;
  kicker: string;
  stats: RhythmStat[];
  title: string;
}) {
  return (
    <section className="lab-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Rhythm Category</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">{title}</h2>
          <p className={`mt-2 inline-flex rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${accent}`} title={description}>{kicker}</p>
        </div>
        <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 shrink-0">
          {isSignedIn ? 'Leaderboard sync optional' : 'Guest mode'}
        </div>
      </div>

      <p className="mt-2 mb-0 text-xs font-medium leading-5 text-slate-400">{description}</p>

      {children}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-3 sm:min-h-[120px]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{stat.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{stat.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SyncTest({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('perfect-sync');
  const BPM_MIN = 40;
  const BPM_MAX = 200;
  const TOTAL_ROUNDS = 4;
  const BEATS_PER_ROUND = 8;
  const syncCd = useDuelCountdown(isMultiplayerSession);
  const syncHasAutoStarted = useRef(false);

  useEffect(() => {
    if (!syncCd.launched || syncHasAutoStarted.current) return;
    syncHasAutoStarted.current = true;
    void startRun();
  }, [syncCd.launched]); // eslint-disable-line

  const [phase, setPhase] = useState<'idle' | 'listening' | 'guess' | 'reveal' | 'finished'>('idle');
  const [lastGuess, setLastGuess] = useState<number | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [beatIndex, setBeatIndex] = useState(-1);
  const [roundBpms, setRoundBpms] = useState<number[]>([]);
  const [roundGuesses, setRoundGuesses] = useState<number[]>([]);
  const [guessInput, setGuessInput] = useState('');
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [patternName, setPatternName] = useState('Prism Groove');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastRoundError, setLastRoundError] = useState<number | null>(null);

  const runStartMsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const playedBeatRef = useRef(-1);
  const audio = useRhythmAudio();

  const beatIntervalMs = 60000 / bpm;
  const averageErrorMs = roundBpms.length === 0
    ? null
    : Math.round(roundBpms.reduce((sum, actualBpm, index) => sum + Math.abs(actualBpm - roundGuesses[index]), 0) / roundBpms.length);

  const liveScore = useMemo(() => {
    if (averageErrorMs === null) {
      return null;
    }

    return clamp(Math.round(1000 - averageErrorMs * 8), 0, 1000);
  }, [averageErrorMs]);

  useEffect(() => {
    if (phase !== 'listening') {
      return;
    }

    const runStart = performance.now();
    runStartMsRef.current = runStart;
    playedBeatRef.current = -1;

    const update = () => {
      const now = performance.now();
      const elapsed = now - runStart;
      const currentBeat = Math.floor(elapsed / beatIntervalMs);

      if (currentBeat !== playedBeatRef.current && currentBeat >= 0 && currentBeat < BEATS_PER_ROUND) {
        playedBeatRef.current = currentBeat;
        setBeatIndex(currentBeat);
        audio.playBeat(currentBeat);
      }

      if (elapsed >= BEATS_PER_ROUND * beatIntervalMs + 220) {
        setPhase('guess');
        setBeatIndex(BEATS_PER_ROUND - 1);
        return;
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
    };
  }, [beatIntervalMs, bpm, phase]);

  async function startRun() {
    audio.unlock().catch(() => {});

    const nextBpm = Math.floor(BPM_MIN + Math.random() * (BPM_MAX - BPM_MIN + 1));
    const patternPool = ['Prism Groove', 'Neon Bounce', 'Pulse Drift', 'Circuit Swing', 'Static Drop'];

    setPatternName(patternPool[Math.floor(Math.random() * patternPool.length)]);
    setBpm(nextBpm);
    setPhase('listening');
    setRoundIndex(0);
    setBeatIndex(-1);
    setRoundBpms([]);
    setRoundGuesses([]);
    setGuessInput('');
    setLastRoundError(null);
    setSaveState(isSignedIn ? 'idle' : 'guest');
  }

  async function replayRound() {
    if (phase !== 'guess') {
      return;
    }

    audio.unlock().catch(() => {});
    setBeatIndex(-1);
    setPhase('listening');
  }

  async function advanceFromReveal() {
    if (phase !== 'reveal') {
      return;
    }

    const isLastRound = roundIndex + 1 >= TOTAL_ROUNDS;
    if (isLastRound) {
      setPhase('finished');
      return;
    }

    audio.unlock().catch(() => {});
    const patternPool = ['Prism Groove', 'Neon Bounce', 'Pulse Drift', 'Circuit Swing', 'Static Drop'];
    const nextBpm = Math.floor(BPM_MIN + Math.random() * (BPM_MAX - BPM_MIN + 1));
    setPatternName(patternPool[Math.floor(Math.random() * patternPool.length)]);
    setBpm(nextBpm);
    setRoundIndex((current) => current + 1);
    setBeatIndex(-1);
    setPhase('listening');
  }

  // In multiplayer, auto-advance past "See Final Score"
  useEffect(() => {
    if (!isMultiplayerSession || phase !== 'reveal') return;
    if (roundIndex + 1 >= TOTAL_ROUNDS) {
      const t = setTimeout(() => setPhase('finished'), 1200);
      return () => clearTimeout(t);
    }
  }, [isMultiplayerSession, phase, roundIndex]);

  async function submitGuess() {
    if (phase !== 'guess') {
      return;
    }

    const parsedGuess = Math.round(Number(guessInput));
    if (!Number.isFinite(parsedGuess) || parsedGuess < 30 || parsedGuess > 260) {
      return;
    }

    const nextBpms = [...roundBpms, bpm];
    const nextGuesses = [...roundGuesses, parsedGuess];
    const currentError = Math.abs(parsedGuess - bpm);

    setRoundBpms(nextBpms);
    setRoundGuesses(nextGuesses);
    setLastRoundError(currentError);
    setLastGuess(parsedGuess);
    setGuessInput('');

    if (roundIndex + 1 >= TOTAL_ROUNDS) {
      const avgError = Math.round(nextBpms.reduce((sum, actualBpm, index) => sum + Math.abs(actualBpm - nextGuesses[index]), 0) / nextBpms.length);
      const finalScore = clamp(Math.round(1000 - avgError * 8), 0, 1000);
      setBestScore((current) => (current === null ? finalScore : Math.max(current, finalScore)));

      if (isSignedIn) {
        void fetch('/api/scores/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testSlug: 'perfect-sync', score: finalScore, ...multiplayerMeta }),
        }).then(() => {
          emitTelemetryAssessment('perfect-sync', finalScore);
        });
      }
    }

    setPhase('reveal');
  }

  function handleGuessKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    void submitGuess();
  }

  const progress = clamp(((roundIndex + 1) / TOTAL_ROUNDS) * 100, 0, 100);
  const beatProgress = clamp(((beatIndex + 1) / BEATS_PER_ROUND) * 100, 0, 100);

  return (
    <RhythmShell
      title={MODE_META.sync.title}
      kicker={MODE_META.sync.kicker}
      description={MODE_META.sync.description}
      accent={MODE_META.sync.accent}
      isSignedIn={isSignedIn}
      stats={[
        { label: 'Round', value: `${Math.min(roundIndex + 1, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`, detail: 'Every run has four BPM guessing rounds.' },
        { label: 'BPM range', value: `${BPM_MIN}-${BPM_MAX}`, detail: 'Expanded tempo range for harder reads and better replayability.' },
        { label: 'Avg error', value: averageErrorMs === null ? '--' : `${averageErrorMs} BPM`, detail: 'Average absolute difference between true BPM and your guesses.' },
        { label: 'Lab score', value: liveScore === null ? '--' : String(liveScore), detail: bestScore === null ? 'Final score is based on average BPM guess error.' : `Best local score: ${bestScore}.` },
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {phase === 'guess' && (
            <button className="lab-button" onClick={replayRound} type="button">
              Replay Groove
            </button>
          )}

          <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
            {phase === 'listening'
              ? `Listening... Beat ${Math.max(beatIndex + 1, 0)} / ${BEATS_PER_ROUND}`
              : phase === 'guess'
                ? 'Enter your BPM guess'
                : phase === 'reveal'
                  ? `Round ${roundIndex + 1} result`
                  : 'Press start to generate a new groove'}
          </div>
        </div>

        <div className="relative min-h-[24rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-4 sm:min-h-[28rem]">
          <div className="absolute inset-x-4 top-4 h-4 overflow-hidden rounded-full border-2 border-slate-200 bg-white">
            <div className="h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>

          <div className="absolute inset-x-4 top-10 h-2 overflow-hidden rounded-full border border-slate-200 bg-white">
            <div className="h-full bg-gradient-to-r from-cyan-300 to-violet-400 transition-[width] duration-100" style={{ width: `${beatProgress}%` }} />
          </div>

          <div className="absolute inset-x-4 top-14 bottom-4 flex flex-col gap-3">
            <div className="grid h-full grid-cols-4 gap-3">
              {Array.from({ length: BEATS_PER_ROUND }).map((_, index) => {
                const isCurrent = index === beatIndex;
                const isQuarter = index % 4 === 0;

                return (
                  <div
                    className={`rounded-2xl border-2 transition-all duration-150 ${isCurrent ? 'scale-[1.04] border-violet-400 bg-violet-200 shadow-[0_0_32px_rgba(167,139,250,0.6)]' : isQuarter ? 'border-fuchsia-200 bg-fuchsia-50' : 'border-slate-200 bg-white'}`}
                    key={index}
                  />
                );
              })}
            </div>
          </div>

          {phase === 'idle' && isMultiplayerSession && syncCd.active && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]">
              <div className="text-center">{syncCd.phase === 'go' ? <p className="text-7xl font-black text-emerald-600">GO</p> : <p className="text-8xl font-black text-slate-800">{syncCd.value}</p>}</div>
            </div>
          )}
          {phase === 'idle' && !isMultiplayerSession && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Sync Test</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">Listen to the groove and guess the BPM. Four rounds.</p>
                <button data-start-game className="lab-button mt-4" onClick={startRun} type="button">Start Sync Test</button>
              </div>
            </div>
          )}

          {phase === 'guess' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{patternName}</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">What BPM was that groove?</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <input
                    autoFocus
                    className="lab-input w-28 text-center"
                    id="bpm-guess"
                    inputMode="numeric"
                    max={260}
                    min={30}
                    onChange={(event) => setGuessInput(event.target.value)}
                    onKeyDown={handleGuessKeyDown}
                    placeholder="e.g. 128"
                    value={guessInput}
                  />
                  <button className="lab-button" onClick={() => void submitGuess()} type="button">Lock</button>
                </div>
              </div>
            </div>
          )}

          {phase === 'reveal' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Round {roundIndex + 1} result</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-slate-800">{bpm} BPM</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Your guess: {lastGuess} BPM</p>
                <p className={`mt-1 text-sm font-bold ${lastRoundError !== null && lastRoundError <= 5 ? 'text-emerald-600' : lastRoundError !== null && lastRoundError <= 15 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {lastRoundError === 0 ? 'Perfect!' : lastRoundError !== null ? `Off by ${lastRoundError} BPM` : ''}
                </p>
                <button className="lab-button mt-4" onClick={() => void advanceFromReveal()} type="button">
                  {roundIndex + 1 >= TOTAL_ROUNDS ? 'See Final Score' : 'Next Round'}
                </button>
              </div>
            </div>
          )}

          {phase === 'finished' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-slate-800">{liveScore ?? '--'}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Avg error: {averageErrorMs} BPM</p>
                <button className="lab-button mt-4" onClick={startRun} type="button">Start New Run</button>
              </div>
            </div>
          )}
        </div>

        <p className="text-sm font-semibold text-slate-500">
          {saveState === 'guest'
            ? 'Guest mode active. Scores stay local for rhythm for now.'
            : 'Tip: count accents and estimate interval spacing before locking your guess.'}
        </p>
      </div>
    </RhythmShell>
  );
}

function StopTimer({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, goToDailyResult, isMultiplayerSession, isDailyGame, meta: multiplayerMeta } = useMultiplayerRoundFlow('stop-timer');
  const TOTAL_ROUNDS = 4;
  const cd = useDuelCountdown(isMultiplayerSession);
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    if (!cd.launched || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    void startRun();
  }, [cd.launched]); // eslint-disable-line

  const [phase, setPhase] = useState<'idle' | 'running' | 'reveal' | 'finished'>('idle');
  const [roundIndex, setRoundIndex] = useState(0);
  const [targetMs, setTargetMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerVisible, setTimerVisible] = useState(true);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [roundErrors, setRoundErrors] = useState<number[]>([]);
  const [lastErrorMs, setLastErrorMs] = useState<number | null>(null);
  const [lastStoppedMs, setLastStoppedMs] = useState<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startMsRef = useRef<number | null>(null);
  const audio = useRhythmAudio();

  const targetSeconds = (targetMs / 1000).toFixed(1);
  const visibleSeconds = (elapsedMs / 1000).toFixed(2);

  const averageErrorMs = roundErrors.length === 0
    ? null
    : Math.round(roundErrors.reduce((sum, e) => sum + e, 0) / roundErrors.length);

  const finalScore = useMemo(() => {
    if (averageErrorMs === null) return null;
    return clamp(Math.round(1000 - Math.max(0, averageErrorMs - 50) * 0.25), 0, 1000);
  }, [averageErrorMs]);

  // Auto-advance in duel mode
  useEffect(() => {
    if (!isMultiplayerSession || phase !== 'reveal') return;
    if (roundIndex + 1 >= TOTAL_ROUNDS) {
      const t = setTimeout(() => setPhase('finished'), 2000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => void advanceRound(), 2000);
    return () => clearTimeout(t);
  }, [isMultiplayerSession, phase, roundIndex]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (hideTimeoutRef.current !== null) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;

    const step = () => {
      if (startMsRef.current === null) return;
      setElapsedMs(performance.now() - startMsRef.current);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase]);

  function generateTarget() {
    const randomTenths = Math.floor(Math.random() * 171) + 30;
    return randomTenths * 100;
  }

  async function startRound() {
    audio.unlock().catch(() => {});

    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    const nextTargetMs = generateTarget();
    setTargetMs(nextTargetMs);
    setElapsedMs(0);
    setLastErrorMs(null);
    setLastStoppedMs(null);
    setTimerVisible(true);
    setPhase('running');
    startMsRef.current = performance.now();
    audio.playTimerStart();

    hideTimeoutRef.current = setTimeout(() => setTimerVisible(false), 1500);
  }

  async function startRun() {
    setRoundIndex(0);
    setRoundErrors([]);
    setLastErrorMs(null);
    setLastStoppedMs(null);
    await startRound();
  }

  function stopRound() {
    if (phase !== 'running' || startMsRef.current === null) return;

    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const finalElapsed = performance.now() - startMsRef.current;
    const error = Math.round(Math.abs(finalElapsed - targetMs));

    setElapsedMs(finalElapsed);
    setLastErrorMs(error);
    setLastStoppedMs(finalElapsed);
    setTimerVisible(true);
    setPhase('reveal');
    audio.playTimerStop();

    const nextErrors = [...roundErrors, error];
    setRoundErrors(nextErrors);

    if (roundIndex + 1 >= TOTAL_ROUNDS) {
      const avg = Math.round(nextErrors.reduce((sum, e) => sum + e, 0) / nextErrors.length);
      const score = clamp(Math.round(1000 - Math.max(0, avg - 50) * 0.25), 0, 1000);
      setBestScore((current) => (current === null ? score : Math.max(current, score)));

      if (isDailyGame) {
        void fetch('/api/scores/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testSlug: 'stop-timer', score, ...multiplayerMeta }),
        }).then(() => {
          goToDailyResult();
        });
        return;
      }

      if (isSignedIn) {
        void fetch('/api/scores/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testSlug: 'stop-timer', score, ...multiplayerMeta }),
        }).then(() => {
          emitTelemetryAssessment('stop-timer', score);
          if (isMultiplayerSession) goToIntermission();
        });
      }
    }
  }

  async function advanceRound() {
    if (phase !== 'reveal') return;

    if (roundIndex + 1 >= TOTAL_ROUNDS) {
      setPhase('finished');
      return;
    }

    setRoundIndex((current) => current + 1);
    startRound().catch(() => {});
  }

  const roundScore = lastErrorMs === null ? null : clamp(Math.round(1000 - Math.max(0, lastErrorMs - 50) * 0.25), 0, 1000);

  return (
    <RhythmShell
      title={MODE_META.timer.title}
      kicker={MODE_META.timer.kicker}
      description={MODE_META.timer.description}
      accent={MODE_META.timer.accent}
      isSignedIn={isSignedIn}
      stats={[
        { label: 'Round', value: `${Math.min(roundIndex + 1, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`, detail: 'Four rounds per run, each with a new random target.' },
        { label: 'Target', value: phase === 'idle' ? '--' : `${targetSeconds}s`, detail: 'Random target between 3.0s and 20.0s.' },
        { label: 'Avg error', value: averageErrorMs === null ? '--' : `${averageErrorMs} ms`, detail: 'Average absolute error across all completed rounds.' },
        { label: 'Lab score', value: finalScore === null ? '--' : String(finalScore), detail: bestScore === null ? 'Scaled from timing precision on a 1000-point range.' : `Best local score: ${bestScore}.` },
      ]}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
            {phase === 'running'
              ? timerVisible ? 'Memorize the motion...' : 'Trust your clock — stop now!'
              : phase === 'reveal'
                ? `Round ${roundIndex + 1} result`
                : phase === 'finished'
                  ? 'Run complete'
                  : 'Press start'}
          </div>
        </div>

        <div className="relative min-h-[24rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-fuchsia-50 via-white to-slate-50 p-4 sm:min-h-[28rem]">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(217,70,239,0.18), transparent 34%), radial-gradient(circle at 78% 72%, rgba(79,70,229,0.16), transparent 36%)' }} />

          <div className="relative z-10 flex h-full min-h-[20rem] flex-col items-center justify-center gap-6 text-center">
            {cd.active && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]">
                <div className="text-center">{cd.phase === 'go' ? <p className="text-7xl font-black text-emerald-600">GO</p> : <p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div>
              </div>
            )}
            <BetweenRoundCountdown
              active={isMultiplayerSession && phase === 'reveal' && roundIndex + 1 < TOTAL_ROUNDS}
              label={`Round ${roundIndex + 2}`}
              onLaunch={() => void advanceRound()}
            />
            {phase === 'running' && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Stop at</p>
                  <p className="mt-2 text-6xl font-black tracking-tight text-slate-800">{targetSeconds}s</p>
                </div>
                <div className={`transition-opacity duration-700 ${timerVisible ? 'opacity-100' : 'opacity-0'}`}>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Timer</p>
                  <p className="mt-1 text-5xl font-black tracking-tight text-slate-800">{visibleSeconds}s</p>
                </div>
                <button className="lab-button" onPointerDown={stopRound} type="button">Stop Now</button>
              </>
            )}
          </div>

          {phase === 'idle' && !isMultiplayerSession && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Stop the Timer</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">Watch the timer for 1.5s, then stop it exactly on the target. Four rounds.</p>
                <button data-start-game className="lab-button mt-4" onClick={startRun} type="button">Start Timer</button>
              </div>
            </div>
          )}

          {phase === 'reveal' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Round {roundIndex + 1} result</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-slate-800">Target: {targetSeconds}s</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">You stopped at: {lastStoppedMs !== null ? (lastStoppedMs / 1000).toFixed(3) : '--'}s</p>
                <p className={`mt-1 text-sm font-bold ${lastErrorMs !== null && lastErrorMs <= 100 ? 'text-emerald-600' : lastErrorMs !== null && lastErrorMs <= 400 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {lastErrorMs === 0 ? 'Perfect!' : lastErrorMs !== null ? `Off by ${lastErrorMs} ms` : ''}
                </p>
                {roundScore !== null && <p className="mt-1 text-sm font-semibold text-slate-500">Round score: {roundScore}</p>}
                <button className="lab-button mt-4" onClick={() => void advanceRound()} type="button">
                  {roundIndex + 1 >= TOTAL_ROUNDS ? 'See Final Score' : 'Next Round'}
                </button>
              </div>
            </div>
          )}

          {phase === 'finished' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p>
                <p className="mt-3 text-4xl font-black tracking-tight text-slate-800">{finalScore ?? '--'}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Avg error: {averageErrorMs} ms</p>
                <button className="lab-button mt-4" onClick={startRun} type="button">Start New Run</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </RhythmShell>
  );
}

function OverclockGame({ isSignedIn }: { isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('overclock');
  const cd = useDuelCountdown(isMultiplayerSession);

  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [autoStart, setAutoStart] = useState(false);

  // In duel/party: start game when countdown finishes
  useEffect(() => {
    if (cd.launched) {
      setAutoStart(true);
    }
  }, [cd.launched]);

  const handleGameComplete = useCallback((score: number) => {
    setFinalScore(score);
    setBestScore((prev) => (prev === null ? score : Math.max(prev, score)));

    if (isMultiplayerSession) {
      goToIntermission();
    } else if (isSignedIn) {
      void fetch('/api/scores/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testSlug: 'overclock', score, ...multiplayerMeta }),
      }).then(() => {
        emitTelemetryAssessment('overclock', score);
      });
    }
  }, [isSignedIn, isMultiplayerSession, multiplayerMeta, goToIntermission]);

  const handleScoreUpdate = useCallback((_score: number) => {
    // Could be used for live stat display
  }, []);

  const retry = useCallback(() => {
    setGameKey((k) => k + 1);
    setFinalScore(null);
  }, []);

  return (
    <RhythmShell
      title={MODE_META.overclock.title}
      kicker={MODE_META.overclock.kicker}
      description={MODE_META.overclock.description}
      accent={MODE_META.overclock.accent}
      isSignedIn={isSignedIn}
      stats={[
        { label: 'Time limit', value: '30s', detail: 'Race the clock — every millisecond counts.' },
        { label: 'Streak bonus', value: '+0.25x', detail: 'Speed increases by 0.25 rad/s per consecutive hit.' },
        { label: 'Last score', value: finalScore === null ? '--' : String(finalScore), detail: 'Points = total successful checks.' },
        { label: 'Best score', value: bestScore === null ? '--' : String(bestScore), detail: bestScore === null ? 'Complete a run to set a local best.' : `Personal best this session.` },
      ]}
    >
      <div className="space-y-4">
        <div className="relative min-h-[24rem] sm:min-h-[28rem]">
          {cd.active && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm rounded-[2rem]">
              <div className="text-center">
                {cd.phase === 'go' ? (
                  <p className="text-7xl font-black text-emerald-400">GO</p>
                ) : (
                  <p className="text-8xl font-black text-white">{cd.value}</p>
                )}
              </div>
            </div>
          )}
          <RhythmLockGame
            key={gameKey}
            timeLimit={30}
            initialSpeed={2}
            autoStart={autoStart}
            onGameComplete={handleGameComplete}
            onScoreUpdate={handleScoreUpdate}
          />
        </div>
      </div>
    </RhythmShell>
  );
}

export function RhythmProtocols({ isSignedIn, mode }: RhythmProtocolsProps) {
  if (mode === 'timer') {
    return <StopTimer isSignedIn={isSignedIn} />;
  }

  if (mode === 'overclock') {
    return <OverclockGame isSignedIn={isSignedIn} />;
  }

  return <SyncTest isSignedIn={isSignedIn} />;
}
