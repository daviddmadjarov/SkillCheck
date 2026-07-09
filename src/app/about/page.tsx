import Link from 'next/link';

export const metadata = {
  title: 'About SkillCheck | Human Performance Laboratory',
  description:
    'SkillCheck is a free platform for measuring and improving your reaction time, aim, typing speed, mouse control, rhythm, and cognitive abilities.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen px-4 py-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex justify-end">
          <Link
            data-return-to-lab
            className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
            href="/"
          >
            Return to Lab
          </Link>
        </div>

        <section className="lab-card overflow-hidden p-6 sm:p-8">
          <div className="max-w-3xl space-y-4">
            <p className="status-pill w-fit">About the Lab</p>
            <h1 className="text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
              What Is SkillCheck?
            </h1>
            <p className="text-base font-medium leading-7 text-slate-600 sm:text-lg">
              SkillCheck is a free, browser-based platform for measuring, tracking, and improving
              your physical and cognitive performance. Think of it as a personal laboratory where
              you can run controlled experiments on your own abilities — reaction speed, aiming
              precision, typing fluency, mouse control, rhythm timing, and spatial memory.
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <section className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-black tracking-tight text-slate-800">Why We Built It</h2>
              <div className="mt-3 space-y-3 text-sm font-medium leading-6 text-slate-600">
                <p>
                  Sites like Human Benchmark have shown that people love quantifying their
                  abilities and competing against their own personal bests. But we noticed most
                  platforms stop at a single test per category — you get a number, and that is
                  it. We wanted to build something more complete: a suite of scientifically
                  grounded tests that give you deeper insight into how you perform, with
                  persistent score tracking, global leaderboards, and even multiplayer duels.
                </p>
                <p>
                  Whether you are a gamer looking to sharpen your reaction time, a typist aiming
                  for a higher WPM, or just curious about how your brain processes visual and
                  auditory stimuli, SkillCheck gives you the tools to measure where you stand
                  and track your progress over time.
                </p>
              </div>
            </section>

            <section className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-black tracking-tight text-slate-800">Our Tests</h2>
              <div className="mt-3 space-y-3 text-sm font-medium leading-6 text-slate-600">
                <p>
                  <strong className="text-slate-800">Reaction Protocol:</strong> Measures your
                  visual and audio response time with single-target and multi-target variants.
                  A staple of cognitive assessment used in sports science and neurological
              research.
                </p>
                <p>
                  <strong className="text-slate-800">Aim Assessment:</strong> Tests your
                  hand-eye coordination through static targets, moving targets, tracking
                  exercises, and precision-split challenges. Inspired by aim trainers used by
                  competitive gamers.
                </p>
                <p>
                  <strong className="text-slate-800">Keystroke Test:</strong> A full typing
                  speed and accuracy test supporting English, German, and Spanish. Measures
                  gross WPM, net WPM, and error rates over 30- or 60-second sessions.
                </p>
                <p>
                  <strong className="text-slate-800">Mouse Control:</strong> Evaluates your
                  ability to perform precise cursor movements, including symbol tracing and
                  clicks-per-second challenges.
                </p>
                <p>
                  <strong className="text-slate-800">Rhythm Sync:</strong> Calibrates your
                  internal timing with perfect-sync and stop-timer exercises that measure how
                  accurately you can match a rhythm.
                </p>
                <p>
                  <strong className="text-slate-800">Cognitive Review:</strong> Spatial
                  reasoning and short-term memory tests, including mental rotation, sequence
                  memory, and estimation challenges.
                </p>
              </div>
            </section>

            <section className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-black tracking-tight text-slate-800">Multiplayer & Daily Challenges</h2>
              <div className="mt-3 space-y-3 text-sm font-medium leading-6 text-slate-600">
                <p>
                  Beyond solo testing, SkillCheck features a real-time multiplayer mode. You can
                  create a private party, share a code with friends, and race through the same
                  game order together. Our Duel mode matches you against another player in a
                  head-to-head format with Elo-based matchmaking and rankings.
                </p>
                <p>
                  The Daily Challenge gives everyone one shot per day at the same curated test.
                  It is the fairest way to compare yourself against the global community, since
                  every participant faces identical conditions.
                </p>
              </div>
            </section>

            <section className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-black tracking-tight text-slate-800">Who Made This?</h2>
              <div className="mt-3 space-y-3 text-sm font-medium leading-6 text-slate-600">
                <p>
                  SkillCheck is built and maintained by David Madjarov, a solo developer based in
                  Vienna, Austria. The site was created as a passion project to explore the
                  intersection of gamification, cognitive science, and web performance. It is
                  built with Next.js, TypeScript, and Supabase.
                </p>
                <p>
                  No venture capital, no investors — just a developer who enjoys building things
                  that people find useful. If you have feedback or suggestions, reach out via the
                  contact page.
                </p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}