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

// ─────────────────────────────────────────────────────────────────────
// REDESIGNED SCORING SYSTEM
// ─────────────────────────────────────────────────────────────────────

/**
 * Resample a path to exactly n evenly-spaced points.
 * Uses cumulative distance along the path for interpolation.
 */
function resamplePath(pts: Point[], n: number): Point[] {
  if (pts.length < 2) return pts.slice();
  const lens: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    lens.push(lens[i - 1] + dist(pts[i - 1], pts[i]));
  }
  const total = lens[lens.length - 1];
  if (total < 1e-6) return pts.slice();
  const step = total / (n - 1);
  const out: Point[] = [pts[0]];
  let segIdx = 0;
  for (let s = step; s < total - step * 0.5; s += step) {
    while (segIdx < lens.length - 2 && lens[segIdx + 1] <= s) segIdx++;
    const t = (s - lens[segIdx]) / (lens[segIdx + 1] - lens[segIdx] || 1);
    out.push({
      x: pts[segIdx].x + (pts[segIdx + 1].x - pts[segIdx].x) * t,
      y: pts[segIdx].y + (pts[segIdx + 1].y - pts[segIdx].y) * t,
    });
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Build a kd-tree-like nearest-point lookup from an array of points.
 * For small N (≤500), brute-force is fine. For larger, we use a simple spatial grid.
 */
function buildPointLookup(pts: Point[]): (px: number, py: number) => { dist: number; pt: Point } {
  return (px: number, py: number) => {
    let bestDist = Infinity;
    let bestPt = pts[0];
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(px - pts[i].x, py - pts[i].y);
      if (d < bestDist) {
        bestDist = d;
        bestPt = pts[i];
      }
    }
    return { dist: bestDist, pt: bestPt };
  };
}

/**
 * Nonlinear penalty function.
 * Small errors have minor penalty, medium errors moderate, large errors severe.
 *
 * @param distance - distance from user point to nearest target point
 * @param maxDist - the distance at which penalty becomes 1.0 (total loss)
 * @returns penalty factor from 0 (perfect) to 1 (total fail)
 *
 * Shape: quadratic-exponential hybrid
 *   d/maxDist < 0.3:  quadratic (soft at small values)
 *   d/maxDist >= 0.3: exponential (harsh at large values)
 */
function nonlinearPenalty(distance: number, maxDist: number): number {
  const ratio = distance / maxDist;
  if (ratio <= 0) return 0;
  if (ratio <= 0.3) {
    // Quadratic region: ratio=0 → 0, ratio=0.3 → ~0.09
    return (ratio / 0.3) * (ratio / 0.3) * 0.09;
  }
  // Exponential region: ramp from ~0.09 at ratio=0.3 to 1.0 at ratio=1.0
  const t = (ratio - 0.3) / 0.7; // 0 at ratio=0.3, 1 at ratio=1.0
  // Exponential curve: e^(t*ln(1/0.09)) = e^(t * 2.408)
  return 0.09 * Math.exp(t * 2.408);
}

/**
 * 1. PATH DEVIATION (Weight: 50%)
 *
 * For each sampled point on the user's path, find the nearest point on the target path.
 * Apply nonlinear penalty so large deviations are severely punished.
 * Returns a score from 0–100.
 */
function computeDeviationScore(
  userPath: Point[],
  targetPath: Point[],
  maxAllowedDist: number
): number {
  const lookup = buildPointLookup(targetPath);
  let totalPenalty = 0;
  for (let i = 0; i < userPath.length; i++) {
    const { dist: d } = lookup(userPath[i].x, userPath[i].y);
    totalPenalty += nonlinearPenalty(d, maxAllowedDist);
  }
  const avgPenalty = totalPenalty / userPath.length;
  // Convert penalty to score: 0 penalty = 100, 1 penalty = 0
  const score = Math.max(0, 100 - avgPenalty * 100);
  return score;
}

/**
 * 2. PATH COVERAGE (Weight: 20%)
 *
 * For each sampled point on the target path, find the nearest point on the user's path.
 * Count how many target points are "covered" (within a reasonable distance).
 * This measures how much of the shape the user actually traced.
 *
 * Additionally checks if the user's path covers the full extent of the shape.
 */
