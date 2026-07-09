"use client";

type GameInfoPanelProps = {
  title: string;
  description: string;
  skillDescription: string;
  howScoringWorks: string;
  tips: string[];
  whyUseful: string;
};

export function GameInfoPanel({
  title,
  description,
  skillDescription,
  howScoringWorks,
  tips,
  whyUseful,
}: GameInfoPanelProps) {
  return (
    <section className="lab-card p-5 sm:p-6 lg:p-7">
      {/* What this test is */}
      <div className="mb-6">
        <p className="status-pill w-fit mb-3">About This Protocol</p>
        <h2 className="text-2xl font-black tracking-tight text-slate-800 mb-3">{title}</h2>
        <p className="text-sm font-medium leading-6 text-slate-600">{description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
            What It Tests
          </p>
          <p className="text-sm font-medium leading-6 text-slate-600">{skillDescription}</p>
        </div>

        <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
            How Scoring Works
          </p>
          <p className="text-sm font-medium leading-6 text-slate-600">{howScoringWorks}</p>
        </div>

        <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
            Tips for Improvement
          </p>
          <ul className="space-y-2">
            {tips.map((tip, index) => (
              <li key={index} className="flex gap-2 text-sm font-medium leading-6 text-slate-600">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-black text-cyan-700">
                  {index + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
            Why It Matters
          </p>
          <p className="text-sm font-medium leading-6 text-slate-600">{whyUseful}</p>
        </div>
      </div>
    </section>
  );
}