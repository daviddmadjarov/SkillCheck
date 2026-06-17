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

// ─────────────────────────────────────────────────────────────────────
// PERFECT SPLIT — proper contour-based shape splitting with area scoring
// ─────────────────────────────────────────────────────────────────────

type SplitShapeDef = {
  /** Polygon vertices in 0-100 coordinate space */
  pts: Point[];
  label: string;
  fill: string;
  stroke: string;
  /** SVG path string for rendering */
  path: string;
};

/** Shoelace formula: signed polygon area */
function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y;
    a -= pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

/** Split a convex polygon by a line through two contour points, return areas of both halves */
function splitAreas(shape: Point[], p1Idx: number, p2Idx: number): [number, number] {
  const n = shape.length;
  // Build two polygons: clockwise from p1 to p2, and p2 to p1
  const half1: Point[] = [shape[p1Idx], shape[p2Idx]];
  const half2: Point[] = [shape[p2Idx], shape[p1Idx]];
  // Walk forward from p2 to p1 for half2
  for (let i = p2Idx; i !== p1Idx; i = (i + 1) % n) {
    half2.push(shape[i]);
  }
  // Walk forward from p1 to p2 for half1
  for (let i = p1Idx; i !== p2Idx; i = (i + 1) % n) {
    half1.push(shape[i]);
  }
  const a1 = polygonArea(half1);
  const a2 = polygonArea(half2);
  return [a1, a2];
}

/** Project a point onto the nearest edge of the polygon contour, returning the interpolated vertex index (smooth) */
function projectOntoContour(shape: Point[], px: number, py: number): { idx: number; frac: number } {
  let bestSegStart = 0;
  let bestFrac = 0;
  let bestDist = Infinity;
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i];
    const b = shape[(i + 1) % shape.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
    }
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < bestDist) {
      bestDist = d;
      bestSegStart = i;
      bestFrac = t;
    }
  }
  return { idx: bestSegStart, frac: bestFrac };
}

/** Compute the interpolated point from a segment index + fraction */
function edgePoint(shape: Point[], segIdx: number, frac: number): Point {
  const a = shape[segIdx];
  const b = shape[(segIdx + 1) % shape.length];
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

/** Split a polygon by a line through two interpolated edge points, return areas.
 *  Tries both contour directions and picks the split closer to 50/50. */
function splitAreasSmooth(shape: Point[], idxA: number, fracA: number, idxB: number, fracB: number): [number, number] {
  const n = shape.length;
  const pA = edgePoint(shape, idxA, fracA);
  const pB = edgePoint(shape, idxB, fracB);

  function walkForward(fromIdx: number, toIdx: number): Point[] {
    const pts: Point[] = [];
    for (let i = (fromIdx + 1) % n; ; i = (i + 1) % n) {
      pts.push(shape[i]);
      if (i === toIdx) break;
    }
    return pts;
  }

  // Try both ways: A→B and B→A collecting contour vertices
  const betweenAB = walkForward(idxA, idxB);
  const betweenBA = walkForward(idxB, idxA);

  const poly1AB: Point[] = [pA, pB, ...betweenAB];
  const poly2AB: Point[] = [pB, pA, ...betweenBA];
  const a1AB = polygonArea(poly1AB);
  const a2AB = polygonArea(poly2AB);

  // Swap to try the other orientation
  const poly1BA: Point[] = [pA, pB, ...betweenBA];
  const poly2BA: Point[] = [pB, pA, ...betweenAB];
  const a1BA = polygonArea(poly1BA);
  const a2BA = polygonArea(poly2BA);

  const totalAB = a1AB + a2AB;
  const totalBA = a1BA + a2BA;
  const balAB = totalAB > 0 ? Math.abs(a1AB / totalAB - 0.5) : Infinity;
  const balBA = totalBA > 0 ? Math.abs(a1BA / totalBA - 0.5) : Infinity;

  // Pick the split closer to 50/50 (that's the one the user intended)
  if (balBA < balAB && totalBA > 0) {
    return [a1BA, a2BA];
  }
  return [a1AB, a2AB];
}

/** Build a regular polygon centered at (cx,cy) with radius r and n sides */
function regularPoly(cx: number, cy: number, r: number, n: number, phase = -Math.PI / 2): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** Build a star polygon */
function starShape(cx: number, cy: number, rOuter: number, rInner: number, points: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Build a heart shape */
function heartShape(): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const x = 50 + 16 * Math.sin(a) * Math.sin(a) * Math.sin(a);
    const y = 50 - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    pts.push({ x, y });
  }
  return pts;
}

