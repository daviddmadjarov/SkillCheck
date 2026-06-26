const fs = require('fs');

// ── 1. AimShell ──
let aim = fs.readFileSync('src/app/category/aim/aim-protocols.tsx', 'utf8');
aim = aim.replace(
  '<section className="lab-card p-4 sm:p-6"><div className="mb-3 flex flex-wrap',
  '<section className="lab-card flex flex-col min-h-dvh p-4 sm:p-6"><div className="mb-3 flex flex-wrap'
);
aim = aim.replace(
  '{children}<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">',
  '<div className="flex-1 flex flex-col justify-center">{children}</div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">'
);
aim = aim.replace(
  '<div className="relative min-h-[16rem] cursor-pointer overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4 sm:min-h-[18rem]">',
  '<div className="relative cursor-pointer overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-4">'
);
aim = aim.replace(
  '<div className="relative min-h-[16rem] cursor-pointer overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4 sm:min-h-[18rem]">',
  '<div className="relative cursor-pointer overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-4">'
);
fs.writeFileSync('src/app/category/aim/aim-protocols.tsx', aim, 'utf8');
console.log('Done: aim-protocols.tsx');

// ── 2. MouseShell ──
let mouse = fs.readFileSync('src/app/category/mouse/mouse-protocols.tsx', 'utf8');
mouse = mouse.replace(
  '<section className="lab-card p-4 sm:p-6"><div className="mb-3 flex flex-wrap',
  '<section className="lab-card flex flex-col min-h-dvh p-4 sm:p-6"><div className="mb-3 flex flex-wrap'
);
mouse = mouse.replace(
  '{children}<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">',
  '<div className="flex-1 flex flex-col justify-center">{children}</div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">'
);
mouse = mouse.replace(
  '<div className="relative min-h-[16rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 sm:min-h-[18rem]">',
  '<div className="relative overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50">'
);
mouse = mouse.replace(
  '<div ref={arenaRef} className="relative min-h-[16rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-4 sm:min-h-[18rem] touch-none select-none"',
  '<div ref={arenaRef} className="relative overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-4 touch-none select-none"'
);
fs.writeFileSync('src/app/category/mouse/mouse-protocols.tsx', mouse, 'utf8');
console.log('Done: mouse-protocols.tsx');

// ── 3. RhythmShell ──
let rhythm = fs.readFileSync('src/app/category/rhythm/rhythm-protocols.tsx', 'utf8');
rhythm = rhythm.replace(
  '<section className="lab-card p-4 sm:p-5">',
  '<section className="lab-card flex flex-col min-h-dvh p-4 sm:p-5">'
);
rhythm = rhythm.replace(
  '{children}<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">',
  '<div className="flex-1 flex flex-col justify-center">{children}</div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">'
);
rhythm = rhythm.replace(
  '<div className="relative min-h-[16rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-4 sm:min-h-[20rem]">',
  '<div className="relative overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-violet-50 via-white to-slate-50 p-4">'
);
rhythm = rhythm.replace(
  '<div className="relative min-h-[16rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-fuchsia-50 via-white to-slate-50 p-4 sm:min-h-[18rem]">',
  '<div className="relative overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-fuchsia-50 via-white to-slate-50 p-4">'
);
// OverclockGame section - this is the second <section> opening in the file
rhythm = rhythm.replace(
  '<section className="lab-card flex flex-col min-h-dvh p-4 sm:p-5">',
  '<section className="lab-card flex flex-col min-h-dvh p-4 sm:p-5">'
);
// OverclockGame - wrap game area in flex-1
rhythm = rhythm.replace(
  '<div className="space-y-4"><div className="relative">',
  '<div className="flex-1 flex flex-col justify-center"><div className="space-y-4"><div className="relative">'
);
// Close the flex-1 div for OverclockGame before its stats grid
rhythm = rhythm.replace(
  '</div></div>',
  '</div></div></div>'
);
fs.writeFileSync('src/app/category/rhythm/rhythm-protocols.tsx', rhythm, 'utf8');
console.log('Done: rhythm-protocols.tsx');

// ── 4. CognitiveShell ──
let cog = fs.readFileSync('src/app/category/thinking/cognitive-protocols.tsx', 'utf8');
cog = cog.replace(
  '<section className="lab-card p-4 sm:p-5">',
  '<section className="lab-card flex flex-col min-h-dvh p-4 sm:p-5">'
);
cog = cog.replace(
  '{children}<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">',
  '<div className="flex-1 flex flex-col justify-center">{children}</div><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">'
);
cog = cog.replace(
  '<div className="relative min-h-[18rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-5 sm:min-h-[22rem]">',
  '<div className="relative overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-slate-50 p-5">'
);
cog = cog.replace(
  '<div className="relative min-h-[16rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-5 sm:min-h-[20rem]">',
  '<div className="relative overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-5">'
);
cog = cog.replace(
  '<div className="relative min-h-[16rem] overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-5 sm:min-h-[20rem]">',
  '<div className="relative overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-5">'
);
fs.writeFileSync('src/app/category/thinking/cognitive-protocols.tsx', cog, 'utf8');
console.log('Done: cognitive-protocols.tsx');

// ── 5. Reaction Protocol ──
let react = fs.readFileSync('src/app/category/reaction/reaction-protocol.tsx', 'utf8');
react = react.replace(
  '<section className="lab-card p-4 sm:p-6">',
  '<section className="lab-card flex flex-col min-h-dvh p-4 sm:p-6">'
);
react = react.replace(
  '<div className="relative">',
  '<div className="flex-1 flex flex-col justify-center"><div className="relative">'
);
react = react.replace(
  '<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">',
  '</div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">'
);
fs.writeFileSync('src/app/category/reaction/reaction-protocol.tsx', react, 'utf8');
console.log('Done: reaction.tsx');

// ── 6. Audio Reaction ──
let audio = fs.readFileSync('src/app/category/reaction/audio-reaction-protocol.tsx', 'utf8');
audio = audio.replace(
  '<section className="lab-card p-4 sm:p-6">',
  '<section className="lab-card flex flex-col min-h-dvh p-4 sm:p-6">'
);
audio = audio.replace(
  '<div className="relative">',
  '<div className="flex-1 flex flex-col justify-center"><div className="relative">'
);
audio = audio.replace(
  '<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">',
  '</div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">'
);
fs.writeFileSync('src/app/category/reaction/audio-reaction-protocol.tsx', audio, 'utf8');
console.log('Done: audio-reaction.tsx');

// ── 7. Multi Reaction ──
let multi = fs.readFileSync('src/app/category/reaction/multi-reaction-protocol.tsx', 'utf8');
multi = multi.replace(
  '<section className="lab-card p-4 sm:p-6">',
  '<section className="lab-card flex flex-col min-h-dvh p-4 sm:p-6">'
);
multi = multi.replace(
  '<div className="relative">',
  '<div className="flex-1 flex flex-col justify-center"><div className="relative">'
);
multi = multi.replace(
  '<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">',
  '</div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">'
);
fs.writeFileSync('src/app/category/reaction/multi-reaction-protocol.tsx', multi, 'utf8');
console.log('Done: multi-reaction.tsx');

console.log('\nALL DONE');