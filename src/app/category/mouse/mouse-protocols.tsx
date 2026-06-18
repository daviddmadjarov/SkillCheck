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

const TRACE_SYMBOLS:TraceSymbol[]=[{key:'star',label:'Star',points:[{x:50,y:16},{x:58,y:38},{x:82,y:38},{x:62,y:52},{x:70,y:76},{x:50,y:61},{x:30,y:76},{x:38,y:52},{x:18,y:38},{x:42,y:38},{x:50,y:16}]},{key:'arrow',label:'Arrow',points:[{x:18,y:50},{x:60,y:50},{x:60,y:36},{x:84,y:50},{x:60,y:64},{x:60,y:50},{x:18,y:50}]},{key:'heart',label:'Heart',points:[{x:50,y:78},{x:74,y:55},{x:80,y:38},{x:69,y:27},{x:56,y:30},{x:50,y:37},{x:44,y:30},{x:31,y:27},{x:20,y:38},{x:26,y:55},{x:50,y:78}]}];

function evaluateTrace(up:Point[],tp:Point[]){if(up.length<4)return{accuracy:0,deviation:99,completion:0,labScore:0};const sc=clamp(Math.min(up.length,tp.length),56,220);let s=0;for(let i=0;i<sc;i++){const d=Math.hypot(up[i].x-tp[i].x,up[i].y-tp[i].y);s+=d}const avg=s/sc;const acc=clamp(Math.round(100-avg*3.45),0,100);const score=clamp(Math.round(acc*10-avg*48),0,1000);return{accuracy:acc,deviation:Number(avg.toFixed(2)),completion:acc,labScore:score}}

