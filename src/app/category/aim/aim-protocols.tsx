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
        <span className="flex flex-col items-center">
          <span className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border-[8px] border-blue-600 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.12)]">
            <span className="absolute h-[68px] w-[68px] rounded-full border-[8px] border-white bg-blue-600"/><span className="absolute h-[42px] w-[42px] rounded-full border-[7px] border-white bg-blue-300"/><span className="absolute h-[18px] w-[18px] rounded-full border-4 border-white bg-blue-700"/>
          </span>
          {!running && !isFinished && !isMultiplayerSession && <span className="mt-3 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">CLICK TO START</span>}
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
  const [targetSeed,setTargetSeed]=useState(0);const velocity=useRef({x:0,y:0});const hasAutoStarted=useRef(false);const cd=useDuelCountdown(isMultiplayerSession);

  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;startRun()},[cd.launched]);//eslint-disable-line

  const hitsLeft=Math.max(25-hits,0);const isFinished=hits>=25;
  const avg=times.length>0?Math.round(times.reduce((a,b)=>a+b,0)/times.length):null;
  const labScore=best===null?avg===null?null:reactionMsToLeaderboardScore(avg):reactionMsToLeaderboardScore(best);

  // Each target drifts gently in its own random direction
  useEffect(()=>{
    if(!running)return;
    const iv=setInterval(()=>{
      setTarget(c=>{
        let nx=c.x+velocity.current.x;
        let ny=c.y+velocity.current.y;
        // Bounce off edges
        if(nx<=18||nx>=82)velocity.current.x*=-1;
        if(ny<=18||ny>=82)velocity.current.y*=-1;
        return{x:clamp(nx,18,82),y:clamp(ny,18,82)}
      })
    },50);
    return()=>clearInterval(iv)
  },[running]);

  function spawnTarget(){
    const angle=Math.random()*Math.PI*2;
    const speed=0.15+Math.random()*0.2; // gentle, varied speed
    velocity.current={x:Math.cos(angle)*speed,y:Math.sin(angle)*speed};
    setTarget({x:18+Math.random()*64,y:18+Math.random()*64});
    setTargetSeed(c=>c+1)
  }
  function finishRun(nt:number[]){
    const av=Math.round(nt.reduce((a,b)=>a+b,0)/nt.length);
    setBest(c=>c===null?av:Math.min(c,av));
    if(isSignedIn)fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'aim-moving-targets',score:reactionMsToLeaderboardScore(av),...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()});
    setRunning(false);
    setStartedAt(null);
  }
  function startRun(){setHits(0);setTimes([]);setRunning(true);setStartedAt(performance.now());spawnTarget()}
  function click(){
    if(!running){startRun();return}
    const now=performance.now();
    const rt=startedAt===null?null:Math.round(now-startedAt);
    if(rt===null)return;
    const nt=[...times,rt];
    setTimes(nt);
    setHits(h=>h+1);
    if(hits+1>=25){finishRun(nt);return}
    setStartedAt(now);
    spawnTarget()
  }

  return <AimShell title="Moving Targets" kicker="Motion reading" description="Each target drifts — click it, then the next one appears." accent="border-emerald-200 bg-emerald-50 text-emerald-900" isSignedIn={isSignedIn} stats={[{label:'Targets left',value:String(hitsLeft),detail:'Finish all 25 moving targets.'},{label:'Average reaction',value:avg===null?'--':`${avg} ms`,detail:'Average across all hits.'},{label:'Lab score',value:labScore===null?'--':String(labScore),detail:best!==null?`Best: ${best} ms.`:'Calculated.'},{label:'Status',value:isFinished?'Done':running?'Live':'Ready',detail:isFinished?'Try again.':!running?'Click to start.':'Hit each drifting target.'}]}>
    <div className="space-y-4"><div className="relative min-h-[24rem] cursor-pointer overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 sm:min-h-[28rem]">
      {cd.active&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
      <button key={targetSeed} className="absolute h-[88px] w-[88px] rounded-full border-0 bg-transparent" onClick={e=>{e.stopPropagation();click()}} type="button" style={{left:`clamp(18px,${target.x}%,calc(100% - 90px))`,top:`clamp(18px,${target.y}%,calc(100% - 90px))`,transform:'translate(-50%,-50%)'}}>
        <span className="flex flex-col items-center">
          <span className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full border-[8px] border-emerald-600 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.12)]"><span className="absolute h-[68px] w-[68px] rounded-full border-[8px] border-white bg-emerald-600"/><span className="absolute h-[42px] w-[42px] rounded-full border-[7px] border-white bg-emerald-300"/><span className="absolute h-[18px] w-[18px] rounded-full border-4 border-white bg-emerald-700"/></span>
          {!running && !isFinished && !isMultiplayerSession && <span className="mt-3 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">CLICK TO START</span>}
        </span>
      </button>
      {isFinished&&<div className="absolute inset-0 flex items-center justify-center"><button className="rounded-2xl border-b-4 border-emerald-800 bg-emerald-600 px-6 py-3 font-bold text-white" onClick={startRun} type="button">Try again</button></div>}
    </div></div>
  </AimShell>
}