/** Build an arrow shape */
function arrowShape(): Point[] {
  return [
    {x:50,y:18},{x:82,y:50},{x:50,y:56},{x:50,y:46},{x:18,y:46},{x:18,y:54},{x:50,y:54},{x:50,y:82},
    {x:82,y:50},{x:50,y:18}
  ];
}

/** Build a diamond shape */
function diamondShape(): Point[] {
  return regularPoly(50, 50, 28, 4, -Math.PI / 4);
}

/** Build a crescent shape */
function crescentShape(): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const baseR = 26;
    const wobble = 8 * Math.sin(a * 1.5 + 0.5);
    const r = baseR + wobble;
    pts.push({ x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) * 0.85 });
  }
  return pts;
}

/** Build a cross shape */
function crossShape(): Point[] {
  const w = 8, h = 28, g = 6;
  return [
    {x:50-w-g,y:50-h},{x:50+g,y:50-h},{x:50+g,y:50-w-g},{x:50+h,y:50-w-g},
    {x:50+h,y:50+g},{x:50+g,y:50+g},{x:50+g,y:50+h},{x:50-w-g,y:50+h},
    {x:50-w-g,y:50+g},{x:50-h,y:50+g},{x:50-h,y:50-w-g},{x:50-w-g,y:50-w-g}
  ];
}

/** Build a shield shape */
function shieldShape(): Point[] {
  return [
    {x:50,y:18},{x:72,y:26},{x:72,y:50},{x:50,y:74},{x:28,y:50},{x:28,y:26}
  ];
}

/** Build a drop/teardrop shape */
function dropShape(): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const r = 16 + 12 * Math.sin(a * 0.5 + 0.3);
    pts.push({ x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) });
  }
  return pts;
}

/** Build a lightning bolt shape */
function boltShape(): Point[] {
  return [
    {x:60,y:16},{x:42,y:42},{x:56,y:42},{x:38,y:84},{x:56,y:56},{x:44,y:56}
  ];
}

/** Build an organic/blob shape */
function organicPts(seed: number, r: number): Point[] {
  const pts: Point[] = [];
  const n = 20 + (seed % 8) * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const variation = 0.7 + 0.3 * Math.sin(i * 1.7 + seed) * Math.cos(i * 2.3 + seed * 0.5);
    const rr = r * variation;
    pts.push({ x: 50 + rr * Math.cos(a), y: 50 + rr * Math.sin(a) });
  }
  return pts;
}

/** Convert polygon points to SVG path string */
function ptsToPath(pts: Point[]): string {
  if (pts.length === 0) return '';
  return 'M' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') + ' Z';
}

const COLOR_WHEEL = [
  { fill: '#fde68a', stroke: '#ca8a04' },
  { fill: '#bfdbfe', stroke: '#3b82f6' },
  { fill: '#fecaca', stroke: '#ef4444' },
  { fill: '#bbf7d0', stroke: '#22c55e' },
  { fill: '#e9d5ff', stroke: '#a855f7' },
  { fill: '#fed7aa', stroke: '#ea580c' },
  { fill: '#cbd5e1', stroke: '#64748b' },
  { fill: '#fbcfe8', stroke: '#ec4899' },
  { fill: '#cffafe', stroke: '#06b6d4' },
];

