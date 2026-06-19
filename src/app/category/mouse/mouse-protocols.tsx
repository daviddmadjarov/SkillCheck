'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { useDuelCountdown } from '@/components/use-duel-countdown';

type Point = { x: number; y: number };
type TraceMode = 'assist'|'memory';
type TraceSymbol = { key: string; label: string; points: Point[] };

function clamp(v:number,lo:number,hi:number){return Math.min(hi,Math.max(lo,v))}
function dist(a:Point,b:Point){return Math.hypot(a.x-b.x,a.y-b.y)}

function MouseShell({title,kicker,description,accent,isSignedIn,stats,children,modeButtons}:{title:string;kicker:string;description:string;accent:string;isSignedIn:boolean;stats:{label:string;value:string;detail:string}[];children:ReactNode;modeButtons?:ReactNode}){
  return <section className="lab-card p-4 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Mouse Category</p><h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">{title}</h2><p className={`mt-3 inline-flex rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${accent}`}>{kicker}</p></div>{modeButtons?modeButtons:<div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">{isSignedIn?'Leaderboard sync active':'Guest mode'}</div>}</div><p className="mb-4 max-w-2xl text-sm font-medium leading-6 text-slate-500">{description}</p>{children}<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(s=><div key={s.label} className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]"><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{s.label}</p><p className="mt-2 text-3xl font-black text-slate-800">{s.value}</p><p className="mt-1 text-sm font-medium text-slate-500">{s.detail}</p></div>)}</div></section>
}

const TRACE_SYMBOLS:TraceSymbol[]=[
  {key:'star',label:'Star',points:[{x:50,y:16},{x:58,y:38},{x:82,y:38},{x:62,y:52},{x:70,y:76},{x:50,y:61},{x:30,y:76},{x:38,y:52},{x:18,y:38},{x:42,y:38},{x:50,y:16}]},
  {key:'arrow',label:'Arrow',points:[{x:18,y:50},{x:60,y:50},{x:60,y:36},{x:84,y:50},{x:60,y:64},{x:60,y:50},{x:18,y:50}]},
  {key:'heart',label:'Heart',points:[{x:50,y:78},{x:74,y:55},{x:80,y:38},{x:69,y:27},{x:56,y:30},{x:50,y:37},{x:44,y:30},{x:31,y:27},{x:20,y:38},{x:26,y:55},{x:50,y:78}]},
  {key:'loop',label:'Loop',points:[{x:50,y:20},{x:75,y:30},{x:82,y:50},{x:68,y:72},{x:50,y:80},{x:32,y:72},{x:18,y:50},{x:25,y:30},{x:40,y:26},{x:50,y:34},{x:32,y:55},{x:50,y:68},{x:68,y:55},{x:50,y:20}]},
  {key:'lightning',label:'Lightning',points:[{x:30,y:10},{x:52,y:10},{x:35,y:45},{x:58,y:45},{x:38,y:82},{x:65,y:40},{x:45,y:40}]},
  {key:'crescent',label:'Crescent',points:[{x:50,y:88},{x:22,y:70},{x:15,y:50},{x:22,y:30},{x:50,y:12},{x:42,y:30},{x:35,y:50},{x:42,y:70},{x:50,y:88}]},
  {key:'spiral',label:'Spiral',points:[{x:50,y:85},{x:15,y:50},{x:50,y:15},{x:85,y:50},{x:72,y:70},{x:38,y:58},{x:50,y:35},{x:62,y:50},{x:55,y:58}]},
  {key:'diamond',label:'Diamond',points:[{x:50,y:10},{x:90,y:50},{x:50,y:90},{x:10,y:50},{x:50,y:10}]},
  {key:'wave',label:'Wave',points:[{x:10,y:50},{x:18,y:28},{x:26,y:50},{x:34,y:72},{x:42,y:50},{x:50,y:28},{x:58,y:50},{x:66,y:72},{x:74,y:50},{x:82,y:28},{x:90,y:50}]},
];