type SplitShape = {
  path: string;      // SVG path data for the shape outline
  cx: number;         // center x (0-100)
  cy: number;         // center y (0-100)
  r: number;          // radius
  label: string;      // shape name
  fill: string;
  stroke: string;
};

function randomSplitShape(): SplitShape {
  const shapes: (() => SplitShape)[] = [
    () => ({ path: '', cx: 50, cy: 50, r: 28, label: 'Circle', fill: '#fde68a', stroke: '#ca8a04' }),
    () => {
      const s = 28;
      return { path: `M${50},${50-s} L${50+s*0.87},${50+s*0.5} L${50-s*0.87},${50+s*0.5} Z`, cx: 50, cy: 50, r: s, label: 'Triangle', fill: '#bfdbfe', stroke: '#3b82f6' };
    },
    () => {
      const s = 24;
      const pts = [0,-1,1,-1,1,1,0,1].map((v,i)=>i%2===0?50+v*s:50+v*s);
      return { path: `M${pts[0]},${pts[1]} L${pts[2]},${pts[3]} L${pts[4]},${pts[5]} L${pts[6]},${pts[7]} Z`, cx: 50, cy: 50, r: s, label: 'Square', fill: '#fecaca', stroke: '#ef4444' };
    },
    () => {
      const s = 24;
      const pts = Array.from({length:6},(_,i)=>{const a=i/6*Math.PI*2-Math.PI/2;const r=i%2===0?s:s*0.55;return `${50+r*Math.cos(a)},${50+r*Math.sin(a)}`});
      return { path: `M${pts.join(' L')} Z`, cx: 50, cy: 50, r: s, label: 'Hexagon', fill: '#d9f99d', stroke: '#65a30d' };
    },
    () => {
      const s = 26;
      const pts = Array.from({length:5},(_,i)=>{const a=i/5*Math.PI*2-Math.PI/2;return `${50+s*Math.cos(a)},${50+s*Math.sin(a)}`});
      return { path: `M${pts.join(' L')} Z`, cx: 50, cy: 50, r: s, label: 'Pentagon', fill: '#e9d5ff', stroke: '#a855f7' };
    },
  ];
  return shapes[Math.floor(Math.random()*shapes.length)]();
}

