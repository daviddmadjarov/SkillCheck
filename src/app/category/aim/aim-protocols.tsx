'use client';

import { useEffect, useRef, useState } from 'react';
import { useMultiplayerRoundFlow } from '@/lib/multiplayer/client';
import { useDuelCountdown } from '@/components/use-duel-countdown';
import { reactionMsToLeaderboardScore } from '@/lib/scoring/reaction';

function clamp(v:number,lo:number,hi:number){return Math.min(hi,Math.max(lo,v))}
type Point = { x: number; y: number };

function AimShell({title,kicker,description,accent,isSignedIn,stats,children}:{title:string;kicker:string;description:string;accent:string;isSignedIn:boolean;stats:{label:string;value:string;detail:string}[],children:React.ReactNode}){
  return <section className="lab-card p-4 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Aim Category</p><h2 className="mt-2 text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">{title}</h2><p className={`mt-3 inline-flex rounded-full border-2 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${accent}`}>{kicker}</p></div><div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">{isSignedIn?'Leaderboard sync active':'Guest mode'}</div></div><p className="mb-4 max-w-2xl text-sm font-medium leading-6 text-slate-500">{description}</p>{children}<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(s=><div key={s.label} className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:min-h-[166px]"><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{s.label}</p><p className="mt-2 text-3xl font-black text-slate-800">{s.value}</p><p className="mt-1 text-sm font-medium text-slate-500">{s.detail}</p></div>)}</div></section>
}

function AimTrainer({isSignedIn}:{isSignedIn:boolean}){
  const {goToIntermission,isMultiplayerSession,meta:mm}=useMultiplayerRoundFlow('aim-trainer');
  const [target,setTarget]=useState<Point>({x:50,y:50});const [times,setTimes]=useState<number[]>([]);const [best,setBest]=useState<number|null>(null);
  const [startedAt,setStartedAt]=useState<number|null>(null);const [running,setRunning]=useState(false);const [targetSeed,setTargetSeed]=useState(0);
  const hasAutoStarted=useRef(false);const cd=useDuelCountdown(isMultiplayerSession);

  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;startRun()},[cd.launched]);//eslint-disable-line

  const hitsLeft=Math.max(25-times.length,0);const isFinished=times.length>=25;
  const avg=times.length>0?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null;
  const labScore=best===null?avg===null?null:reactionMsToLeaderboardScore(avg):reactionMsToLeaderboardScore(best);

  function startRun(){setTimes([]);setRunning(true);setStartedAt(performance.now());spawnTarget()}
  function spawnTarget(){setTarget({x:Math.random()*64+18,y:Math.random()*64+18});setTargetSeed(c=>c+1)}
  function click(){if(!running){startRun();return}const now=performance.now();const rt=startedAt===null?null:Math.round(now-startedAt);if(rt!==null){const nt=[...times,rt];setTimes(nt);if(nt.length>=25){const av=Math.round(nt.reduce((a,b)=>a+b,0)/nt.length);setBest(c=>c===null?av:Math.min(c,av));if(isSignedIn)fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'aim-trainer',score:reactionMsToLeaderboardScore(av),...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()});setRunning(false);setStartedAt(null);return}}setStartedAt(now);spawnTarget()}

  return <AimShell title="Aim Trainer" kicker="Precision warm-up" description="Click the target where it appears. Twenty-five hits complete the drill." accent="border-cyan-200 bg-cyan-50 text-cyan-900" isSignedIn={isSignedIn} stats={[{label:'Targets left',value:String(hitsLeft),detail:'Finish all 25 targets.'},{label:'Average reaction',value:avg===null?'--':`${avg} ms`,detail:'Average across all hits.'},{label:'Lab score',value:labScore===null?'--':String(labScore),detail:best!==null?`Best: ${best} ms.`:'Calculated from average.'},{label:'Status',value:isFinished?'Done':!running?'Ready':'Live',detail:isFinished?'Use Try again.':!running?'Click target.':'Click each target.'}]}>
    <div className="space-y-4"><div className="relative min-h-[24rem] cursor-pointer overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4 sm:min-h-[28rem]">
      {cd.active&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
      <button key={targetSeed} className="absolute h-[88px] w-[88px] rounded-full border-0 bg-transparent transition-opacity duration-150 ease-out" onClick={click} type="button" style={{left:`clamp(18px,${target.x}%,calc(100% - 90px))`,top:`clamp(18px,${target.y}%,calc(100% - 90px))`,transform:'translate(-50%,-50%)'}}>
        <span className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border-[8px] border-blue-600 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.12)]">
          <span className="absolute h-[68px] w-[68px] rounded-full border-[8px] border-white bg-blue-600"/><span className="absolute h-[42px] w-[42px] rounded-full border-[7px] border-white bg-blue-300"/><span className="absolute h-[18px] w-[18px] rounded-full border-4 border-white bg-blue-700"/>
        </span>
      </button>
      {isFinished&&<div className="absolute inset-0 flex items-center justify-center"><button className="lab-button" onClick={startRun} type="button">Try again</button></div>}
    </div></div>
  </AimShell>
}