// ── Scoring utilities ──────────────────────────────────────────────
function resamplePath(pts: Point[], n: number): Point[] {
  if (pts.length < 2) return pts.slice();
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i - 1], pts[i]));
  const total = lens[lens.length - 1];
  if (total < 1e-6) return pts.slice();
  const step = total / (n - 1);
  const out: Point[] = [pts[0]];
  let segIdx = 0;
  for (let s = step; s < total - step * 0.5; s += step) {
    while (segIdx < lens.length - 2 && lens[segIdx + 1] <= s) segIdx++;
    const t = (s - lens[segIdx]) / (lens[segIdx + 1] - lens[segIdx] || 1);
    out.push({ x: pts[segIdx].x + (pts[segIdx + 1].x - pts[segIdx].x) * t, y: pts[segIdx].y + (pts[segIdx + 1].y - pts[segIdx].y) * t });
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function nearestPointLookup(pts: Point[]): (px: number, py: number) => number {
  return (px: number, py: number) => { let best = Infinity; for (let i = 0; i < pts.length; i++) { const d = Math.hypot(px - pts[i].x, py - pts[i].y); if (d < best) best = d; } return best; };
}

function nonlinearPenalty(d: number, maxD: number): number {
  const r = d / maxD;
  if (r <= 0) return 0;
  if (r <= 0.15) return (r / 0.15) * (r / 0.15) * 0.04;
  const t = (r - 0.15) / 0.85;
  return 0.04 * Math.exp(t * 3.219);
}

function computeDeviationScore(userPath: Point[], targetPath: Point[], maxD: number): number {
  const toTarget = nearestPointLookup(targetPath);
  const toUser = nearestPointLookup(userPath);
  let up = 0, tp = 0;
  for (let i = 0; i < userPath.length; i++) up += nonlinearPenalty(toTarget(userPath[i].x, userPath[i].y), maxD);
  for (let i = 0; i < targetPath.length; i++) tp += nonlinearPenalty(toUser(targetPath[i].x, targetPath[i].y), maxD);
  return Math.max(0, 100 - ((up / userPath.length + tp / targetPath.length) / 2) * 100);
}

function computeCoverageScore(userPath: Point[], targetPath: Point[]): number {
  const toUser = nearestPointLookup(userPath);
  let covered = 0;
  for (let i = 0; i < targetPath.length; i++) if (toUser(targetPath[i].x, targetPath[i].y) <= 5) covered++;
  return Math.min(100, Math.max(0, (covered / targetPath.length - 0.8) * 500));
}

function computeStrayScore(userRaw: Point[], targetPath: Point[]): number {
  const toTarget = nearestPointLookup(targetPath);
  const step = Math.max(1, Math.floor(userRaw.length / 300));
  let strayCount = 0, total = 0;
  for (let i = 0; i < userRaw.length; i += step) { total++; if (toTarget(userRaw[i].x, userRaw[i].y) > 8) strayCount++; }
  const strayPct = total > 0 ? strayCount / total : 0;
  let userLen = 0;
  for (let i = 1; i < userRaw.length; i++) userLen += dist(userRaw[i - 1], userRaw[i]);
  let tplLen = 0;
  for (let i = 1; i < targetPath.length; i++) tplLen += dist(targetPath[i - 1], targetPath[i]);
  const lenRatio = tplLen > 0 ? userLen / tplLen : 1;
  let lengthPenalty = 0;
  if (lenRatio > 1.3) lengthPenalty = Math.min(1, (lenRatio - 1.3) / 1.2);
  if (lenRatio < 0.5) lengthPenalty = Math.max(lengthPenalty, 0.3);
  return Math.max(0, Math.min(100, Math.max(0, 100 - strayPct * 250) * (1 - lengthPenalty * 0.6)));
}

function computeSmoothnessScore(userPath: Point[]): number {
  if (userPath.length < 5) return 0;
  const steps: number[] = [];
  for (let i = 1; i < userPath.length; i++) steps.push(dist(userPath[i - 1], userPath[i]));
  const sorted = [...steps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = steps.map(d => Math.abs(d - median));
  const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)] || 1;
  const threshold = Math.max(median + 2 * mad, 2);
  let jumps = 0;
  for (let i = 0; i < steps.length; i++) if (steps[i] > threshold) jumps++;
  return Math.max(0, 100 - (jumps / steps.length) * 300);
}