function PerfectSplit({isSignedIn}:{isSignedIn:boolean}){
  const {goToIntermission,isMultiplayerSession,meta:mm}=useMultiplayerRoundFlow('aim-perfect-split');
  const [running,setRunning]=useState(false);const [solved,setSolved]=useState(0);
  const [balances,setBalances]=useState<number[]>([]);
  const [leftAngle,setLeftAngle]=useState(0.15);const [rightAngle,setRightAngle]=useState(0.6);
  const [submitted,setSubmitted]=useState<{balanceScore:number;leftPercent:number;rightPercent:number}|null>(null);
  const [shape,setShape]=useState<SplitShape>(randomSplitShape());
  const [dragging,setDragging]=useState<'left'|'right'|null>(null);
  const boardRef=useRef<HTMLDivElement|null>(null);const hsrf=useRef(false);const isFinished=!running&&solved>=4;
  const avgBalance=balances.length===0?null:Math.round(balances.reduce((a,b)=>a+b,0)/balances.length);
  const labScore=avgBalance===null?null:avgBalance*10;
  const hasAutoStarted=useRef(false);const cd=useDuelCountdown(isMultiplayerSession);

  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;startRun()},[cd.launched]);//eslint-disable-line
  useEffect(()=>{if(!isSignedIn||!isFinished||labScore===null||hsrf.current)return;hsrf.current=true;fetch('/api/scores/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({testSlug:'aim-perfect-split',score:labScore,...mm})}).then(r=>{if(r.ok&&isMultiplayerSession)goToIntermission()})},[isFinished,isMultiplayerSession,isSignedIn,labScore,goToIntermission,mm]);

  function angleFromPoint(e:React.PointerEvent<HTMLDivElement>):number{
    const b=boardRef.current;if(!b)return 0;
    const r=b.getBoundingClientRect();
    const bx=r.width/2,by=r.height/2;
    const px=e.clientX-r.left,py=e.clientY-r.top;
    return Math.atan2(py-by,px-bx)/(Math.PI*2);
  }

  function handlePointerDown(e:React.PointerEvent<HTMLDivElement>,handle:'left'|'right'){
    if(!running||submitted)return;
    setDragging(handle);
    const a=angleFromPoint(e);
    if(handle==='left')setLeftAngle(a);else setRightAngle(a);
    const target=e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e:React.PointerEvent<HTMLDivElement>){
    if(!dragging||!running||submitted)return;
    const a=angleFromPoint(e);
    if(dragging==='left')setLeftAngle(a);else setRightAngle(a);
  }

  function handlePointerUp(){
    setDragging(null);
  }

  function startRun(){
    hsrf.current=false;setRunning(true);setSolved(0);setBalances([]);
    const s=randomSplitShape();setShape(s);
    setLeftAngle(0.05+Math.random()*0.3);setRightAngle(0.55+Math.random()*0.35);
    setSubmitted(null);
  }

  function submitShape(){
    if(!running||submitted)return;
    // Ensure left is always the smaller angle
    const l=Math.min(leftAngle,rightAngle);
    const r=Math.max(leftAngle,rightAngle);
    const total=r-l;
    const leftShare=total===0?0.5:l/total;
    const rightShare=total===0?0.5:(1-r)/total;
    const idealSplit=0.5;
    const balanceScore=Math.max(0,100-Math.round(Math.abs(idealSplit-leftShare)*200));
    setSubmitted({
      balanceScore,
      leftPercent:Math.round((leftShare/(leftShare+rightShare))*100),
      rightPercent:Math.round((rightShare/(leftShare+rightShare))*100),
    });
  }

  function advanceShape(){
    if(!submitted)return;
    const ns=solved+1;setBalances(c=>[...c,submitted.balanceScore]);
    setSubmitted(null);
    if(ns>=4){setSolved(4);setRunning(false);return}
    setSolved(ns);
    const s=randomSplitShape();setShape(s);
    setLeftAngle(0.05+Math.random()*0.3);setRightAngle(0.55+Math.random()*0.35);
  }

  const lx=shape.cx+shape.r*Math.cos(leftAngle*Math.PI*2);
  const ly=shape.cy+shape.r*Math.sin(leftAngle*Math.PI*2);
  const rx=shape.cx+shape.r*Math.cos(rightAngle*Math.PI*2);
  const ry=shape.cy+shape.r*Math.sin(rightAngle*Math.PI*2);

  return <AimShell title="Perfect Split" kicker="Geometric precision" description="Drag the two dots around the shape to split it as evenly as possible." accent="border-amber-200 bg-amber-50 text-amber-900" isSignedIn={isSignedIn} stats={[{label:'Rounds left',value:`${Math.max(4-solved,0)}`,detail:'Solve the current shape.'},{label:'Average Balance',value:avgBalance===null?'--':`${avgBalance}%`,detail:'Average across submitted shapes.'},{label:'Lab Score',value:labScore===null?'--':`${labScore}`,detail:'Average balance scaled to 1000.'},{label:'Status',value:isFinished?'Done':running?'Split':'Ready',detail:isFinished?'Four rounds complete.':submitted===null?'Drag dots around the shape.':'Read result.'}]}>
    <div className="space-y-4"><div ref={boardRef} className="relative mx-auto aspect-square w-full max-w-[38rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-4 pb-40 sm:pb-80 touch-none select-none">
      {cd.active&&<div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}
      {(running||submitted||isFinished)&&<>
        {submitted && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 rounded-full bg-white/90 border-2 border-slate-200 px-5 py-2 text-center shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{shape.label}</p>
          </div>
        )}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {submitted ? (
            // After submit: show the split areas filled
            <>
              <path d={`M${shape.cx},${shape.cy} L${lx},${ly} A${shape.r},${shape.r} 0 0 1 ${rx},${ry} Z`} fill="#fde68a" fillOpacity="0.72" stroke="#ca8a04" strokeWidth="2.4"/>
              <path d={`M${shape.cx},${shape.cy} L${lx},${ly} A${shape.r},${shape.r} 0 0 0 ${rx},${ry} Z`} fill="#bbf7d0" fillOpacity="0.72" stroke="#22c55e" strokeWidth="2.4"/>
              <line x1={lx} y1={ly} x2={shape.cx} y2={shape.cy} stroke="#0f172a" strokeDasharray="2 3" strokeWidth="1.5"/>
              <line x1={rx} y1={ry} x2={shape.cx} y2={shape.cy} stroke="#0f172a" strokeDasharray="2 3" strokeWidth="1.5"/>
              <circle cx={lx} cy={ly} r="3" fill="#0f172a"/>
              <circle cx={rx} cy={ry} r="3" fill="#0f172a"/>
              {/* Shape outline */}
              {shape.path && <path d={shape.path} fill="none" stroke={shape.stroke} strokeWidth="2"/>}
              {!shape.path && <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill="none" stroke={shape.stroke} strokeWidth="2"/>}
            </>
          ) : (
            <>
              {/* Shape fill + outline */}
              {shape.path && <path d={shape.path} fill={shape.fill} fillOpacity="0.72" stroke={shape.stroke} strokeWidth="2.4"/>}
              {!shape.path && <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} fillOpacity="0.72" stroke={shape.stroke} strokeWidth="2.4"/>}
              {/* Split line between the two points */}
              <line x1={lx} y1={ly} x2={rx} y2={ry} stroke="#0f172a" strokeDasharray="4 4" strokeWidth="2"/>
              {/* Draggable dots */}
              <circle cx={lx} cy={ly} r="5" fill="#3b82f6" stroke="#fff" strokeWidth="2" style={{cursor:dragging==='left'?'grabbing':'grab'}}/>
              <circle cx={rx} cy={ry} r="5" fill="#ef4444" stroke="#fff" strokeWidth="2" style={{cursor:dragging==='right'?'grabbing':'grab'}}/>
            </>
          )}
        </svg>
        {/* Invisible overlay for pointer events on draggable dots */}
        <div className="absolute inset-0" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
          <div className="absolute" style={{left:`${lx}%`,top:`${ly}%`,width:'44px',height:'44px',transform:'translate(-22px,-22px)',zIndex:10}} onPointerDown={e=>handlePointerDown(e,'left')}/>
          <div className="absolute" style={{left:`${rx}%`,top:`${ry}%`,width:'44px',height:'44px',transform:'translate(-22px,-22px)',zIndex:10}} onPointerDown={e=>handlePointerDown(e,'right')}/>
        </div>
      </>}
      {submitted?<div className="absolute inset-x-4 bottom-4 z-20 flex items-end gap-3 rounded-[1.5rem] border-2 border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur"><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Balance</p><p className="mt-1 text-2xl font-black tracking-tight text-slate-800">{submitted.balanceScore}%</p></div><button className="lab-button ml-auto shrink-0" onClick={advanceShape} type="button">{solved>=4?'Done':'Next'}</button></div>
      :running?<div className="absolute inset-x-4 bottom-4 z-20 flex items-end justify-between gap-3 rounded-[1.5rem] border-2 border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Drag the dots to split the shape</p></div><button className="lab-button shrink-0" onClick={submitShape} type="button">Done</button></div>
      :isFinished?<div className="absolute inset-0 flex items-center justify-center"><div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-5 py-4 text-center shadow-lg"><p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Done</p><p className="mt-2 text-xl font-black tracking-tight text-slate-800">Four rounds complete</p><button className="mt-4 lab-button" onClick={startRun} type="button">Run again</button></div></div>
      :!isMultiplayerSession && !running && !isFinished ?<div className="absolute inset-0 flex items-center justify-center"><button className="lab-button" onClick={startRun} type="button">Start Split Test</button></div>
      :null}
    </div></div>
  </AimShell>
}

export function AimProtocols({mode,isSignedIn}:{mode:string;isSignedIn:boolean}){
  if(mode==='moving')return <MovingTargets isSignedIn={isSignedIn}/>
  if(mode==='split')return <PerfectSplit isSignedIn={isSignedIn}/>
  return <AimTrainer isSignedIn={isSignedIn}/>
}