const SHAPE_BUILDERS: (() => SplitShapeDef)[] = [
  () => { const pts = regularPoly(50, 50, 34, 40); const c = COLOR_WHEEL[0]; return { pts, label: 'Circle', path: ptsToPath(pts), ...c }; },
  () => { const pts = starShape(50, 50, 35, 16, 5); const c = COLOR_WHEEL[7]; return { pts, label: 'Star', path: ptsToPath(pts), ...c }; },
  () => { const pts = heartShape(); const c = COLOR_WHEEL[8]; return { pts, label: 'Heart', path: ptsToPath(pts), ...c }; },
  () => { const pts = arrowShape(); const c = COLOR_WHEEL[1]; return { pts, label: 'Arrow', path: ptsToPath(pts), ...c }; },
  () => { const pts = crescentShape(); const c = COLOR_WHEEL[2]; return { pts, label: 'Crescent', path: ptsToPath(pts), ...c }; },
  () => { const pts = crossShape(); const c = COLOR_WHEEL[3]; return { pts, label: 'Cross', path: ptsToPath(pts), ...c }; },
  () => { const pts = shieldShape(); const c = COLOR_WHEEL[4]; return { pts, label: 'Shield', path: ptsToPath(pts), ...c }; },
  () => { const pts = dropShape(); const c = COLOR_WHEEL[5]; return { pts, label: 'Drop', path: ptsToPath(pts), ...c }; },
  () => { const pts = boltShape(); const c = COLOR_WHEEL[6]; return { pts, label: 'Lightning', path: ptsToPath(pts), ...c }; },
  () => { const pts = starShape(50, 50, 30, 14, 7); const c = COLOR_WHEEL[7]; return { pts, label: 'Compass', path: ptsToPath(pts), ...c }; },
  () => { const pts = organicPts(42, 30); const c = COLOR_WHEEL[8]; return { pts, label: 'Amber', path: ptsToPath(pts), ...c }; },
  () => { const pts = organicPts(73, 32); const c = COLOR_WHEEL[0]; return { pts, label: 'Pebble', path: ptsToPath(pts), ...c }; },
  () => { const pts = organicPts(91, 30); const c = COLOR_WHEEL[1]; return { pts, label: 'Coral', path: ptsToPath(pts), ...c }; },
  () => { const pts = organicPts(18, 32); const c = COLOR_WHEEL[2]; return { pts, label: 'Moss', path: ptsToPath(pts), ...c }; },
];

function randomShape(): SplitShapeDef {
  return SHAPE_BUILDERS[Math.floor(Math.random() * SHAPE_BUILDERS.length)]();
}

/** Score from 0-100 based on deviation from 50/50, using non-linear curve */
function computeSplitScore(areaPctA: number, areaPctB: number): number {
  const deviation = Math.abs(50 - areaPctA);
  if (deviation <= 0.1) return 100;
  // Non-linear: small deviations are penalized lightly, large ones heavily
  const raw = 100 * Math.exp(-deviation * deviation / 60);
  return Math.max(0, Math.round(raw));
}

