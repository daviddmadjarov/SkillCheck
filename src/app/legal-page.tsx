import Link from 'next/link';

const returnToLabClassName =
  'rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]';

export type LegalSection = {
  title: string;
  body: string[];
};

type LegalPageProps = {
  title: string;
  kicker: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export function LegalPage({ title, kicker, intro, lastUpdated, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex justify-end">
          <Link className={returnToLabClassName} href="/">
            Return to Lab
          </Link>
        </div>

        <section className="lab-card overflow-hidden p-6 sm:p-8">
          <div className="max-w-3xl space-y-4">
            <p className="status-pill w-fit">{kicker}</p>
            <h1 className="text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
              {title}
            </h1>
            <p className="text-base font-medium leading-7 text-slate-600 sm:text-lg">
              {intro}
            </p>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
              Last updated: {lastUpdated}
            </p>
          </div>

          <div className="mt-8 space-y-5">
            {sections.map((section) => (
              <section className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5" key={section.title}>
                <h2 className="text-lg font-black tracking-tight text-slate-800">
                  {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-sm font-medium leading-6 text-slate-600">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}