function MovingTargets({isSignedIn}:{isSignedIn:boolean}){
  const {goToIntermission,isMultiplayerSession,meta:mm}=useMultiplayerRoundFlow('aim-moving-targets');
  const [target,setTarget]=useState<Point>({x:50,y:50});const [hits,setHits]=useState(0);const [times,setTimes]=useState<number[]>([]);
  const [best,setBest]=useState<number|null>(null);const [startedAt,setStartedAt]=useState<number|null>(null);const [running,setRunning]=useState(false);
  const [targetSeed,setTargetSeed]=useState(0);const vx=useRef(12);const hasAutoStarted=useRef(false);const cd=useDuelCountdown(isMultiplayerSession);

  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;startRun()},[cd.launched]);//eslint-disable-line

  const hitsLeft=Math.max(25-hits,0);const isFinished=hits>=25;
  const avg=times.length>0?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null;
  const labScore=best===null?avg===null?null:reactionMsToLeaderboardScore(avg):reactionMsToLeaderboardScore(best);

  useEffect(()=>{if(!running)return;const iv=setInterval(()=>{setTarget(c=>{let nx=c.x+vx.current*0.05;if(nx<=12||nx>=88)vx.current*=-1;return{x:clamp(nx,12,88),y:clamp(50+Math.sin(Date.now()*0.004)*25,15,85)}})},16);return()=>clearInterval(iv)},[running]);

  function startRun(){setHits(0);setTimes([]);setRunning(true);setStartedAt(performance.now());setTargetSeed(c=>c+1)}
  function click(){if(!running){startRun();return}const now=performance.now();const rt=startedAt===null?null:Math.round(now-startedAt);if(rt!==null){const nt=[...times,rt];setTimes(nt);setHits(h=>h+1);if(hits+1>=25){const av=Math.round(nt.reduce((a,b)=>a+b,0)/nt.length);setBest(c=>c===null?av:Math.min(c,av));if(isSignedIn)fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'aim-moving-targets',score:reactionMsToLeaderboardScore(av),...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()});setRunning(false);setStartedAt(null);return}}setStartedAt(now)}

  return <AimShell title="Moving Targets" kicker="Motion reading" description="Chase the drifting target before it relocates." accent="border-emerald-200 bg-emerald-50 text-emerald-900" isSignedIn={isSignedIn} stats={[{label:'Targets left',value:String(hitsLeft),detail:'Finish all 25 moving targets.'},{label:'Average reaction',value:avg===null?'--':`${avg} ms`,detail:'Average across all hits.'},{label:'Lab score',value:labScore===null?'--':String(labScore),detail:best!==null?`Best: ${best} ms.`:'Calculated.'},{label:'Status',value:isFinished?'Done':running?'Live':'Ready',detail:isFinished?'Try again.':!running?'Click to start.':'Track the target.'}]}>
    <div className="space-y-4"><div className="relative min-h-[24rem] cursor-pointer overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 sm:min-h-[28rem]" onClick={()=>{}}>
      {cd.active&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
      <button key={targetSeed} className="absolute h-[88px] w-[88px] rounded-full border-0 bg-transparent" onClick={e=>{e.stopPropagation();click()}} type="button" style={{left:`clamp(18px,${target.x}%,calc(100% - 90px))`,top:`clamp(18px,${target.y}%,calc(100% - 90px))`,transform:'translate(-50%,-50%)'}}>
        <span className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border-[8px] border-emerald-600 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.12)]"><span className="absolute h-[68px] w-[68px] rounded-full border-[8px] border-white bg-emerald-600"/><span className="absolute h-[42px] w-[42px] rounded-full border-[7px] border-white bg-emerald-300"/><span className="absolute h-[18px] w-[18px] rounded-full border-4 border-white bg-emerald-700"/></span>
      </button>
      {isFinished&&<div className="absolute inset-0 flex items-center justify-center"><button className="rounded-2xl border-b-4 border-emerald-800 bg-emerald-600 px-6 py-3 font-bold text-white" onClick={startRun} type="button">Try again</button></div>}
    </div></div>
  </AimShell>
}

