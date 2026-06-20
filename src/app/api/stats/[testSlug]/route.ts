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
    about: 'This protocol measures simple visual reaction time — how quickly you respond to a visual stimulus. The average (median) reaction time is calculated from all SkillCheck users. Performance is affected by the latency of your computer and monitor. A fast display with low input lag (high refresh rate) will improve your scores. Scores in this test are faster than the aim trainer tests because you react instantly without needing to move a cursor.',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg reaction',
    precision: 0,
  },
  'audio-reaction': {
    title: 'Audio Reaction — Auditory Cue',
    about: 'In this variant the signal is an audio tone rather than a visual cue. Auditory reaction times are typically slightly faster than visual ones because sound processing bypasses some neural delays. Your scores are also influenced by audio latency — wireless headphones or Bluetooth audio can add measurable delay.',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg reaction',
    precision: 0,
  },
  'multi-reaction': {
    title: 'Multi-Reaction — Choice Response',
    about: 'This variation presents one of four randomly selected buttons that must be pressed. Unlike simple reaction tasks, this measures choice reaction time, which includes the additional cognitive step of identifying the correct target. Expect slightly slower times than simple reaction as a result.',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg reaction',
    precision: 0,
  },
  'aim-trainer': {
    title: 'Aim Trainer — Static Precision',
    about: 'Twenty-five static targets appear one at a time. Click each as fast and accurately as possible. The score combines both speed (reaction + cursor movement) and precision. A high-DPI mouse with a low-latency sensor will produce better scores. Your monitor size and resolution also affect how far the cursor must travel.',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg time',
    precision: 0,
  },
  'aim-moving-targets': {
    title: 'Moving Targets — Dynamic Tracking',
    about: 'Targets drift across the screen in random directions. This adds a tracking component to the aim challenge — you must predict movement and intercept. The average (median) time per target is computed across all SkillCheck users. Performance depends on hand-eye coordination, mouse tracking precision, and display refresh rate.',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg time',
    precision: 0,
  },
  'aim-perfect-split': {
    title: 'Perfect Split — Geometric Precision',
    about: 'Drag two dots along the contour of a shape to split it into two equal-area halves. The score reflects how close you came to a perfect 50/50 split. A deviation of 0% means a perfect split. This tests spatial estimation and fine motor control. Distractors include near-identical shape variants to prevent visual memorisation.',
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
    about: 'A randomly drifting target must be kept under your cursor for 20 seconds. The score is the percentage of total time you stayed on target. This measures sustained attention, smooth pursuit, and fine cursor adjustments. High scores require steady hand control and good eye-hand coordination.',
    // score = (timeInsideMs / 20000) * 1000 → pct = score / 10
    convertScore: (s) => Math.round((s / 10) * 10) / 10,
    unit: '% on target',
    label: 'Avg accuracy',
    precision: 1,
  },
  'mouse-symbol-tracing': {
    title: 'Symbol Tracing — Path Accuracy',
    about: 'Trace the outline of a target symbol as precisely as possible. The accuracy score measures how closely your traced path matches the template. A high-DPI mouse and steady hand produce the best results. Memory mode adds a recall component — study the shape, then trace it from memory.',
    // labScore = weighted * 10, accuracy = weighted → accuracy ≈ score / 10
    convertScore: (s) => Math.round(s / 10),
    unit: '% accuracy',
    label: 'Avg accuracy',
    precision: 0,
  },
  'mouse-cps': {
    title: 'Click Speed — CPS Test',
    about: 'How many clicks can you register in 10 seconds? The CPS value shown here is estimated from the lab score. Finger strength, technique (e.g., jitter clicking vs. normal), and mouse switch quality all influence your score.',
    // labScore ≈ ((CPS * 0.75 + peakCPS * 0.25) / 20) * 1000 → roughly CPS ≈ score / 1000 * 20 / 0.75
    convertScore: (s) => Math.round(((s / 1000) * 20 / 0.75) * 100) / 100,
    unit: 'CPS',
    label: 'Avg CPS',
    precision: 2,
  },
  'typing-speed': {
    title: 'Typing Speed — WPM & Accuracy',
    about: 'A timed typing sprint using random words in English, German or Spanish. The approximate WPM shown here is estimated from the lab score. Mechanical keyboards with tactile switches and good typing posture tend to produce better scores. Your language selection affects results due to average word length differences.',
    // labScore = speedFactor * accuracyFactor * 1000, speedFactor = wpm / 120
    // Rough estimate: wpm ≈ (score / 1000) * 120 (assuming ~85% accuracy)
    convertScore: (s) => Math.round(((s / 1000) * 120 / 0.85)),
    unit: 'WPM',
    label: 'Approx WPM',
    precision: 0,
  },
  'perfect-sync': {
    title: 'Sync Test — BPM Estimation',
    about: 'Listen to a short rhythmic groove and estimate its tempo in beats per minute. The score is based on how close your guess is to the true BPM, averaged across four rounds. A lower BPM error means better rhythm perception.',
    // liveScore = clamp(1000 - avgError * 8, 0, 1000) → error ≈ (1000 - score) / 8
    convertScore: (s) => Math.round(((1000 - s) / 8) * 10) / 10,
    unit: 'BPM error',
    label: 'Avg error',
    precision: 1,
  },
  'stop-timer': {
    title: 'Stop the Timer — Internal Clock',
    about: 'The timer runs for 1.5 seconds visibly, then fades. Your task is to stop it at exactly a target time between 3 and 20 seconds — relying entirely on your internal sense of time. Lower ms error means better time estimation.',
    // finalScore = clamp(1000 - max(0, avg - 50) * 0.25, 0, 1000) → avg ≈ (1000 - score) / 0.25 + 50
    convertScore: (s) => Math.round(Math.max(0, (1000 - s) / 0.25 + 50)),
    unit: 'ms error',
    label: 'Avg error',
    precision: 0,
  },
  'mental-rotation': {
    title: 'Mental Rotation — Spatial Reasoning',
    about: 'Identify which of four rotated options matches the reference shape. This classic cognitive test measures spatial visualisation ability. Subtle distractor variants from the same shape family make the task harder. Scores reflect the percentage of correctly identified rotations.',
    // labScore = (correctCount / ROUNDS) * 1000 → pct = score / 10
    convertScore: (s) => Math.round(s / 10),
    unit: '% correct',
    label: 'Avg accuracy',
    precision: 0,
  },
  'estimation-challenge': {
    title: 'Estimation Challenge — Perceptual Precision',
    about: 'Each round randomises between estimating line length, fill percentage, angle, or dot count. This tests your perceptual precision across multiple visual domains. The round score (0–250) shown here is the average across all four rounds.',
    // labScore = sum of 4 round scores (each 0–250) → avgRound = score / 4
    convertScore: (s) => Math.round((s / 4) * 10) / 10,
    unit: '/250 per round',
    label: 'Avg round',
    precision: 1,
  },
  'sequence-memory': {
    title: 'Sequence Memory — Working Memory',
    about: 'Watch the 3×3 grid light up in sequence, then repeat the pattern back. The sequence grows by one step each successful round. The lab score reflects the maximum sequence length reached, scaled to 1000.',
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