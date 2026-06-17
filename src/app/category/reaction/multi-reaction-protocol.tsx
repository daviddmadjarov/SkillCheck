'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { useDuelCountdown } from '@/components/use-duel-countdown';

type GamePhase = 'idle' | 'waiting' | 'active' | 'too-soon' | 'finished';
const NUM_BUTTONS = 4, MIN_RD = 2000, MAX_RD = 4000, MIN_GAP = 200;
const LABELS = ['A','B','C','D'];
const IDLE_STY = ['border-rose-200 bg-rose-50 text-rose-400','border-blue-200 bg-blue-50 text-blue-400','border-amber-200 bg-amber-50 text-amber-400','border-emerald-200 bg-emerald-50 text-emerald-400'];
const ACTIVE_STY = ['border-rose-400 bg-rose-300 text-rose-900 shadow-[0_0_28px_rgba(244,63,94,0.45)]','border-blue-400 bg-blue-300 text-blue-900 shadow-[0_0_28px_rgba(59,130,246,0.45)]','border-amber-400 bg-amber-300 text-amber-900 shadow-[0_0_28px_rgba(245,158,11,0.45)]','border-emerald-400 bg-emerald-300 text-emerald-900 shadow-[0_0_28px_rgba(16,185,129,0.45)]'];

export function MultiReactionProtocol({ initialAttempts, isSignedIn }: { initialAttempts: number; initialBestScore: number | null; isSignedIn: boolean }) {
  const { goToIntermission, isMultiplayerSession, meta: multiplayerMeta } = useMultiplayerRoundFlow('multi-reaction');
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [activeBtn, setActiveBtn] = useState<number | null>(null);
  const [curRound, setCurRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [best, setBest] = useState<number | null>(null);
  const [isSaving, startSaving] = useTransition();
  const readyAtRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoStarted = useRef(false);

  const cd = useDuelCountdown(isMultiplayerSession);

  useEffect(() => {
    if (!cd.launched || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    startGame();
  }, [cd.launched]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  function sched(extra: number) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { const b = Math.floor(Math.random()*NUM_BUTTONS); readyAtRef.current = performance.now(); setActiveBtn(b); setPhase('active'); }, extra + MIN_RD + Math.random()*(MAX_RD-MIN_RD));
  }
  function startGame() { setPhase('waiting'); setCurRound(0); setTimes([]); setActiveBtn(null); sched(0); }
  function save(avg: number) { if (!isSignedIn) return; startSaving(async () => { const r = await fetch('/api/reaction-results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reactionMs: avg, testSlug:'multi-reaction',...multiplayerMeta})}); const p = (await r.json().catch(()=>null)) as {ok?:boolean; score?:number}|null; if (!r.ok||!p?.ok||typeof p.score!=='number') return; const s=p.score; setAttempts(c=>c+1); setBest(c=>c===null?s:Math.max(c,s)); if (isMultiplayerSession) goToIntermission(); }); }

  function click(i: number) {
    if (cd.active) return;
    if (phase === 'idle' || phase === 'finished') { setTimes([]); startGame(); return; }
    if (phase === 'too-soon') { if (timeoutRef.current) clearTimeout(timeoutRef.current); setPhase('waiting'); setActiveBtn(null); sched(0); return; }
    if (phase === 'waiting') { if (timeoutRef.current) clearTimeout(timeoutRef.current); setPhase('too-soon'); setActiveBtn(null); return; }
    if (phase === 'active' && i === activeBtn) {
      const ms = Math.round(performance.now() - readyAtRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setActiveBtn(null); const nt = [...times, ms]; setTimes(nt); const nr = curRound + 1; setCurRound(nr);
      if (nr >= NUM_BUTTONS) { setPhase('finished'); save(Math.round(nt.reduce((a,b)=>a+b,0)/nt.length)); }
      else { setPhase('waiting'); sched(MIN_GAP); }
    }
  }

  const isIdle = phase === 'idle' || phase === 'finished';
  return (<section className="lab-card p-4 sm:p-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Reaction Category</p><h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">Multi-Reaction</h2></div><div className="flex flex-wrap items-center gap-2">{!isIdle && phase!=='too-soon' && <div className="rounded-full border-2 border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700">Round {Math.min(curRound+1,NUM_BUTTONS)} / {NUM_BUTTONS}</div>}<div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">{isSignedIn?'Leaderboard sync active':'Guest mode'}</div></div></div>
    <div className="relative">
      {cd.active && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
      <div className={`grid grid-cols-2 gap-4 ${phase==='too-soon'?'opacity-60':''}`}>{LABELS.map((l,i)=>{const a=phase==='active'&&activeBtn===i; return <button key={i} className={`flex min-h-[10rem] cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 px-4 py-6 text-center transition-all duration-75 sm:min-h-[12rem] ${a?ACTIVE_STY[i]:IDLE_STY[i]}`} onClick={()=>click(i)} type="button"><span className="text-5xl font-black tracking-tight sm:text-6xl">{l}</span>{isIdle && <span className="mt-2 text-xs font-bold uppercase tracking-[0.18em] opacity-60">{phase==='idle'?'Click to start':'Click to restart'}</span>}</button>})}</div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{label:'Last signal',value:times.length?`${times[times.length-1]} ms`:'--',detail:'Most recent reaction.'},{label:'Round avg',value:times.length?`${Math.round(times.reduce((a,b)=>a+b,0)/times.length)} ms`:'--',detail:`Average across ${NUM_BUTTONS}.`},{label:'Best score',value:best??'--',detail:'Higher is better.'},{label:'Saved attempts',value:attempts,detail:'Stored for signed-in players.'}].map(s=><div key={s.label} className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]"><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{s.label}</p><p className="mt-2 text-3xl font-black text-slate-800">{s.value}</p><p className="mt-1 text-sm font-medium text-slate-500">{s.detail}</p></div>)}
    </div>
  </section>);
}