function PerfectSplit({isSignedIn}:{isSignedIn:boolean}){
  const {goToIntermission,isMultiplayerSession,meta:mm}=useMultiplayerRoundFlow('aim-perfect-split');
  const [running,setRunning]=useState(false);const [shapeIdx,setShapeIdx]=useState(0);const [solved,setSolved]=useState(0);
  const [balances,setBalances]=useState<number[]>([]);const [left,setLeft]=useState(0.15);const [right,setRight]=useState(0.6);
  const [submitted,setSubmitted]=useState<{balanceScore:number;leftPercent:number;rightPercent:number}|null>(null);
  const boardRef=useRef<HTMLDivElement|null>(null);const hsrf=useRef(false);const isFinished=!running&&solved>=4;
  const avgBalance=balances.length===0?null:Math.round(balances.reduce((a,b)=>a+b,0)/balances.length);
  const labScore=avgBalance===null?null:avgBalance*10;
  const hasAutoStarted=useRef(false);const cd=useDuelCountdown(isMultiplayerSession);

  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;startRun()},[cd.launched]);//eslint-disable-line
  useEffect(()=>{if(!isSignedIn||!isFinished||labScore===null||hsrf.current)return;hsrf.current=true;fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'aim-perfect-split',score:labScore,...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()})},[isFinished,isMultiplayerSession,isSignedIn,labScore,goToIntermission,mm]);

  function startRun(){hsrf.current=false;setRunning(true);setShapeIdx(0);setSolved(0);setBalances([]);setLeft(0.15);setRight(0.6);setSubmitted(null)}
  function submitShape(){if(!running||submitted)return;const result={balanceScore:Math.max(0,100-Math.round(Math.abs(0.5-left/(left+right))*100)),leftPercent:Math.round((left/(left+right))*100),rightPercent:Math.round((right/(left+right))*100)};setSubmitted(result)}
  function advanceShape(){if(!submitted)return;const ns=solved+1;setBalances(c=>[...c,submitted.balanceScore]);setSubmitted(null);if(ns>=4){setRunning(false);return}setSolved(ns);setShapeIdx(i=>i+1);setLeft(0.15);setRight(0.6)}

  return <AimShell title="Perfect Split" kicker="Geometric precision" description="Move two points around the border and split the shape as evenly as possible." accent="border-amber-200 bg-amber-50 text-amber-900" isSignedIn={isSignedIn} stats={[{label:'Rounds left',value:`${Math.max(4-solved,0)}`,detail:'Solve the current shape.'},{label:'Average Balance',value:avgBalance===null?'--':`${avgBalance}%`,detail:'Average across submitted shapes.'},{label:'Lab Score',value:labScore===null?'--':`${labScore}`,detail:'Average balance scaled to 1000.'},{label:'Status',value:isFinished?'Done':running?'Split':'Ready',detail:isFinished?'Four rounds complete.':submitted===null?'Arrange the split.':'Read result.'}]}>
    <div className="space-y-4"><div ref={boardRef} className="relative mx-auto aspect-square w-full max-w-[38rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-4 pb-40 sm:pb-80">
      {cd.active&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
      {(running||submitted||isFinished)&&<>
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full"><circle cx="50" cy="50" r="30" fill="#fde68a" fillOpacity="0.72" stroke="#ca8a04" strokeWidth="2.4"/><line x1={50+30*Math.cos(left*Math.PI*2)} y1={50+30*Math.sin(left*Math.PI*2)} x2={50+30*Math.cos(right*Math.PI*2)} y2={50+30*Math.sin(right*Math.PI*2)} stroke="#0f172a" strokeDasharray="4 4" strokeWidth="2"/></svg>
      </>}
      {submitted?<div className="absolute inset-x-4 bottom-4 z-20 flex items-end gap-3 rounded-[1.5rem] border-2 border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur"><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Balance</p><p className="mt-1 text-2xl font-black tracking-tight text-slate-800">{submitted.balanceScore}%</p></div><button className="lab-button ml-auto shrink-0" onClick={advanceShape} type="button">{solved>=4?'Done':'Next'}</button></div>
      :running?<div className="absolute inset-x-4 bottom-4 z-20 flex items-end justify-between gap-3 rounded-[1.5rem] border-2 border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Ready</p></div><button className="lab-button shrink-0" onClick={submitShape} type="button">Done</button></div>
      :isFinished?<div className="absolute inset-0 flex items-center justify-center"><div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-5 py-4 text-center shadow-lg"><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Done</p><p className="mt-2 text-xl font-black tracking-tight text-slate-800">Four rounds complete</p><button className="mt-4 lab-button" onClick={startRun} type="button">Run again</button></div></div>
      :!isMultiplayerSession?<div className="absolute inset-0 flex items-center justify-center"><button className="lab-button" onClick={startRun} type="button">Start Split Test</button></div>
      :null}
    </div></div>
  </AimShell>
}

export function AimProtocols({mode,isSignedIn}:{mode:string;isSignedIn:boolean}){
  if(mode==='moving')return <MovingTargets isSignedIn={isSignedIn}/>
  if(mode==='split')return <PerfectSplit isSignedIn={isSignedIn}/>
  return <AimTrainer isSignedIn={isSignedIn}/>
}