function computeCompletionScore(userRaw: Point[], targetPath: Point[]): number {
  if (userRaw.length < 4 || targetPath.length < 2) return 0;
  const startDist = dist(userRaw[0], targetPath[0]);
  const endDist = dist(userRaw[userRaw.length - 1], targetPath[targetPath.length - 1]);
  const toUser = nearestPointLookup(userRaw);
  const endStart = Math.floor(targetPath.length * 0.7);
  let endCovered = 0;
  for (let i = endStart; i < targetPath.length; i++) if (toUser(targetPath[i].x, targetPath[i].y) <= 8) endCovered++;
  const endCoverPct = (targetPath.length - endStart) > 0 ? endCovered / (targetPath.length - endStart) : 0;
  const startBonus = startDist <= 5 ? 100 : startDist <= 10 ? 50 : 0;
  const endBonus = endDist <= 5 ? 100 : endDist <= 10 ? 60 : endDist <= 20 ? 20 : 0;
  const coverBonus = endCoverPct >= 0.7 ? 100 : endCoverPct >= 0.4 ? 40 : 0;
  return startBonus * 0.15 + endBonus * 0.35 + coverBonus * 0.50;
}

function evaluateTrace(userPts: Point[], tplPts: Point[]) {
  if (userPts.length < 4) return { accuracy: 0, deviation: 99, completion: 0, labScore: 0 };
  const usamp = resamplePath(userPts, 600);
  const tsamp = resamplePath(tplPts, 600);
  const weighted =
    computeDeviationScore(usamp, tsamp, 10) * 0.50 +
    computeCoverageScore(usamp, tsamp) * 0.20 +
    computeStrayScore(userPts, tsamp) * 0.15 +
    computeSmoothnessScore(usamp) * 0.10 +
    computeCompletionScore(userPts, tsamp) * 0.05;
  const accuracy = clamp(Math.round(weighted), 0, 100);
  const labScore = clamp(Math.round(weighted * 10), 0, 1000);
  const toTarget = nearestPointLookup(tsamp);
  let totalDev = 0;
  for (let i = 0; i < usamp.length; i++) totalDev += toTarget(usamp[i].x, usamp[i].y);
  return { accuracy, deviation: Number((totalDev / usamp.length).toFixed(2)), completion: accuracy, labScore };
}

// ─────────────────────────────────────────────────────────────────────
// SYMBOL TRACING COMPONENT — Normal + Memory mode
// ─────────────────────────────────────────────────────────────────────