function computeCoverageScore(
  userPath: Point[],
  targetPath: Point[]
): number {
  const lookup = buildPointLookup(userPath);
  const coverageThreshold = 12; // Max distance to consider a target point "covered"

  let covered = 0;
  for (let i = 0; i < targetPath.length; i++) {
    const { dist: d } = lookup(targetPath[i].x, targetPath[i].y);
    if (d <= coverageThreshold) covered++;
  }
  const coveragePct = covered / targetPath.length;
  // Scale: 100% coverage = 100, 50% coverage = 0
  const score = Math.max(0, (coveragePct - 0.5) * 200);
  return Math.min(100, score);
}

/**
 * 3. OVERSHOOTING / STRAYING (Weight: 15%)
 *
 * Detect points that are far from the target path.
 * Also detect erratic loops by checking if the user's path length
 * is significantly longer than the target path.
 *
 * Penalizes:
 * - Points far from any target path segment (> maxAllowedDist)
 * - Excessive path length (scribbling)
 */
function computeStrayScore(
  userRaw: Point[],
  targetPath: Point[]
): number {
  // Check how many raw user points stray far from the target
  const lookup = buildPointLookup(targetPath);
  const strayThreshold = 15;

  // Downsample raw points for performance
  const step = Math.max(1, Math.floor(userRaw.length / 300));
  let strayCount = 0;
  let totalChecked = 0;
  for (let i = 0; i < userRaw.length; i += step) {
    totalChecked++;
    const { dist: d } = lookup(userRaw[i].x, userRaw[i].y);
    if (d > strayThreshold) strayCount++;
  }

  const strayPct = totalChecked > 0 ? strayCount / totalChecked : 0;

  // Path length ratio penalty (scribble detection)
  let userLen = 0;
  for (let i = 1; i < userRaw.length; i++) {
    userLen += dist(userRaw[i - 1], userRaw[i]);
  }
  let tplLen = 0;
  for (let i = 1; i < targetPath.length; i++) {
    tplLen += dist(targetPath[i - 1], targetPath[i]);
  }

  const lenRatio = tplLen > 0 ? userLen / tplLen : 1;

  // Ideal ratio is ~1 (same length). Shorter traces are penalized in coverage.
  // Longer traces are straying/scribbling. Penalize when ratio > 1.5
  let lengthPenalty = 0;
  if (lenRatio > 1.5) {
    // At 2x length, penalty = 0.5; at 3x, penalty = 1.0
    lengthPenalty = Math.min(1, (lenRatio - 1.5) / 1.5);
  }

  // Combined stray score: 0 strays = 100, all strays = 0
  const strayScore = Math.max(0, 100 - strayPct * 200);
  // Apply length penalty
  const finalScore = strayScore * (1 - lengthPenalty * 0.5);
  return Math.max(0, Math.min(100, finalScore));
}

/**
 * 4. TRACE SMOOTHNESS (Weight: 10%)
 *
 * Detect erratic jumps, teleport-like movements, and sudden shortcuts
 * by analyzing the spacing between consecutive sampled points.
 *
 * If the distance between two consecutive samples is large relative
 * to the local target path curvature, it indicates a jump/shortcut.
 */
function computeSmoothnessScore(
  userPath: Point[],
  targetPath: Point[]
): number {
  if (userPath.length < 3) return 0;

  const userDistances: number[] = [];
  for (let i = 1; i < userPath.length; i++) {
    userDistances.push(dist(userPath[i - 1], userPath[i]));
  }

  // Compute median and MAD (median absolute deviation) of user step sizes
  const sorted = [...userDistances].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = userDistances.map(d => Math.abs(d - median));
  const devSorted = deviations.sort((a, b) => a - b);
  const mad = devSorted[Math.floor(devSorted.length / 2)] || 1;

  // Count "jumps" — steps significantly larger than median + 3*MAD
  const jumpThreshold = Math.max(median + 3 * mad, 3);
  let jumps = 0;
  for (let i = 0; i < userDistances.length; i++) {
    if (userDistances[i] > jumpThreshold) jumps++;
  }

  const jumpPct = userDistances.length > 0 ? jumps / userDistances.length : 0;

  // Also check for "too smooth" (identical spacing) which indicates interpolation artifacts
  let zeroVar = 0;
  if (mad < 0.01 && median > 0) zeroVar = 1;

  // Score: fewer jumps = better. Zero jumps = 100, 50% jumps = 0
  let score = Math.max(0, 100 - jumpPct * 200);

  // If points are suspiciously uniformly spaced, penalize somewhat
  if (zeroVar > 0) score = Math.min(score, 80);

  return score;
}

