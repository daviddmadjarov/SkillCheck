'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { useDuelCountdown } from '@/components/use-duel-countdown';

export function AudioReactionProtocol({ initialAttempts, initialBestScore, isSignedIn }: { initialAttempts: number; initialBestScore: number | null; isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('audio-reaction');
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'ready' | 'clicked' | 'too-soon' | 'finished'>('idle');
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [bestScore, setBestScore] = useState(initialBestScore);
  const [roundTimes, setRoundTimes] = useState<number[]>([]);
  const [isSaving, startSaving] = useTransition();

  const readyAtRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasAutoStarted = useRef(false);

  const cd = useDuelCountdown(isMultiplayerSession);

  useEffect(() => {
    if (!cd.launched || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    startProtocol();
  }, [cd.launched]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (audioContextRef.current) void audioContextRef.current.close();
  }, []);

  function getAudioContext() {
    if (!audioContextRef.current) audioContextRef.current = new window.AudioContext();
    return audioContextRef.current;
  }

  function playSignal() {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 880;
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.start(now); osc.stop(now + 0.16);
  }

  function startProtocol() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPhase('waiting'); setReactionMs(null);
    const delay = 2000 + Math.round(Math.random() * 4000);
    timeoutRef.current = setTimeout(() => { playSignal(); readyAtRef.current = performance.now(); setPhase('ready'); }, delay);
  }

  function saveResult(avgMs: number) {
    if (!isSignedIn) return;
    startSaving(async () => {
      const res = await fetch('/api/reaction-results', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ reactionMs: avgMs, testSlug: 'audio-reaction', ...multiplayerMeta }) });
      const p = (await res.json().catch(() => null)) as { ok?: boolean; score?: number } | null;
      if (!res.ok || !p?.ok || typeof p.score !== 'number') return;
      setAttempts(c => c + 1);
      const s: number = p.score;
      setBestScore(c => (c === null ? s : Math.max(c, s)));
      if (isMultiplayerSession) goToIntermission();
    });
  }

  function handleArenaClick() {
    if (cd.active) return;
    if (phase === 'idle' || phase === 'finished') { setRoundTimes([]); startProtocol(); return; }
    if (phase === 'too-soon') { startProtocol(); return; }
    if (phase === 'clicked') return;
    if (phase === 'waiting') { if (timeoutRef.current) clearTimeout(timeoutRef.current); setPhase('too-soon'); setReactionMs(null); return; }
    if (phase === 'ready') {
      const ms = Math.round(performance.now() - readyAtRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setReactionMs(ms);
      const newTimes = [...roundTimes, ms]; setRoundTimes(newTimes);
      if (newTimes.length >= 4) { setPhase('finished'); saveResult(Math.round(newTimes.reduce((a,b) => a+b,0)/4)); }
      else { setPhase('clicked'); if (isMultiplayerSession) setTimeout(() => startProtocol(), 1500); }
    }
  }

  const roundAvg = roundTimes.length > 0 ? Math.round(roundTimes.reduce((a,b) => a+b, 0) / roundTimes.length) : null;

  return (
    <section className="lab-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Reaction Category</p><h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">Audio Reaction</h2></div>
        <div className="flex flex-wrap items-center gap-2">
          {roundTimes.length > 0 && phase !== 'finished' && <div className="rounded-full border-2 border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700">Round {roundTimes.length} / 4</div>}
          <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">{isSignedIn ? 'Leaderboard sync active' : 'Guest mode'}</div>
        </div>
      </div>
      <div className="relative">
        {cd.active && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase === 'go' ? <p className="text-7xl font-black text-emerald-600">GO</p> : <p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
        <button className={`flex min-h-[18rem] w-full cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 px-4 py-7 text-center transition sm:min-h-[20rem] sm:px-6 sm:py-8 ${phase==='too-soon'?'border-rose-300 bg-rose-100 text-rose-900':phase==='clicked'?'border-cyan-300 bg-cyan-100 text-slate-900':'border-indigo-200 bg-indigo-50 text-slate-800'}`} onClick={handleArenaClick} type="button">
          <span className="text-4xl font-black tracking-tight sm:text-6xl">{phase==='too-soon'?'Too soon':phase==='finished'?`${roundAvg??'--'} ms avg`:phase==='clicked'?`${reactionMs??'--'} ms`:phase==='waiting'||phase==='ready'?'Listen':cd.active?cd.phase==='go'?'GO':cd.value:'Start protocol'}</span>
          <span className="mt-4 max-w-md text-sm font-bold uppercase tracking-[0.18em] sm:text-base">{phase==='too-soon'?'Click to restart.':phase==='finished'?'Round complete.':phase==='clicked'?`Round ${roundTimes.length} / 4`:phase==='waiting'||phase==='ready'?'Wait for the beep and react as fast as possible.':cd.active?'Getting ready...':'Click the panel to begin.'}</span>
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{label:'Last reaction',value:reactionMs??'--',detail:'Measured in milliseconds.'},{label:'Round average',value:roundAvg===null?'--':`${roundAvg} ms`,detail:'Average across 4 signals.'},{label:'Best lab score',value:bestScore??'--',detail:'Higher is better.'},{label:'Saved attempts',value:attempts,detail:'Only stored for signed-in players.'}].map(s=><div key={s.label} className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]"><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{s.label}</p><p className="mt-2 text-3xl font-black text-slate-800">{s.value}</p><p className="mt-1 text-sm font-medium text-slate-500">{s.detail}</p></div>)}
      </div>
    </section>
  );
}