function SymbolTracing({traceMode,isSignedIn,modeButtons}:{traceMode:TraceMode;isSignedIn:boolean;modeButtons?:ReactNode}){
  const {goToIntermission,isMultiplayerSession,meta:mm}=useMultiplayerRoundFlow('mouse-symbol-tracing');
  const ROUNDS=4;
  const cd=useDuelCountdown(isMultiplayerSession);
  const hasAutoStarted=useRef(false);

  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;startTraceRun()},[cd.launched]);//eslint-disable-line

  const [phase,setPhase]=useState<'idle'|'memorizing'|'tracing'|'reveal'|'finished'>('idle');
  const [memCountdown,setMemCountdown]=useState(4);
  const [roundIdx,setRoundIdx]=useState(0);
  const [order,setOrder]=useState<number[]>([]);
  const [up,setUp]=useState<Point[]>([]);
  const traceRef=useRef<Point[]>([]);
  const [drawing,setDrawing]=useState(false);
  const [scores,setScores]=useState<number[]>([]);
  const [result,setResult]=useState<ReturnType<typeof evaluateTrace>|null>(null);
  const boardRef=useRef<HTMLDivElement|null>(null);
  const hsrf=useRef(false);
  const memTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);

  const symbolIdx=order[roundIdx]??0;
  const symbol=TRACE_SYMBOLS[symbolIdx];
  const avgScore=scores.length===0?null:Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);

  useEffect(()=>{if(!isSignedIn||phase!=='finished'||avgScore===null||hsrf.current)return;hsrf.current=true;fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'mouse-symbol-tracing',score:avgScore,...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()})},[avgScore,goToIntermission,isMultiplayerSession,isSignedIn,phase,mm]);

  useEffect(()=>{return()=>{if(memTimerRef.current)clearInterval(memTimerRef.current)}},[]);

  function getBP(cx:number,cy:number){const b=boardRef.current;if(!b)return null;const r=b.getBoundingClientRect();return{x:clamp(((cx-r.left)/r.width)*100,0,100),y:clamp(((cy-r.top)/r.height)*100,0,100)}}

  function startMemorizePhase(){
    setMemCountdown(4);
    setPhase('memorizing');
    memTimerRef.current=setInterval(()=>{
      setMemCountdown(c=>{
        if(c<=1){
          if(memTimerRef.current)clearInterval(memTimerRef.current);
          memTimerRef.current=null;
          setPhase('tracing');
          return 0;
        }
        return c-1;
      });
    },1000);
  }

  function startTraceRun(){
    const o=[...Array(TRACE_SYMBOLS.length).keys()];
    for(let i=o.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[o[i],o[j]]=[o[j],o[i]]}
    setOrder(o.slice(0,ROUNDS));
    setScores([]);
    setResult(null);
    hsrf.current=false;
    traceRef.current=[];
    setRoundIdx(0);
    setUp([]);
    setDrawing(false);
    if(traceMode==='memory'){startMemorizePhase()}else{setPhase('tracing')}
  }

  function advanceRound(){
    if(!result)return;
    const ns=[...scores,result.labScore];
    setScores(ns);
    const nr=roundIdx+1;
    if(nr>=ROUNDS){setResult(null);setPhase('finished');return}
    setResult(null);
    traceRef.current=[];
    setRoundIdx(nr);
    setUp([]);
    setDrawing(false);
    if(traceMode==='memory'){startMemorizePhase()}else{setPhase('tracing')}
  }

  const showGuide = phase==='tracing' && traceMode==='assist';
  const showMemGuide = phase==='memorizing';
  // In reveal phase, always show the guide alongside the user's trace for comparison
  const showRevealGuide = phase==='reveal';

  return <MouseShell title={`Symbol Tracing ${traceMode==='memory'?'(Memory)':''}`} kicker={traceMode==='memory'?'Recall & draw':'Path precision'} description={traceMode==='memory'?'Study the shape, then trace it from memory after it disappears.':'Trace each target shape as precisely as possible.'} accent="border-emerald-200 bg-emerald-50 text-emerald-900" isSignedIn={isSignedIn} stats={[{label:'Rounds left',value:`${Math.max(ROUNDS-scores.length-(phase==='reveal'?1:0),0)}`,detail:'Complete four symbols.'},{label:'Shape',value:symbol.label,detail:`Round ${Math.min(roundIdx+1,ROUNDS)} / ${ROUNDS}`},{label:'Last Accuracy',value:result===null?'--':`${result.accuracy}%`,detail:'How closely your line matched.'},{label:'Lab score',value:phase==='finished'?`${avgScore??0}`:result===null?'--':`${result.labScore}`,detail:phase==='finished'?'Average lab score over 4 rounds.':'Trace performance score.'}]} modeButtons={modeButtons}>
    <div className="space-y-4">
      {/* Memorizing countdown shown above the panel */}
      {phase==='memorizing'&&<div className="flex justify-center"><div className="inline-flex items-center gap-3 status-pill"><span className="text-xs font-bold uppercase tracking-[0.2em]">Memorize</span><span className="text-xl font-black">{memCountdown}</span><span className="text-[11px] font-semibold uppercase tracking-[0.15em]">Study the shape below!</span></div></div>}

      <div className="flex flex-wrap gap-2">
        {phase==='tracing'&&<button className="lab-button" onClick={()=>{const r=evaluateTrace(traceRef.current,symbol.points);setDrawing(false);setResult(r);setPhase('reveal');}} type="button">Done Trace</button>}
        {phase==='finished'&&<button className="lab-button" onClick={startTraceRun} type="button">Start New Run</button>}
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[38rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 touch-none select-none" onPointerDown={e=>{if(phase!=='tracing')return;const p=getBP(e.clientX,e.clientY);if(!p)return;if(traceRef.current.length>0)return;setDrawing(true);traceRef.current=[p];setUp([p])}} onPointerMove={e=>{if(phase!=='tracing'||!drawing)return;const p=getBP(e.clientX,e.clientY);if(!p)return;const cur=traceRef.current;if(cur.length===0){traceRef.current=[p];setUp([p]);return}if(dist(cur[cur.length-1],p)<0.25)return;const next=[...cur,p];traceRef.current=next;setUp(next)}} onPointerUp={()=>{setDrawing(false)}} ref={boardRef}>
        {cd.active&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
          {/* Guide shape — during memorizing (clear, no blur), assist tracing, and always on reveal for comparison */}
          {(showGuide||showMemGuide||showRevealGuide)&&<polyline fill="none" points={symbol.points.map(p=>`${p.x},${p.y}`).join(' ')} stroke="#10b981" strokeDasharray={phase==='memorizing'?"3 4":"3 4"} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" opacity={showRevealGuide?0.3:1}/>}
          <polyline fill="none" points={up.map(p=>`${p.x},${p.y}`).join(' ')} stroke="#0f172a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4"/>
        </svg>

        {phase==='idle'&&!isMultiplayerSession&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70"><button className="lab-button" onClick={startTraceRun} type="button">Start Tracing</button></div>}

        {phase==='tracing'&&<div className="absolute left-1/2 top-3 z-10 -translate-x-1/2"><span className="rounded-full border-2 border-slate-200 bg-white/90 px-4 py-1.5 text-xs font-bold tracking-[0.18em] text-slate-500 shadow-sm uppercase">{symbol.label}</span></div>}

        {phase==='tracing'&&traceMode==='memory'&&<div className="absolute left-1/2 bottom-3 z-10 -translate-x-1/2"><span className="rounded-full border-2 border-amber-200 bg-amber-50/90 px-4 py-1.5 text-xs font-bold tracking-[0.18em] text-amber-700 shadow-sm uppercase">Draw from memory</span></div>}

        {phase==='reveal'&&result&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/45 backdrop-blur-sm"><div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-5 py-4 text-center shadow-lg"><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{symbol.label}</p><p className={`mt-3 text-2xl font-black ${result.accuracy>=70?'text-emerald-600':'text-amber-600'}`}>{result.accuracy}% Accuracy</p><p className="mt-1 text-sm text-slate-500">Score: {result.labScore}</p><button className="mt-3 lab-button" onClick={advanceRound} type="button">{roundIdx+1>=ROUNDS?'See Final Score':'Next Symbol'}</button></div></div>}

        {phase==='finished'&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/45 backdrop-blur-sm"><div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-5 py-4 text-center shadow-lg"><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p><p className="mt-2 text-xl font-black tracking-tight text-slate-800">Avg Lab Score: {avgScore??0}</p><button className="mt-4 lab-button" onClick={startTraceRun} type="button">Start New Run</button></div></div>}
      </div>
    </div>
  </MouseShell>
}

// ── CPS Tester ─────────────────────────────────────────────────────
function CpsTester({isSignedIn}:{initialDuration?:5|10|15;isSignedIn:boolean}){
  const {goToIntermission,isMultiplayerSession,meta:mm}=useMultiplayerRoundFlow('mouse-cps');
  const [duration]=useState(10);const [started,setStarted]=useState(false);const [finished,setFinished]=useState(false);const [clicks,setClicks]=useState(0);
  const [elapsedMs,setElapsedMs]=useState(0);const [startMs,setStartMs]=useState<number|null>(null);const [timestamps,setTimestamps]=useState<number[]>([]);
  const hasAutoStarted=useRef(false);const cd=useDuelCountdown(isMultiplayerSession);
  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;handleClick();},[cd.launched]);//eslint-disable-line
  const secondsLeft=Math.max(0,duration-Math.floor(elapsedMs/1000));
  const peakCps=useMemo(()=>{if(!timestamps.length)return 0;let best=0;for(let i=0;i<timestamps.length;i++){let c=0;for(let j=i;j<timestamps.length&&timestamps[j]-timestamps[i]<=1000;j++)c++;best=Math.max(best,c)}return best},[timestamps]);
  const labScore=clamp(Math.round(((clicks/Math.max(duration,1)*0.75+peakCps*0.25)/20)*1000),0,1000);
  useEffect(()=>{if(!started||finished||startMs===null)return;const iv=setInterval(()=>{const e=performance.now()-startMs;if(e>=duration*1000){const fs=clamp(Math.round(((clicks/Math.max(duration,1)*0.75+peakCps*0.25)/20)*1000),0,1000);if(isSignedIn)fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'mouse-cps',score:fs,...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()});setElapsedMs(duration*1000);setStarted(false);setFinished(true);return}setElapsedMs(e)},30);return()=>clearInterval(iv)},[clicks,duration,finished,goToIntermission,isMultiplayerSession,isSignedIn,peakCps,startMs,started,mm]);
  function handleClick(){if(finished)return;const now=performance.now();if(!started){setStarted(true);setStartMs(now);setElapsedMs(0)}setClicks(c=>c+1);setTimestamps(t=>[...t,now])}
  return <MouseShell title="CPS Tester" kicker="Click speed" description="Measure your click speed over a short burst." accent="border-cyan-200 bg-cyan-50 text-cyan-900" isSignedIn={isSignedIn} stats={[{label:'Seconds left',value:`${secondsLeft}s`,detail:'Remaining time in this click sprint.'},{label:'Clicks',value:String(clicks),detail:'Total registered clicks.'},{label:'CPS',value:elapsedMs>0?Number(clicks/(elapsedMs/1000)).toFixed(2):'0.00',detail:'Current clicks per second.'},{label:'Lab score',value:String(labScore),detail:'CPS scaled to 1000-point score.'}]}>
    <div className="space-y-4"><div className="relative">
      {cd.active&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
      <div className="relative min-h-[24rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4 sm:min-h-[28rem]">
        <button className="flex h-full min-h-[20rem] w-full cursor-pointer items-center justify-center rounded-[1.5rem] border-2 border-cyan-200 bg-white/80 text-center shadow-sm transition hover:bg-white" onClick={handleClick} type="button"><span><span className="block text-5xl font-black tracking-tight text-slate-800">{clicks}</span><span className="mt-2 block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{started?'Click as fast as possible':'Click to start'}</span></span></button>
        {finished&&<div className="absolute inset-0 flex items-center justify-center bg-white/45 backdrop-blur-sm"><button className="lab-button" onClick={()=>{setClicks(0);setStarted(false);setFinished(false);setElapsedMs(0);setStartMs(null);setTimestamps([])}} type="button">Start New Run</button></div>}
      </div>
    </div></div>
  </MouseShell>
}

