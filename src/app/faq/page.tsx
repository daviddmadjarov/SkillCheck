import Link from 'next/link';

export const metadata = {
  title: 'FAQ | SkillCheck',
  description:
    'Frequently asked questions about SkillCheck — how tests work, scoring, leaderboards, multiplayer, privacy, and account management.',
};

const faqSections = [
  {
    title: 'Getting Started',
    items: [
      {
        q: 'Do I need an account to use SkillCheck?',
        a: 'No. You can play every test as a guest without signing up. However, creating an account (free, via Google, Discord, or email magic link) lets you save your scores, appear on the global leaderboard, and participate in multiplayer duels.',
      },
      {
        q: 'Is SkillCheck free?',
        a: 'Yes. All tests, leaderboards, daily challenges, and multiplayer modes are completely free. The site is supported by advertisements.',
      },
      {
        q: 'How do I sign in?',
        a: 'Click the profile button in the top-right corner on the homepage. You can sign in with Google, Discord, or request a magic link sent to your email. No password required for the magic-link option.',
      },
    ],
  },
  {
    title: 'Tests & Scoring',
    items: [
      {
        q: 'What does each test measure?',
        a: 'Reaction Protocol measures your response time to visual and audio stimuli. Aim Assessment tests hand-eye coordination with static and moving targets. Keystroke Test measures your typing speed in WPM and accuracy. Mouse Control evaluates cursor precision and click speed. Rhythm Sync checks your internal timing accuracy. Cognitive Review tests spatial reasoning, memory, and estimation abilities.',
      },
      {
        q: 'How are scores calculated?',
        a: 'Each test uses its own scoring formula. Reaction time is measured in milliseconds (lower is better). Typing is scored in words per minute with accuracy penalties. Aim and mouse tests use accuracy and speed metrics. Rhythm tests measure timing deviation from a perfect beat. Scores are stored per test category and aggregated into a combined Lab Score for the global leaderboard.',
      },
      {
        q: 'Can I retake a test?',
        a: 'Yes, you can retake any test as many times as you like in free-play mode. Only your best score per test category is used for the leaderboard. The Daily Challenge is the only exception — one attempt per day.',
      },
      {
        q: 'How is the Lab Score calculated?',
        a: 'Your Lab Score is the sum of your best score in each test bucket. The more tests you complete, the higher your potential score. Only your personal best in each category counts, so there is no penalty for retrying.',
      },
    ],
  },
  {
    title: 'Multiplayer & Duels',
    items: [
      {
        q: 'How do I play with friends?',
        a: 'Go to the homepage and click "Create Party". You will get a shareable code. Send it to your friends, and they can join by clicking "Join Party" and entering the code. Once everyone is ready, the host starts the game.',
      },
      {
        q: 'How does Duel mode work?',
        a: 'Duel mode uses Elo-based matchmaking to pair you with a player of similar skill. You both race through the same set of tests in real time. Winning a duel increases your Elo rating; losing decreases it.',
      },
      {
        q: 'What is Elo?',
        a: 'Elo is a rating system originally developed for chess. It estimates your skill level based on match outcomes. New players start at a baseline rating, and it adjusts after each duel based on the rating of your opponent. Beating a higher-rated player gives a bigger boost than beating a lower-rated one.',
      },
    ],
  },
  {
    title: 'Account & Privacy',
    items: [
      {
        q: 'What data do you collect?',
        a: 'We collect only what is necessary to provide the service: your email (if you register), your game scores, and basic session data. We do not sell your data. Full details are in the Privacy Policy.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes. Email marketcapgame@gmail.com with your account details, and we will delete your profile and associated scores.',
      },
      {
        q: 'Do you use cookies?',
        a: 'We use one essential session cookie to keep you logged in. Advertising cookies from Google AdSense are only loaded if you accept them via the cookie banner. You can change your preference anytime using the Cookie Settings button in the footer.',
      },
    ],
  },
  {
    title: 'Technical Issues',
    items: [
      {
        q: 'Which browsers are supported?',
        a: 'SkillCheck works on all modern browsers: Chrome, Firefox, Safari, and Edge. For the best experience, use the latest version of your browser.',
      },
      {
        q: 'Why is my score not saving?',
        a: 'Scores require a stable internet connection to reach our Supabase backend. If you are playing as a guest, scores are stored but not linked to a persistent profile. Sign in to ensure your scores are permanently saved to your account.',
      },
      {
        q: 'I found a bug. Where do I report it?',
        a: 'Please report bugs through the Contact Us page. Include your browser, operating system, and a description of what happened. We appreciate detailed reports.',
      },
    ],
  },
];

export default function FAQPage() {
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
            <p className="status-pill w-fit">FAQ</p>
            <h1 className="text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
              Frequently Asked Questions
            </h1>
            <p className="text-base font-medium leading-7 text-slate-600 sm:text-lg">
              Everything you need to know about SkillCheck — from how tests work to privacy
              and troubleshooting.
            </p>
          </div>

          <div className="mt-8 space-y-6">
            {faqSections.map((section) => (
              <section
                className="rounded-[1.6rem] border-2 border-slate-200 bg-slate-50 p-5"
                key={section.title}
              >
                <h2 className="text-lg font-black tracking-tight text-slate-800">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.items.map((item) => (
                    <div key={item.q}>
                      <h3 className="text-sm font-bold text-slate-800">{item.q}</h3>
                      <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
                        {item.a}
                      </p>
                    </div>
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