function SymbolTracing({isSignedIn}:{initialTraceMode?:TraceMode;isSignedIn:boolean}){
  const {goToIntermission,isMultiplayerSession,meta:mm}=useMultiplayerRoundFlow('mouse-symbol-tracing');
  const [traceMode]=useState<TraceMode>('assist');
  const [so,setSo]=useState([0,1,2,3]);const [ri,setRi]=useState(0);const [running,setRunning]=useState(false);
  const [sf,setSf]=useState(false);const [drawing,setDrawing]=useState(false);const [sg,setSg]=useState(true);
  const [up,setUp]=useState<Point[]>([]);const [rs,setRs]=useState<number[]>([]);const [result,setResult]=useState<ReturnType<typeof evaluateTrace>|null>(null);
  const boardRef=useRef<HTMLDivElement|null>(null);const hsrf=useRef(false);const hasAutoStarted=useRef(false);const cd=useDuelCountdown(isMultiplayerSession);

  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;startTraceRun()},[cd.launched]);//eslint-disable-line

  const symbol=TRACE_SYMBOLS[so[ri]??0];const avgScore=rs.length===0?null:Math.round(rs.reduce((a,b)=>a+b,0)/rs.length);

  useEffect(()=>{if(!isSignedIn||!sf||avgScore===null||hsrf.current)return;hsrf.current=true;fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'mouse-symbol-tracing',score:avgScore,...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()})},[avgScore,goToIntermission,isMultiplayerSession,isSignedIn,sf,mm]);

  function getBP(cx:number,cy:number){const b=boardRef.current;if(!b)return null;const r=b.getBoundingClientRect();return{x:clamp(((cx-r.left)/r.width)*100,0,100),y:clamp(((cy-r.top)/r.height)*100,0,100)}}
  function startTraceRun(){const o=[...Array(TRACE_SYMBOLS.length).keys()];for(let i=o.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[o[i],o[j]]=[o[j],o[i]]}setSo(o.slice(0,4));setRs([]);setSf(false);hsrf.current=false;prepareRound(0)}
  function prepareRound(n:number){setRi(n);setRunning(true);setDrawing(false);setUp([]);setResult(null);setSg(true)}
  function finishTraceRound(){if(!running)return;setRunning(false);setDrawing(false);setSg(true);const r=evaluateTrace(up,symbol.points);setResult(r)}
  function advanceRound(){if(!result)return;const ns=[...rs,result.labScore];setRs(ns);const nr=ri+1;if(nr>=4){setSf(true);setResult(null);setRunning(false);return}prepareRound(nr)}

  const isIdle=!running&&!sf&&result===null&&rs.length===0;
  return <MouseShell title="Symbol Tracing" kicker="Path precision" description="Trace each target shape as precisely as possible." accent="border-emerald-200 bg-emerald-50 text-emerald-900" isSignedIn={isSignedIn} stats={[{label:'Rounds left',value:`${Math.max(4-rs.length-(result===null?0:1),0)}`,detail:'Complete four symbols.'},{label:'Shape',value:symbol.label,detail:`Round ${Math.min(ri+1,4)} / 4`},{label:'Last Accuracy',value:result===null?'--':`${result.accuracy}%`,detail:'How closely your line matched.'},{label:'Lab score',value:sf?`${avgScore??0}`:result===null?'--':`${result.labScore}`,detail:sf?'Average lab score over 4 rounds.':'Trace performance score.'}]}>
    <div className="space-y-4"><div className="flex flex-wrap gap-2">
      {running&&<button className="lab-button" onClick={finishTraceRound} type="button">Done Trace</button>}
      {!running&&result!==null&&!sf&&<button className="lab-button" onClick={advanceRound} type="button">Next Symbol</button>}
      {sf&&<button className="lab-button" onClick={startTraceRun} type="button">Start New Run</button>}
    </div>
    <div className="relative mx-auto aspect-square w-full max-w-[38rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 touch-none select-none" onPointerDown={e=>{if(!running)return;const p=getBP(e.clientX,e.clientY);if(!p)return;setDrawing(true);setUp([p]);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!running||!drawing)return;const p=getBP(e.clientX,e.clientY);if(!p)return;setUp(c=>c.length===0?[p]:dist(c[c.length-1],p)<0.25?c:[...c,p])}} onPointerUp={()=>setDrawing(false)} ref={boardRef}>
      {cd.active&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
        {sg&&<polyline fill="none" points={symbol.points.map(p=>`${p.x},${p.y}`).join(' ')} stroke="#10b981" strokeDasharray="3 4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" style={isIdle?{filter:'blur(1.8px)',opacity:0.45}:undefined}/>}
        <polyline fill="none" points={up.map(p=>`${p.x},${p.y}`).join(' ')} stroke="#0f172a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.4"/>
      </svg>
      {isIdle&&!isMultiplayerSession&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/35 backdrop-blur-sm"><button className="lab-button" onClick={startTraceRun} type="button">Start Tracing</button></div>}
      {sf&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-white/45 backdrop-blur-sm"><div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-5 py-4 text-center shadow-lg"><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p><p className="mt-2 text-xl font-black tracking-tight text-slate-800">Avg Lab Score: {avgScore??0}</p><button className="mt-4 lab-button" onClick={startTraceRun} type="button">Start New Run</button></div></div>}
    </div></div>
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

  useEffect(()=>{if(!running)return;const s=performance.now();let inside=false;let elapsed=0;let ti=0;const up=(ts:number)=>{elapsed=ts-s;const rem=Math.max(0,20000-elapsed);setSecondsLeft(Math.ceil(rem/1000));const p=elapsed/20000;const ang=(s*0.001+elapsed*0.005)%(Math.PI*2);const nx=50+Math.sin(ang)*35+Math.sin(elapsed*0.0075)*8;const ny=50+Math.cos(ang*0.85)*30+Math.cos(elapsed*0.006)*6;setTarget({x:clamp(nx,10,90),y:clamp(ny,10,90)});if(inside){ti=Math.min(20000,ti+16);setTimeInsideMs(ti)}if(elapsed>=20000){setIsInside(false);setRunning(false);setRunComplete(true);if(isSignedIn){const fs=Math.round((ti/20000)*1000);fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'aim-tracking-test',score:fs,...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()})}return}requestAnimationFrame(up)};const h=(e:PointerEvent)=>{const a=arenaRef.current;if(!a)return;const r=a.getBoundingClientRect();const px=clamp(((e.clientX-r.left)/r.width)*100,0,100);const py=clamp(((e.clientY-r.top)/r.height)*100,0,100);inside=dist({x:px,y:py},target)<6.5;setIsInside(inside)};window.addEventListener('pointermove',h,{passive:true});requestAnimationFrame(up);return()=>window.removeEventListener('pointermove',h)},[running]);

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