// ── Tracking Test ──────────────────────────────────────────────────
function TrackingTest({isSignedIn}:{isSignedIn:boolean}){
  const {goToIntermission,isMultiplayerSession,meta:mm}=useMultiplayerRoundFlow('aim-tracking-test');
  const [running,setRunning]=useState(false);const [runComplete,setRunComplete]=useState(false);const [secondsLeft,setSecondsLeft]=useState(20);
  const [timeInsideMs,setTimeInsideMs]=useState(0);const [target,setTarget]=useState({x:50,y:50});const [isInside,setIsInside]=useState(false);
  const [canRetry,setCanRetry]=useState(false);
  const arenaRef=useRef<HTMLDivElement|null>(null);const hasAutoStarted=useRef(false);const cd=useDuelCountdown(isMultiplayerSession);
  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;startRun()},[cd.launched]);//eslint-disable-line
  useEffect(()=>{if(!runComplete){setCanRetry(false);return}const t=setTimeout(()=>setCanRetry(true),1000);return()=>clearTimeout(t)},[runComplete]);
  const labScore=Math.round((timeInsideMs/20000)*1000);
  useEffect(()=>{if(!running)return;const s=performance.now();let inside=false;let elapsed=0;let ti=0;const up=(ts:number)=>{elapsed=ts-s;const rem=Math.max(0,20000-elapsed);setSecondsLeft(Math.ceil(rem/1000));const p=elapsed/20000;const ang=(s*0.001+elapsed*0.008)%(Math.PI*2);const nx=50+Math.sin(ang)*35+Math.sin(elapsed*0.012)*8;const ny=50+Math.cos(ang*0.85)*30+Math.cos(elapsed*0.01)*6;setTarget({x:clamp(nx,10,90),y:clamp(ny,10,90)});if(inside){ti=Math.min(20000,ti+16);setTimeInsideMs(ti)}if(elapsed>=20000){setIsInside(false);setRunning(false);setRunComplete(true);if(isSignedIn){const fs=Math.round((ti/20000)*1000);fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'aim-tracking-test',score:fs,...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()})}return}requestAnimationFrame(up)};const h=(e:PointerEvent)=>{const a=arenaRef.current;if(!a)return;const r=a.getBoundingClientRect();const px=clamp(((e.clientX-r.left)/r.width)*100,0,100);const py=clamp(((e.clientY-r.top)/r.height)*100,0,100);inside=dist({x:px,y:py},target)<6.5;setIsInside(inside)};window.addEventListener('pointermove',h,{passive:true});requestAnimationFrame(up);return()=>window.removeEventListener('pointermove',h)},[running]);
  function startRun(p?:{x:number;y:number}|null){setRunning(true);setRunComplete(false);setSecondsLeft(20);setTimeInsideMs(0);setIsInside(false)}
  return <MouseShell title="Tracking Test" kicker="Cursor control" description="Keep your pointer inside the moving target for the full run." accent="border-indigo-200 bg-indigo-50 text-indigo-900" isSignedIn={isSignedIn} stats={[{label:'Seconds left',value:`${secondsLeft}s`,detail:'The tracking window lasts 20 seconds.'},{label:'Time on target',value:`${(timeInsideMs/1000).toFixed(2)}s`,detail:'Total time inside the target.'},{label:'Accuracy',value:`${Math.round((timeInsideMs/20000)*100)}%`,detail:'Percentage of 20s window.'},{label:'Lab score',value:String(labScore),detail:'0-1000 scale.'},{label:'Status',value:running?'Live':runComplete?'Done':'Ready',detail:running?'Stay inside the target.':runComplete?'Run complete.':'Getting ready.'}]}>
    <div className="space-y-4"><div ref={arenaRef} className="relative min-h-[18rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-4 sm:min-h-[26rem] touch-none select-none" onPointerDown={()=>{if(!running&&!runComplete)startRun()}}>
      {cd.active&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
      <div className="absolute" style={{left:`${target.x}%`,top:`${target.y}%`,width:72,height:72,transform:'translate(-50%,-50%)'}}><span className={`relative flex h-full w-full items-center justify-center rounded-full border-[6px] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.14)] ${isInside?'border-emerald-400':'border-indigo-500'}`}><span className={`absolute h-[54px] w-[54px] rounded-full border-[6px] border-white ${isInside?'bg-emerald-400':'bg-indigo-500'}`}/><span className={`absolute h-[32px] w-[32px] rounded-full border-[5px] border-white ${isInside?'bg-emerald-200':'bg-indigo-300'}`}/><span className={`absolute h-[12px] w-[12px] rounded-full border-2 border-white ${isInside?'bg-emerald-600':'bg-indigo-700'}`}/></span></div>
      {!running&&!runComplete&&!isMultiplayerSession&&<div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"><span className="rounded-full border-2 border-slate-200 bg-white/90 px-5 py-2.5 text-sm font-bold uppercase tracking-[0.2em] text-slate-500 shadow-sm">Tap to start</span></div>}
      {runComplete&&!running&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm"><div className="mx-4 w-full max-w-xs rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg"><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p><p className="mt-3 text-4xl font-black tracking-tight text-slate-800">{labScore}</p><button className={`mt-4 rounded-2xl border-b-4 border-indigo-700 bg-indigo-600 px-6 py-3 font-bold text-white ${!canRetry?'opacity-50 pointer-events-none':''}`} disabled={!canRetry} onClick={e=>{e.stopPropagation();startRun()}} type="button">Start New Run</button></div></div>}
    </div></div>
  </MouseShell>
}

// ── Main export ────────────────────────────────────────────────────
export function MouseProtocols({mode,isSignedIn,initialCpsDuration:_cps,initialTraceMode:_tm}:{mode:string;isSignedIn:boolean;initialCpsDuration?:number;initialTraceMode?:string}){
  const [traceMode,setTraceMode]=useState<TraceMode>('assist');

  if(mode==='tracking')return <TrackingTest isSignedIn={isSignedIn}/>
  if(mode==='cps')return <CpsTester isSignedIn={isSignedIn}/>

  // Mode toggle buttons — passed into MouseShell to replace the "Leaderboard sync active" text
  const modeButtons=<div className="flex gap-2">
    <button
      className={`rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition-all ${
        traceMode==='assist'
          ? 'border-emerald-400 bg-emerald-100 text-emerald-900 shadow-sm'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
      }`}
      onClick={()=>setTraceMode('assist')}
      type="button"
    >
      Normal
    </button>
    <button
      className={`rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition-all ${
        traceMode==='memory'
          ? 'border-amber-400 bg-amber-100 text-amber-900 shadow-sm'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
      }`}
      onClick={()=>setTraceMode('memory')}
      type="button"
    >
      Memory
    </button>
  </div>;

  return <SymbolTracing traceMode={traceMode} isSignedIn={isSignedIn} modeButtons={modeButtons}/>;
}