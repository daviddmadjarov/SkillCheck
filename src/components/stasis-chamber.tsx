'use client';
import React, { useEffect, useState } from 'react';

export default function StasisChamber() {
  // Generate random bubble offsets for organic loop
  const [bubbles, setBubbles] = useState<{ id: number; left: string; size: string; delay: string; duration: string }[]>([]);

  useEffect(() => {
    const bubbleArray = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 80 + 10}%`, // Keep away from strict edges
      size: `${Math.random() * 8 + 6}px`,  // 6px to 14px bubbles
      delay: `${Math.random() * 4}s`,
      duration: `${Math.random() * 3 + 3}s` // 3s to 6s travel time
    }));
    setBubbles(bubbleArray);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* 1. TOP CAP (The Metal Valve Hatch) */}
      <div className="w-20 h-3 bg-slate-700 border-2 border-slate-950 rounded-t-md shadow-md relative z-10">
        <div className="absolute inset-x-1.5 top-0.5 h-0.5 bg-slate-500 rounded-full opacity-50" /> {/* Highlight line */}
      </div>

      {/* 2. MAIN CYLINDER GLASS TANK */}
      <div className="w-32 h-44 bg-gradient-to-b from-blue-600 via-cyan-500 to-blue-700 border-x-4 border-t-2 border-b-2 border-slate-950 rounded-b-sm relative overflow-hidden shadow-[0_0_16px_rgba(6,182,212,0.4)]">
        
        {/* Cartoon Glass Overlay (The Shiny Reflection Slit) */}
        <div className="absolute top-0 left-2 w-2 h-full bg-white/20 transform -skew-x-12 z-20 pointer-events-none" />
        <div className="absolute top-0 left-6 w-0.5 h-full bg-white/10 transform -skew-x-12 z-20 pointer-events-none" />

        {/* Shadow Inner Edges for Cylindrical Depth */}
        <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/40 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/40 to-transparent z-10 pointer-events-none" />

        {/* 3. BUBBLE ENGINE */}
        <div className="absolute inset-0 z-0">
          {bubbles.map((bubble) => (
            <div
              key={bubble.id}
              className="absolute bottom-0 bg-cyan-200/40 border border-white/50 rounded-full animate-float-up"
              style={{
                left: bubble.left,
                width: bubble.size,
                height: bubble.size,
                animationDelay: bubble.delay,
                animationDuration: bubble.duration,
              }}
            />
          ))}
        </div>

        {/* 4. THE UNCONSCIOUS SPECIMEN (Silhouette Shape) */}
        <div className="absolute inset-0 flex items-center justify-center z-10 mix-blend-multiply opacity-80 animate-pulse [animation-duration:4s]">
          <div className="w-12 h-28 bg-slate-950 rounded-full relative flex flex-col items-center justify-start pt-4">
            {/* Head */}
            <div className="w-6 h-6 bg-slate-950 rounded-full" />
            {/* Breathing Mask Glow */}
            <div className="w-3 h-2 bg-cyan-400 border border-cyan-200 rounded-sm absolute top-7 shadow-[0_0_6px_#22d3ee] animate-pulse" />
            {/* Hanging Wires/Tubes from Subject */}
            <div className="absolute bottom-[-12px] w-0.5 h-8 bg-slate-900 left-5 border-r border-black/50" />
            <div className="absolute bottom-[-6px] w-0.5 h-6 bg-slate-900 right-5 border-l border-black/50" />
          </div>
        </div>
      </div>

      {/* 5. WIRES INTERFACE (Connecting Tank to Computer Base) */}
      <div className="w-28 h-4 relative overflow-visible z-10 flex justify-around px-2 pointer-events-none">
        {/* Curving SVG Cables */}
        <svg className="w-full h-full absolute top-[-2px] left-0 stroke-slate-950 fill-none stroke-[2px]" viewBox="0 0 100 16">
          <path d="M 20,0 C 15,8 25,12 25,16" />
          <path d="M 50,0 C 53,6 47,10 50,16" />
          <path d="M 80,0 C 85,8 75,12 75,16" />
        </svg>
        {/* Bright blue lore wire */}
        <svg className="w-full h-full absolute top-[-2px] left-0 stroke-cyan-400 fill-none stroke-[1.5px] shadow-sm animate-pulse" viewBox="0 0 100 16">
          <path d="M 50,0 C 53,6 47,10 50,16" />
        </svg>
      </div>

      {/* 6. BASE CONTAINER COMPUTER */}
      <div className="w-36 h-14 bg-slate-800 border-2 border-slate-950 rounded-lg flex flex-col justify-between p-2 relative shadow-xl z-10">
        {/* Metallic Bevel highlight */}
        <div className="absolute inset-x-1 top-0.5 h-0.5 bg-slate-500 rounded-full opacity-40" />

        <div className="flex w-full h-8 gap-2 items-center">
          {/* Integrated CRT Screen */}
          <div className="w-16 h-full bg-slate-950 border border-slate-700 rounded p-1 flex items-center justify-center font-mono text-[6px] text-green-400 overflow-hidden relative shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-green-500/10 pointer-events-none" />
            <span className="animate-pulse">SYS_STABLE: 94.2%</span>
          </div>

          {/* Dials & Buttons */}
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex gap-0.5 justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 border border-slate-950 shadow-inner animate-ping [animation-duration:2s]" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-slate-950" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950" />
            </div>
            {/* Grill Vents */}
            <div className="h-1.5 bg-slate-900 border border-slate-950 rounded flex flex-col justify-between p-px">
              <div className="h-px bg-slate-700" />
              <div className="h-px bg-slate-700" />
              <div className="h-px bg-slate-700" />
            </div>
          </div>
        </div>

        {/* Bottom Status Panel Badge */}
        <div className="w-full h-3 border border-slate-950 bg-slate-900 rounded flex items-center justify-between px-1.5 font-mono text-[6px] text-slate-400">
          <span>DEVC_ID: SPEC_042</span>
          <span className="text-cyan-400 animate-pulse">● ONLINE</span>
        </div>
      </div>
    </div>
  );
}