'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { useDuelCountdown } from '@/components/use-duel-countdown';

type Point = { x: number; y: number };
type TraceMode = 'assist'|'memory';
type TraceSymbol = { key: string; label: string; points: Point[] };

function clamp(v:number,lo:number,hi:number){return Math.min(hi,Math.max(lo,v))}
function dist(a:Point,b:Point){return Math.hypot(a.x-b.x,a.y-b.y)}

function MouseShell({title,kicker,description,accent,isSignedIn,stats,children}:{title:string;kicker:string;description:string;accent:string;isSignedIn:boolean;stats:{label:string;value:string;detail:string}[];children:ReactNode}){
  return <section className="lab-card p-4 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Mouse Category</p><h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">{title}</h2><p className={`mt-3 inline-flex rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${accent}`}>{kicker}</p></div><div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">{isSignedIn?'Leaderboard sync active':'Guest mode'}</div></div><p className="mb-4 max-w-2xl text-sm font-medium leading-6 text-slate-500">{description}</p>{children}<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(s=><div key={s.label} className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]"><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{s.label}</p><p className="mt-2 text-3xl font-black text-slate-800">{s.value}</p><p className="mt-1 text-sm font-medium text-slate-500">{s.detail}</p></div>)}</div></section>
}

const TRACE_SYMBOLS:TraceSymbol[]=[{key:'star',label:'Star',points:[{x:50,y:16},{x:58,y:38},{x:82,y:38},{x:62,y:52},{x:70,y:76},{x:50,y:61},{x:30,y:76},{x:38,y:52},{x:18,y:38},{x:42,y:38},{x:50,y:16}]},{key:'arrow',label:'Arrow',points:[{x:18,y:50},{x:60,y:50},{x:60,y:36},{x:84,y:50},{x:60,y:64},{x:60,y:50},{x:18,y:50}]},{key:'heart',label:'Heart',points:[{x:50,y:78},{x:74,y:55},{x:80,y:38},{x:69,y:27},{x:56,y:30},{x:50,y:37},{x:44,y:30},{x:31,y:27},{x:20,y:38},{x:26,y:55},{x:50,y:78}]},{key:'loop',label:'Loop',points:[{x:50,y:20},{x:75,y:30},{x:82,y:50},{x:68,y:72},{x:50,y:80},{x:32,y:72},{x:18,y:50},{x:25,y:30},{x:40,y:26},{x:50,y:34},{x:32,y:55},{x:50,y:68},{x:68,y:55},{x:50,y:20}]}];

function evaluateTrace(userPts:Point[],tplPts:Point[]){
  if(userPts.length<4)return{accuracy:0,deviation:99,completion:0,labScore:0};
  function pathLen(pts:Point[]){let s=0;for(let i=1;i<pts.length;i++)s+=dist(pts[i-1],pts[i]);return s}
  const tplLen=pathLen(tplPts);
  const userLen=pathLen(userPts);
  const coverage=Math.min(1,userLen/tplLen);
  if(coverage<0.5)return{accuracy:0,deviation:99,completion:0,labScore:0};

  // Evenly resample both paths to 200 points for fair comparison
  function resample(pts:Point[],n:number):Point[]{
    if(pts.length<2)return pts;
    const lens:number[]=[0];
    for(let i=1;i<pts.length;i++)lens.push(lens[i-1]+dist(pts[i-1],pts[i]));
    const total=lens[lens.length-1];
    const step=total/(n-1);
    const out:Point[]=[pts[0]];
    let segIdx=0;
    for(let s=step;s<total-step*0.5;s+=step){
      while(segIdx<lens.length-2&&lens[segIdx+1]<=s)segIdx++;
      const t=(s-lens[segIdx])/(lens[segIdx+1]-lens[segIdx]||1);
      out.push({x:pts[segIdx].x+(pts[segIdx+1].x-pts[segIdx].x)*t,y:pts[segIdx].y+(pts[segIdx+1].y-pts[segIdx].y)*t});
    }
    out.push(pts[pts.length-1]);
    return out;
  }
  const N=200;
  const usamp=resample(userPts,N);
  const tsamp=resample(tplPts,N);

  // For each resampled user point, find nearest template point.
  // Count how many are within the THRESHOLD distance (= "on target").
  const THRESH=8;
  let onTarget=0;
  let avgDev=0;
  for(let i=0;i<N;i++){
    let best=Infinity;
    for(let ti=0;ti<tsamp.length;ti++){const d=dist(usamp[i],tsamp[ti]);if(d<best)best=d}
    avgDev+=best;
    if(best<=THRESH)onTarget++;
  }
  avgDev/=N;
  const onTargetPct=clamp(Math.round((onTarget/N)*100),0,100);
  // Multiply by coverage so incomplete traces score lower
  const accuracy=Math.round(onTargetPct*coverage);
  const labScore=clamp(Math.round(1000-avgDev*20),0,1000);
  return{accuracy,deviation:Number(avgDev.toFixed(2)),completion:accuracy,labScore};
}