function PerfectSplit({isSignedIn}:{isSignedIn:boolean}){
  const {goToIntermission,isMultiplayerSession,meta:mm}=useMultiplayerRoundFlow('aim-perfect-split');
  const TOTAL_ROUNDS = 4;
  const [phase, setPhase] = useState<'idle' | 'playing' | 'result' | 'finished'>('idle');
  const [roundIdx, setRoundIdx] = useState(0);
  const [shape, setShape] = useState<SplitShapeDef>(randomShape());
  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(4);
  const [dragging, setDragging] = useState<0 | 1 | null>(null);
  const [result, setResult] = useState<{ pctA: number; pctB: number; score: number } | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const hasSavedRef = useRef(false);
  const hasAutoStarted = useRef(false);
  const cd = useDuelCountdown(isMultiplayerSession);

  useEffect(()=>{if(!cd.launched||hasAutoStarted.current)return;hasAutoStarted.current=true;startGame()},[cd.launched]);//eslint-disable-line

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;
  const labScore = avgScore !== null ? avgScore * 10 : null;

  useEffect(() => {
    if (!isSignedIn || phase !== 'finished' || labScore === null || hasSavedRef.current) return;
    hasSavedRef.current = true;
    fetch('/api/scores/submit', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ testSlug:'aim-perfect-split', score: labScore, ...mm }) }).then(r => { if(r.ok && isMultiplayerSession) goToIntermission(); });
  }, [phase, isSignedIn, labScore, isMultiplayerSession, goToIntermission, mm]);

  const posARef = useRef({ idx: 0, frac: 0 });
  const posBRef = useRef({ idx: 4, frac: 0 });

  function getSmoothPos(e: React.PointerEvent<HTMLDivElement>): { idx: number; frac: number } | null {
    const b = boardRef.current; if (!b) return null;
    const r = b.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 100;
    const py = ((e.clientY - r.top) / r.height) * 100;
    return projectOntoContour(shape.pts, px, py);
  }

  function startGame() {
    const s = randomShape();
    setShape(s);
    setPhase('playing');
    setRoundIdx(0);
    setScores([]);
    setResult(null);
    hasSavedRef.current = false;
    // Place point A somewhere random on contour, point B roughly opposite
    const half = Math.floor(s.pts.length / 2);
    const offset = Math.floor(Math.random() * s.pts.length);
    const a = offset % s.pts.length;
    const b = (offset + Math.floor(half * (0.8 + Math.random() * 0.4))) % s.pts.length;
    posARef.current = { idx: a, frac: 0 };
    posBRef.current = { idx: b, frac: 0 };
    setIdxA(a);
    setIdxB(b);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, handle: 0 | 1) {
    if (phase !== 'playing') return;
    setDragging(handle);
    const pos = getSmoothPos(e);
    if (pos !== null) {
      if (handle === 0) { posARef.current = pos; setIdxA(pos.idx); }
      else { posBRef.current = pos; setIdxB(pos.idx); }
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragging === null || phase !== 'playing') return;
    const pos = getSmoothPos(e);
    if (pos !== null) {
      if (dragging === 0) { posARef.current = pos; setIdxA(pos.idx); }
      else { posBRef.current = pos; setIdxB(pos.idx); }
    }
  }

  function handlePointerUp() {
    setDragging(null);
  }

  function computeEdgePos(shape: Point[], state: { idx: number; frac: number }): Point {
    return edgePoint(shape, state.idx, state.frac);
  }

  function submitSplit() {
    if (phase !== 'playing') return;
    const pa = posARef.current;
    const pb = posBRef.current;
    if (pa.idx === pb.idx) return;
    const [a1, a2] = splitAreasSmooth(shape.pts, pa.idx, pa.frac, pb.idx, pb.frac);
    const total = a1 + a2;
    if (total === 0) return;
    const pctA = Math.round((a1 / total) * 100);
    const pctB = 100 - pctA;
    const score = computeSplitScore(pctA, pctB);
    setResult({ pctA, pctB, score });
    setScores(prev => [...prev, score]);
    setPhase('result');
  }

  function advanceRound() {
    const nr = roundIdx + 1;
    if (nr >= TOTAL_ROUNDS) {
      setPhase('finished');
      return;
    }
    const s = randomShape();
    setShape(s);
    setRoundIdx(nr);
    setResult(null);
    setPhase('playing');
    const half = Math.floor(s.pts.length / 2);
    const offset = Math.floor(Math.random() * s.pts.length);
    const a = offset % s.pts.length;
    const b = (offset + Math.floor(half * (0.8 + Math.random() * 0.4))) % s.pts.length;
    posARef.current = { idx: a, frac: 0 };
    posBRef.current = { idx: b, frac: 0 };
    setIdxA(a);
    setIdxB(b);
  }

  const pa = edgePoint(shape.pts, posARef.current.idx, posARef.current.frac);
  const pb = edgePoint(shape.pts, posBRef.current.idx, posBRef.current.frac);

  function colorClass(score: number): string {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-rose-600';
  }

  return <AimShell title="Perfect Split" kicker="Geometric precision" description="Drag two dots along the shape's edge to split it as evenly as possible." accent="border-amber-200 bg-amber-50 text-amber-900"
    isSignedIn={isSignedIn}
    stats={[
      { label: 'Round', value: phase === 'idle' ? '--' : `${Math.min(roundIdx + 1, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`, detail: 'Four shapes per run.' },
      { label: 'Shape', value: phase === 'idle' ? '--' : shape.label, detail: 'Random shape each round.' },
      { label: 'Avg Score', value: avgScore === null ? '--' : `${avgScore}%`, detail: 'Average split accuracy.' },
      { label: 'Lab Score', value: labScore === null ? '--' : String(labScore), detail: 'Scaled to 1000-point range.' },
    ]}>
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="rounded-full border-2 border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
          {phase === 'idle' ? 'Press start' : phase === 'playing' ? `Split the ${shape.label}` : phase === 'result' ? `Round ${roundIdx + 1} result` : 'Run complete'}
        </div>
      </div>
      <div className="relative">
        <div ref={boardRef} className="relative mx-auto aspect-square w-full max-w-[38rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-4 pb-40 sm:pb-80 touch-none select-none">
          {cd.active && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-[2rem]"><div className="text-center">{cd.phase==='go'?<p className="text-7xl font-black text-emerald-600">GO</p>:<p className="text-8xl font-black text-slate-800">{cd.value}</p>}</div></div>}

          {(phase === 'playing' || phase === 'result' || phase === 'finished') && (
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
              {/* Shape outline */}
              <path d={shape.path} fill={shape.fill} fillOpacity="0.72" stroke={shape.stroke} strokeWidth="2.4"/>

              {phase === 'result' && result && (
                <>
                  {/* Show split with colored fill */}
                  {(() => {
                    const a = idxA; const b = idxB;
                    const n = shape.pts.length;
                    const half1: Point[] = [shape.pts[a], shape.pts[b]];
                    const half2: Point[] = [shape.pts[b], shape.pts[a]];
                    for (let i = a; i !== b; i = (i + 1) % n) half2.push(shape.pts[i]);
                    for (let i = b; i !== a; i = (i + 1) % n) half1.push(shape.pts[i]);
                    const good = result.score >= 85;
                    return (
                      <>
                        {half1.length >= 3 && <path d={ptsToPath(half1)} fill={good ? '#bbf7d0' : '#fde68a'} fillOpacity="0.72" stroke={good ? '#22c55e' : '#ca8a04'} strokeWidth="1.5"/>}
                        {half2.length >= 3 && <path d={ptsToPath(half2)} fill={good ? '#bbf7d0' : '#fecaca'} fillOpacity="0.72" stroke={good ? '#22c55e' : '#ef4444'} strokeWidth="1.5"/>}
                      </>
                    );
                  })()}
                </>
              )}

              {/* Split line */}
              {(phase === 'playing' || phase === 'result') && (
                <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#0f172a" strokeDasharray={phase === 'result' ? 'none' : '4 4'} strokeWidth="2"/>
              )}

              {/* Draggable dots (only in playing) */}
              {phase === 'playing' && (
                <>
                  <circle cx={pa.x} cy={pa.y} r="5.5" fill="#3b82f6" stroke="#fff" strokeWidth="2.5" style={{cursor: 'grab'}}/>
                  <circle cx={pb.x} cy={pb.y} r="5.5" fill="#ef4444" stroke="#fff" strokeWidth="2.5" style={{cursor: 'grab'}}/>
                </>
              )}
            </svg>
          )}

          {/* Invisible pointer hit zones for dragging */}
          {phase === 'playing' && (
            <div className="absolute inset-0" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
              <div className="absolute"
                style={{ left: `${pa.x}%`, top: `${pa.y}%`, width: '48px', height: '48px', transform: 'translate(-24px,-24px)', zIndex: 10 }}
                onPointerDown={e => handlePointerDown(e, 0)}/>
              <div className="absolute"
                style={{ left: `${pb.x}%`, top: `${pb.y}%`, width: '48px', height: '48px', transform: 'translate(-24px,-24px)', zIndex: 10 }}
                onPointerDown={e => handlePointerDown(e, 1)}/>
            </div>
          )}

          {/* Result overlay */}
          {phase === 'result' && result && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg w-64">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{shape.label}</p>
                <p className={`mt-1 text-4xl font-black tracking-tight ${colorClass(result.score)}`}>{result.score}%</p>
                <p className="mt-1 text-sm text-slate-500">
                  {result.pctA}% / {result.pctB}%
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Deviation: {Math.abs(50 - result.pctA).toFixed(1)}%
                </p>
                <button className="lab-button mt-4" onClick={advanceRound} type="button">
                  {roundIdx + 1 >= TOTAL_ROUNDS ? 'See Final Score' : 'Next Shape'}
                </button>
              </div>
            </div>
          )}

          {/* Finished overlay */}
          {phase === 'finished' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Run complete</p>
                <p className="mt-3 text-4xl font-black text-slate-800">{labScore ?? '--'}</p>
                <p className="mt-1 text-sm text-slate-500">Avg: {avgScore}%</p>
                <button className="lab-button mt-4" onClick={startGame} type="button">Start New Run</button>
              </div>
            </div>
          )}

          {/* Idle overlay */}
          {phase === 'idle' && !isMultiplayerSession && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border-2 border-slate-200 bg-white px-6 py-5 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Perfect Split</p>
                <p className="mt-2 text-sm font-semibold text-slate-600">Split four shapes as evenly as possible by dragging the dots.</p>
                <button className="lab-button mt-4" onClick={startGame} type="button">Start Split Test</button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        {phase === 'playing' && (
          <div className="mt-4 flex justify-center">
            <button className="lab-button" onClick={submitSplit} type="button">Done</button>
          </div>
        )}
      </div>
    </div>
  </AimShell>
}

export function AimProtocols({mode,isSignedIn}:{mode:string;isSignedIn:boolean}){
  if(mode==='moving')return <MovingTargets isSignedIn={isSignedIn}/>
  if(mode==='split')return <PerfectSplit isSignedIn={isSignedIn}/>
  return <AimTrainer isSignedIn={isSignedIn}/>
}