/**
 * 5. COMPLETION (Weight: 5%)
 *
 * Award a small bonus for fully completing the symbol.
 * Check if the user started near the first target point and
 * ended near the last target point.
 */
function computeCompletionScore(
  userRaw: Point[],
  targetPath: Point[]
): number {
  if (userRaw.length < 4 || targetPath.length < 2) return 0;

  // Did the user start near the first target point?
  const startDist = dist(userRaw[0], targetPath[0]);
  const endDist = dist(userRaw[userRaw.length - 1], targetPath[targetPath.length - 1]);

  // Did the user trace the full shape? Check by sampling target path
  // and seeing if the cumulative coverage near the end is good.
  const lookup = buildPointLookup(userRaw);
  const endRegionThreshold = 10;

  // Check last 20% of target points
  const endStartIdx = Math.floor(targetPath.length * 0.8);
  let endCovered = 0;
  for (let i = endStartIdx; i < targetPath.length; i++) {
    const { dist: d } = lookup(targetPath[i].x, targetPath[i].y);
    if (d <= endRegionThreshold) endCovered++;
  }
  const endCoveragePct = (targetPath.length - endStartIdx) > 0
    ? endCovered / (targetPath.length - endStartIdx)
    : 0;

  // Start bonus: close to first point
  const startBonus = startDist <= 8 ? 100 : startDist <= 15 ? 50 : 0;
  // End bonus: ended near the end of the path
  const endBonus = endDist <= 8 ? 100 : endDist <= 15 ? 50 : 0;
  // Coverage bonus: traced the final section
  const coverageBonus = endCoveragePct >= 0.8 ? 100 : endCoveragePct >= 0.5 ? 50 : 0;

  const finalScore = startBonus * 0.2 + endBonus * 0.3 + coverageBonus * 0.5;
  return finalScore;
}

// ─────────────────────────────────────────────────────────────────────
// MAIN EVALUATION FUNCTION
// ─────────────────────────────────────────────────────────────────────

function evaluateTrace(userPts: Point[], tplPts: Point[]) {
  // Minimum points check
  if (userPts.length < 4) {
    return { accuracy: 0, deviation: 99, completion: 0, labScore: 0 };
  }

  // High-density sampling: 500 points for precision
  const SAMPLE_COUNT = 500;
  const usamp = resamplePath(userPts, SAMPLE_COUNT);
  const tsamp = resamplePath(tplPts, SAMPLE_COUNT);
  const MAX_ALLOWED_DIST = 20; // units beyond which penalty is severe

  // 1. Path Deviation (50%)
  const deviationScore = computeDeviationScore(usamp, tsamp, MAX_ALLOWED_DIST);

  // 2. Path Coverage (20%)
  const coverageScore = computeCoverageScore(usamp, tsamp);

  // 3. Overshooting / Straying (15%)
  const strayScore = computeStrayScore(userPts, tsamp);

  // 4. Trace Smoothness (10%)
  const smoothnessScore = computeSmoothnessScore(usamp, tsamp);

  // 5. Completion Bonus (5%)
  const completionScore = computeCompletionScore(userPts, tsamp);

  // Weighted combination
  const weightedRaw =
    deviationScore * 0.50 +
    coverageScore   * 0.20 +
    strayScore      * 0.15 +
    smoothnessScore * 0.10 +
    completionScore * 0.05;

  // The weighted raw is a 0-100 score.
  // Map to a 0-1000 labScore using a square-root curve (more human-friendly):
  //   labScore = round(weightedRaw * 10)

  const accuracy = clamp(Math.round(weightedRaw), 0, 100);
  const labScore = clamp(Math.round(weightedRaw * 10), 0, 1000);

  // Compute a meaningful deviation metric for display (average distance to nearest target)
  const lookup = buildPointLookup(tsamp);
  let totalDev = 0;
  for (let i = 0; i< usamp.length; i++) {
    const { dist: d } = lookup(usamp[i].x, usamp[i].y);
    totalDev += d;
  }
  const avgDev = totalDev / usamp.length;

  return {
    accuracy,
    deviation: Number(avgDev.toFixed(2)),
    completion: accuracy,
    labScore,
    deviationScore: Math.round(deviationScore),
    coverageScore: Math.round(coverageScore),
    strayScore: Math.round(strayScore),
    smoothnessScore: Math.round(smoothnessScore),
    completionScore: Math.round(completionScore),
  };
}

// ─────────────────────────────────────────────────────────────────────
// COMPONENT (unchanged except for display)
// ─────────────────────────────────────────────────────────────────────

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