function SymbolTracing({isSignedIn}:{initialTraceMode?:TraceMode;isSignedIn:boolean}){
  const {goToIntermission,isMultiplayerSession,meta:mm}=useMultiplayerRoundFlow('mouse-symbol-tracing');
  const ROUNDS=4;
  const cd=useDuelCountdown(isMultiplayerSession);
  const hasAutoStarted=useRef(false);

  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;startTraceRun()},[cd.launched]);//eslint-disable-line

  const [phase,setPhase]=useState<'idle'|'tracing'|'reveal'|'finished'>('idle');
  const [roundIdx,setRoundIdx]=useState(0);
  const [order,setOrder]=useState<number[]>([]);
  const [up,setUp]=useState<Point[]>([]);
  const traceRef=useRef<Point[]>([]);
  const [drawing,setDrawing]=useState(false);
  const [scores,setScores]=useState<number[]>([]);
  const [result,setResult]=useState<ReturnType<typeof evaluateTrace>|null>(null);
  const boardRef=useRef<HTMLDivElement|null>(null);
  const hsrf=useRef(false);

  const symbolIdx=order[roundIdx]??0;
  const symbol=TRACE_SYMBOLS[symbolIdx];
  const avgScore=scores.length===0?null:Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);

  useEffect(()=>{if(!isSignedIn||phase!=='finished'||avgScore===null||hsrf.current)return;hsrf.current=true;fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'mouse-symbol-tracing',score:avgScore,...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()})},[avgScore,goToIntermission,isMultiplayerSession,isSignedIn,phase,mm]);

  function getBP(cx:number,cy:number){const b=boardRef.current;if(!b)return null;const r=b.getBoundingClientRect();return{x:clamp(((cx-r.left)/r.width)*100,0,100),y:clamp(((cy-r.top)/r.height)*100,0,100)}}

  function startTraceRun(){
    const o=[...Array(TRACE_SYMBOLS.length).keys()];
    for(let i=o.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[o[i],o[j]]=[o[j],o[i]]}
    setOrder(o.slice(0,ROUNDS));
    setScores([]);
    setResult(null);
    hsrf.current=false;
    traceRef.current=[];
    setRoundIdx(0);
    setPhase('tracing');
    setUp([]);
    setDrawing(false);
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
    setPhase('tracing');
    setUp([]);
    setDrawing(false);
  }

  return <MouseShell title="Symbol Tracing" kicker="Path precision" description="Trace each target shape as precisely as possible." accent="border-emerald-200 bg-emerald-50 text-emerald-900" isSignedIn={isSignedIn} stats={[{label:'Rounds left',value:`${Math.max(ROUNDS-scores.length-(phase==='reveal'?1:0),0)}`,detail:'Complete four symbols.'},{label:'Shape',value:symbol.label,detail:`Round ${Math.min(roundIdx+1,ROUNDS)} / ${ROUNDS}`},{label:'Last Accuracy',value:result===null?'--':`${result.accuracy}%`,detail:'How closely your line matched.'},{label:'Lab score',value:phase==='finished'?`${avgScore??0}`:result===null?'--':`${result.labScore}`,detail:phase==='finished'?'Average lab score over 4 rounds.':'Trace performance score.'}]}>
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {phase==='tracing'&&<button className="lab-button" onClick={()=>{const r=evaluateTrace(traceRef.current,symbol.points);setDrawing(false);setResult(r);setPhase('reveal');}} type="button">Done Trace</button>}
        {phase==='finished'&&<button className="lab-button" onClick={startTraceRun} type="button">Start New Run</button>}
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[38rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 touch-none select-none" onPointerDown={e=>{if(phase!=='tracing')return;const p=getBP(e.clientX,e.clientY);if(!p)return;if(traceRef.current.length>0)return;setDrawing(true);traceRef.current=[p];setUp([p])}} onPointerMove={e=>{if(phase!=='tracing'||!drawing)return;const p=getBP(e.clientX,e.clientY);if(!p)return;const cur=traceRef.current;if(cur.length===0){traceRef.current=[p];setUp([p]);return}if(dist(cur[cur.length-1],p)<0.25)return;const next=[...cur,p];traceRef.current=next;setUp(next)}} onPointerUp={()=>{setDrawing(false)}} ref={boardRef}>
        {cd.active&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
          {phase==='tracing'&&<polyline fill="none" points={symbol.points.map(p=>`${p.x},${p.y}`).join(' ')} stroke="#10b981" strokeDasharray="3 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6"/>}
          <polyline fill="none" points={up.map(p=>`${p.x},${p.y}`).join(' ')} stroke="#0f172a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4"/>
        </svg>

        {phase==='idle'&&!isMultiplayerSession&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70"><button className="lab-button" onClick={startTraceRun} type="button">Start Tracing</button></div>}

        {phase==='tracing'&&<div className="absolute left-1/2 top-3 z-10 -translate-x-1/2"><span className="rounded-full border-2 border-slate-200 bg-white/90 px-4 py-1.5 text-xs font-bold tracking-[0.18em] text-slate-500 shadow-sm uppercase">{symbol.label}</span></div>}

        {phase==='reveal'&&result&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/45 backdrop-blur-sm"><div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-5 py-4 text-center shadow-lg"><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{symbol.label}</p><p className={`mt-3 text-2xl font-black ${result.accuracy>=70?'text-emerald-600':'text-amber-600'}`}>{result.accuracy}% Accuracy</p><p className="mt-1 text-sm text-slate-500">Score: {result.labScore}</p><button className="mt-3 lab-button" onClick={advanceRound} type="button">{roundIdx+1>=ROUNDS?'See Final Score':'Next Symbol'}</button></div></div>}

        {phase==='finished'&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/45 backdrop-blur-sm"><div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-5 py-4 text-center shadow-lg"><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p><p className="mt-2 text-xl font-black tracking-tight text-slate-800">Avg Lab Score: {avgScore??0}</p><button className="mt-4 lab-button" onClick={startTraceRun} type="button">Start New Run</button></div></div>}
      </div>
    </div>
  </MouseShell>
}

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

export function MouseProtocols({mode,isSignedIn}:{initialCpsDuration?:5|10|15;initialTraceMode?:TraceMode;mode:string;isSignedIn:boolean}){
  if(mode==='tracking')return <TrackingTest isSignedIn={isSignedIn}/>
  if(mode==='cps')return <CpsTester isSignedIn={isSignedIn}/>
  return <SymbolTracing isSignedIn={isSignedIn}/>
}