import { NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

type GameConversion = {
  title: string;
  about: string;
  /** Converts a lab score back to the meaningful raw measurement */
  convertScore: (score: number) => number;
  /** Unit label for display (ms, BPM, %, WPM, CPS) */
  unit: string;
  /** Label for the stats cards (e.g. "Average reaction", "Median CPS") */
  label: string;
  /** Rounding precision */
  precision: number;
};

const GAME_CONVERSIONS: Record<string, GameConversion> = {
  'reaction-time': {
    title: 'Reaction Time — Method & Norms',
    about:
      'This protocol measures simple visual reaction time — how fast you respond to seeing a stimulus. In most people, simple reaction time sits between 150–300 ms, though it varies with things like stimulus brightness and where on your screen it appears (your peripheral vision is slower than your fovea). Performance is also affected by your display: a typical 60 Hz LCD adds 8–16 ms of input lag, while high-refresh monitors (240 Hz+) can cut that to under 4 ms. Data shown below is collected from all SkillCheck users.\n\n'
      + 'Fun fact: the "simple vs. choice" reaction time distinction was first studied by Franciscus Donders back in 1868 — [read more on Wikipedia](https://en.wikipedia.org/wiki/Mental_chronometry).',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg reaction',
    precision: 0,
  },
  'audio-reaction': {
    title: 'Audio Reaction — Auditory Cue',
    about:
      'Same idea, but you react to an audio tone instead of a visual flash. Most people are about 20–50 ms faster with audio cues — that\'s because your ear processes sound faster than your eye processes light, and there\'s no phototransduction delay in the retina. Your audio gear matters here: Bluetooth headphones can add 30–200 ms of latency depending on the codec.\n\n'
      + 'More on how audio perception works: [Wikipedia — Psychoacoustics](https://en.wikipedia.org/wiki/Psychoacoustics).',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg reaction',
    precision: 0,
  },
  'multi-reaction': {
    title: 'Multi-Reaction — Choice Response',
    about:
      'Instead of one button, you get four — and you need to hit the right one. This measures choice reaction time (CRT), which adds a decision-making step. According to Hick\'s law, the time it takes grows with the number of options: each extra bit of information (doubling the choices) adds about 50–100 ms. That\'s why 4-button tests are slower than the single-button variant.\n\n'
      + 'First explored by Donders in 1868: [Wikipedia — Hick\'s law](https://en.wikipedia.org/wiki/Hick%27s_law).',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg reaction',
    precision: 0,
  },
  'aim-trainer': {
    title: 'Aim Trainer — Static Precision',
    about:
      'Click a stationary target as fast as possible — that\'s a combination of reaction time plus a pointing movement. Fitts\'s law predicts how long that movement takes based on how far you have to move and how big the target is. Harder targets (further away and smaller) take longer. That\'s why aim trainer times are slower than pure reaction tests — you\'re moving the cursor too.\n\n'
      + 'More on the science of pointing: [Wikipedia — Fitts\'s law](https://en.wikipedia.org/wiki/Fitts%27s_law).',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg time',
    precision: 0,
  },
  'aim-moving-targets': {
    title: 'Moving Targets — Dynamic Tracking',
    about:
      'This time the target moves around the screen at random speeds and bounces off the edges. You\'re not just reacting — you\'re predicting where it\'ll be and intercepting it. That\'s called coincidence anticipation, and it\'s the same skill you use when catching a ball. The brain area that handles motion tracking (MT/V5) is working overtime here.\n\n'
      + 'Learn about how we perceive motion: [Wikipedia — Motion perception](https://en.wikipedia.org/wiki/Motion_perception).',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg time',
    precision: 0,
  },
  'aim-perfect-split': {
    title: 'Perfect Split — Geometric Precision',
    about:
      'Drag two dots along the edge of a shape to cut it into two equal halves. The closer you get to 50:50, the higher your score. This tests your spatial estimation and fine motor control, relying on sensory feedback from tiny sensors in your skin called mechanoreceptors. The shapes are randomly generated, so no two runs are ever the same.\n\n'
      + 'More on how your body senses position: [Wikipedia — Proprioception](https://en.wikipedia.org/wiki/Proprioception).',
    // score = 1000 * exp(-deviation^2 / 55) → deviation ≈ sqrt(-55 * ln(score / 1000))
    convertScore: (s) => {
      if (s >= 1000) return 0;
      const ratio = Math.max(0.001, s / 1000);
      return Math.round(Math.sqrt(-55 * Math.log(ratio)) * 10) / 10;
    },
    unit: '% deviation',
    label: 'Avg deviation',
    precision: 1,
  },
  'aim-tracking-test': {
    title: 'Tracking Test — Sustained Cursor Control',
    about:
      'Keep your cursor inside a moving target for 20 seconds. Your score is the percentage of time you stayed on target. This is a digital version of the pursuit rotor test, first used in 1922 to measure motor skill learning. Performance improves with practice through a process called cerebellar plasticity, but gets worse when you\'re tired or distracted. The target never repeats the same trajectory, so you can\'t memorise the path.\n\n'
      + 'More on this classic test: [Wikipedia — Pursuit rotor](https://en.wikipedia.org/wiki/Pursuit_rotor).',
    convertScore: (s) => Math.round((s / 10) * 10) / 10,
    unit: '% on target',
    label: 'Avg accuracy',
    precision: 1,
  },
  'mouse-symbol-tracing': {
    title: 'Symbol Tracing — Path Accuracy',
    about:
      'Trace the outline of a shape as precisely as possible. Your score is based on how close you stay to the line, how much of the shape you cover, and how smooth your movement is — all wrapped into one accuracy percentage. Tracing activates parts of your brain involved in visually-guided movement and error detection. There are 24 different shapes to keep things varied.\n\n'
      + 'Read more: [Wikipedia — Motor skill](https://en.wikipedia.org/wiki/Motor_skill).',
    convertScore: (s) => Math.round(s / 10),
    unit: '% accuracy',
    label: 'Avg accuracy',
    precision: 0,
  },
  'mouse-cps': {
    title: 'Click Speed — CPS Test',
    about:
      'How many clicks can you fit into 10 seconds? Most people average around 5–7 clicks per second for index finger tapping, according to published norms. Some gamers use specialised techniques like "jitter clicking" (vibrating the whole forearm) to push past 10 CPS, but that comes with a real risk of repetitive strain injury. This test balances burst speed with sustainability.\n\n'
      + 'More: [Wikipedia — Finger tapping](https://en.wikipedia.org/wiki/Finger_tapping).',
    // labScore ≈ ((CPS * 0.75 + peakCPS * 0.25) / 20) * 1000 → roughly CPS ≈ score / 1000 * 20 / 0.75
    convertScore: (s) => Math.round(((s / 1000) * 20 / 0.75) * 100) / 100,
    unit: 'CPS',
    label: 'Avg CPS',
    precision: 2,
  },
  'typing-speed': {
    title: 'Typing Speed — WPM & Accuracy',
    about:
      'A timed typing sprint using random words in English, German or Spanish. The score combines your speed and accuracy into one number. Skilled typists usually hit 60–80 WPM, and the world record for a 30-second sprint is over 200 WPM. Once you know a word, typing it is mostly automatic — the fingers just execute a stored motor plan without thinking about each letter.\n\n'
      + 'More: [Wikipedia — Words per minute](https://en.wikipedia.org/wiki/Words_per_minute).',
    // labScore = speedFactor * accuracyFactor * 1000, speedFactor = wpm / 120
    convertScore: (s) => Math.round(((s / 1000) * 120 / 0.85)),
    unit: 'WPM',
    label: 'Approx WPM',
    precision: 0,
  },
  'perfect-sync': {
    title: 'Sync Test — BPM Estimation',
    about:
      'Listen to an 8-beat rhythm and guess its tempo in BPM. Your score depends on how close you get, averaged over four rounds. The audio is generated by a bank of oscillators — different sounds for downbeats, backbeats and subdivisions. Recognising tempo is something your brain does naturally: the basal ganglia and supplementary motor area lock onto a beat even when you\'re sitting still.\n\n'
      + 'More on the science of rhythm: [Wikipedia — Beat perception](https://en.wikipedia.org/wiki/Beat_perception).',
    // liveScore = clamp(1000 - avgError * 8, 0, 1000) → error ≈ (1000 - score) / 8
    convertScore: (s) => Math.round(((1000 - s) / 8) * 10) / 10,
    unit: 'BPM error',
    label: 'Avg error',
    precision: 1,
  },
  'overclock': {
    title: 'Overclock — Reflex Ring Tracking',
    about:
      'Hit the moving target as the ball orbits the ring at ever-increasing speed. Each successful hit reverses direction and adds speed — miss and you reset back to base. The 20-second timer keeps the pressure on. This tests visuomotor coordination and timing precision under escalating cognitive load.\n\n'
      + 'More on how the brain coordinates timing: [Wikipedia — Timing in the brain](https://en.wikipedia.org/wiki/Time_perception).',
    // score = raw count of successful checks, no conversion needed
    convertScore: (s) => Math.round(s),
    unit: 'points',
    label: 'Final score',
    precision: 0,
  },
  'stop-timer': {
    title: 'Stop the Timer — Internal Clock',
    about:
      'A target time between 3 and 20 seconds is shown. You see the timer for 1.5 seconds, then the display fades and you have to stop it as close to the target as possible using just your internal sense of time. This is called interval timing, and it relies on a brain circuit involving the basal ganglia. Interestingly, the variability in your estimates grows with the target duration — a phenomenon known as Weber\'s law for time.\n\n'
      + 'More: [Wikipedia — Time perception](https://en.wikipedia.org/wiki/Time_perception).',
    // finalScore = clamp(1000 - max(0, avg - 50) * 0.25, 0, 1000) → avg ≈ (1000 - score) / 0.25 + 50
    convertScore: (s) => Math.round(Math.max(0, (1000 - s) / 0.25 + 50)),
    unit: 'ms error',
    label: 'Avg error',
    precision: 0,
  },
  'mental-rotation': {
    title: 'Mental Rotation — Spatial Reasoning',
    about:
      'You\'re shown a shape and four options — three are distractors that look similar, one is the exact same shape just rotated. Can you find it? This is based on a classic 1971 experiment by Shepard and Metzler, who found that people mentally rotate objects at a steady speed of about 50–60 degrees per second. The longer the rotation, the longer it takes to answer. The distractors here are designed to be tricky by varying subtle features.\n\n'
      + 'Read the original study: [Wikipedia — Mental rotation](https://en.wikipedia.org/wiki/Mental_rotation).',
    convertScore: (s) => Math.round(s / 10),
    unit: '% correct',
    label: 'Avg accuracy',
    precision: 0,
  },
  'estimation-challenge': {
    title: 'Estimation Challenge — Perceptual Precision',
    about:
      'Each round gives you a random perceptual puzzle: estimate a line length, a fill percentage, an angle, how many dots flashed briefly on screen, or how many fireflies are in the jar. Scoring goes up to 250 per round, maxing at 1000 for the full run. The dot-count task taps into something called subitising — your brain can instantly tell how many items there are when it\'s 4 or fewer, but beyond that you have to count.\n\n'
      + 'More on this: [Wikipedia — Subitizing](https://en.wikipedia.org/wiki/Subitizing).',
    // labScore = sum of 4 round scores (each 0–250) → avgRound = score / 4
    convertScore: (s) => Math.round((s / 4) * 10) / 10,
    unit: '/250 per round',
    label: 'Avg round',
    precision: 1,
  },
  'sequence-memory': {
    title: 'Sequence Memory — Working Memory',
    about:
      'Watch a 3×3 grid light up in a sequence, then tap it back in the same order. Each successful round adds another step. Your max sequence length reveals your visuospatial working memory capacity — how many spatial positions you can hold in mind at once. Most adults can handle about 4–6 items for this kind of task. The tiles light up with different colours and each one plays a unique note, giving your brain two ways to encode the sequence.\n\n'
      + 'More: [Wikipedia — Working memory](https://en.wikipedia.org/wiki/Working_memory).',
    // labScore = clamp(sequence.length * 80, 0, 1000) → length ≈ score / 80
    convertScore: (s) => Math.max(0, Math.round(s / 80)),
    unit: 'steps',
    label: 'Avg length',
    precision: 0,
  },
};

type StatBucket = { label: string; count: number };

function buildBuckets(values: number[], bucketSize: number, unit: string): StatBucket[] {
  if (values.length === 0) return [];

  const max = Math.max(...values);
  const bucketCount = Math.max(5, Math.ceil(max / bucketSize));
  const buckets: StatBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const low = i * bucketSize;
    const high = low + bucketSize;
    const label = `${low}–${high} ${unit}`.trim();
    const count = values.filter((v) => v >= low && v < high).length;
    buckets.push({ label, count });
  }

  return buckets;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ testSlug: string }> },
) {
  const { testSlug } = await params;
  const conv = GAME_CONVERSIONS[testSlug];

  if (!conv) {
    return NextResponse.json({ error: 'Unknown test slug.' }, { status: 404 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      displayAverage: null,
      displayMedian: null,
      buckets: [] as StatBucket[],
      totalParticipants: 0,
      about: conv.about,
      title: conv.title,
      unit: conv.unit,
      label: conv.label,
      precision: conv.precision,
    });
  }

  try {
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('score_submissions')
      .select('score')
      .eq('test_slug', testSlug);

    const scores: number[] = (data ?? []).map((r: { score: number }) => r.score).filter(Number.isFinite);

    if (scores.length === 0) {
      return NextResponse.json({
        displayAverage: null,
        displayMedian: null,
        buckets: [] as StatBucket[],
        totalParticipants: 0,
        about: conv.about,
        title: conv.title,
        unit: conv.unit,
        label: conv.label,
        precision: conv.precision,
      });
    }

    // Convert all scores to the meaningful unit
    const converted = scores.map(conv.convertScore);
    const avg = converted.reduce((a: number, b: number) => a + b, 0) / converted.length;
    const med = median(converted);
    const totalParticipants = scores.length;

    // Build buckets from the converted values with appropriate bucket size
    let bucketSize = 50;
    if (conv.unit.includes('ms') || conv.unit.includes('ms error')) bucketSize = 25;
    else if (conv.unit.includes('CPS')) bucketSize = 2;
    else if (conv.unit.includes('WPM')) bucketSize = 10;
    else if (conv.unit.includes('BPM')) bucketSize = 5;
    else if (conv.unit.includes('%')) bucketSize = 10;
    else if (conv.unit.includes('deviation')) bucketSize = 2;
    else if (conv.unit.includes('steps')) bucketSize = 2;
    else if (conv.unit.includes('/250')) bucketSize = 25;
    else bucketSize = 50;

    const buckets = buildBuckets(converted, bucketSize, conv.unit);

    return NextResponse.json({
      displayAverage: Math.round(avg * 10) / 10,
      displayMedian: Math.round(med * 10) / 10,
      buckets,
      totalParticipants,
      about: conv.about,
      title: conv.title,
      unit: conv.unit,
      label: conv.label,
      precision: conv.precision,
    });
  } catch {
    return NextResponse.json({
      displayAverage: null,
      displayMedian: null,
      buckets: [] as StatBucket[],
      totalParticipants: 0,
      about: conv.about,
      title: conv.title,
      unit: conv.unit,
      label: conv.label,
      precision: conv.precision,
    });
  }
}