import { NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

const STAT_TITLES: Record<string, { title: string; about: string }> = {
  'reaction-time': {
    title: 'Reaction Time — Method & Norms',
    about:
      'This protocol measures simple visual reaction time — how quickly you respond to a visual stimulus. The average (median) reaction time is calculated from all SkillCheck users. Performance is affected by the latency of your computer and monitor. A fast display with low input lag (high refresh rate) will improve your scores. Scores in this test are faster than the aim trainer tests because you react instantly without needing to move a cursor.',
  },
  'audio-reaction': {
    title: 'Audio Reaction — Auditory Cue',
    about:
      'In this variant the signal is an audio tone rather than a visual cue. Auditory reaction times are typically slightly faster than visual ones because sound processing bypasses some neural delays. Your scores are also influenced by audio latency — wireless headphones or Bluetooth audio can add measurable delay.',
  },
  'multi-reaction': {
    title: 'Multi-Reaction — Choice Response',
    about:
      'This variation presents one of four randomly selected buttons that must be pressed. Unlike simple reaction tasks, this measures choice reaction time, which includes the additional cognitive step of identifying the correct target. Expect slightly slower times than simple reaction as a result.',
  },
  'aim-trainer': {
    title: 'Aim Trainer — Static Precision',
    about:
      'Twenty-five static targets appear one at a time. Click each as fast and accurately as possible. The score combines both speed (reaction + cursor movement) and precision. A high-DPI mouse with a low-latency sensor will produce better scores. Your monitor size and resolution also affect how far the cursor must travel.',
  },
  'aim-moving-targets': {
    title: 'Moving Targets — Dynamic Tracking',
    about:
      'Targets drift across the screen in random directions. This adds a tracking component to the aim challenge — you must predict movement and intercept. The average (median) time per target is computed across all SkillCheck users. Performance depends on hand-eye coordination, mouse tracking precision, and display refresh rate.',
  },
  'aim-perfect-split': {
    title: 'Perfect Split — Geometric Precision',
    about:
      'Drag two dots along the contour of a shape to split it into two equal-area halves. The score reflects how close you came to a perfect 50/50 split. This tests spatial estimation and fine motor control. Distractors include near-identical shape variants to prevent visual memorisation.',
  },
  'aim-tracking-test': {
    title: 'Tracking Test — Sustained Cursor Control',
    about:
      'A randomly drifting target must be kept under your cursor for 20 seconds. The score is the percentage of total time you stayed on target. This measures sustained attention, smooth pursuit, and fine cursor adjustments. High scores require steady hand control and good eye-hand coordination.',
  },
  'mouse-symbol-tracing': {
    title: 'Symbol Tracing — Path Accuracy',
    about:
      'Trace the outline of a target symbol as precisely as possible. The accuracy score measures how closely your traced path matches the template. A high-DPI mouse and steady hand produce the best results. Memory mode adds a recall component — study the shape, then trace it from memory.',
  },
  'mouse-cps': {
    title: 'Click Speed — CPS Test',
    about:
      'How many clicks can you register in 10 seconds? The lab score factors both average clicks per second and peak burst speed. Finger strength, technique (e.g., jitter clicking vs. normal), and mouse switch quality all influence your score.',
  },
  'typing-speed': {
    title: 'Typing Speed — WPM & Accuracy',
    about:
      'A timed typing sprint using random words in English, German or Spanish. The lab score combines words per minute and accuracy into a single metric. Mechanical keyboards with tactile switches and good typing posture tend to produce better scores. Your language selection affects results due to average word length differences.',
  },
  'perfect-sync': {
    title: 'Sync Test — BPM Estimation',
    about:
      'Listen to a short rhythmic groove and estimate its tempo in beats per minute. The score is based on how close your guess is to the true BPM, averaged across four rounds. This tests your internal rhythm perception and ability to sense pulse without visual aids.',
  },
  'stop-timer': {
    title: 'Stop the Timer — Internal Clock',
    about:
      'The timer runs for 1.5 seconds visibly, then fades. Your task is to stop it at exactly a target time between 3 and 20 seconds — relying entirely on your internal sense of time. This measures time estimation accuracy without external cues.',
  },
  'mental-rotation': {
    title: 'Mental Rotation — Spatial Reasoning',
    about:
      'Identify which of four rotated options matches the reference shape. This classic cognitive test measures spatial visualisation ability. Subtle distractor variants from the same shape family make the task harder. Scores reflect accuracy across four rounds, with random rotation angles and shape families each run.',
  },
  'estimation-challenge': {
    title: 'Estimation Challenge — Perceptual Precision',
    about:
      'Each round randomises between estimating line length, fill percentage, angle, or dot count. This tests your perceptual precision across multiple visual domains. The score is the sum of round scores, each scaled to 250 points based on estimation accuracy.',
  },
  'sequence-memory': {
    title: 'Sequence Memory — Working Memory',
    about:
      'Watch the 3×3 grid light up in sequence, then repeat the pattern back. The sequence grows by one step each successful round. The lab score reflects the maximum sequence length reached, scaled to 1000. This measures short-term working memory capacity and pattern recall.',
  },
};

type StatBucket = { label: string; count: number };

function buildBuckets(scores: number[], bucketSize: number, labelPrefix: string): StatBucket[] {
  if (scores.length === 0) return [];

  const max = Math.max(...scores);
  const bucketCount = Math.max(5, Math.ceil(max / bucketSize));
  const buckets: StatBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const low = i * bucketSize;
    const high = low + bucketSize;
    const label = `${labelPrefix} ${low}–${high}`;
    const count = scores.filter((s) => s >= low && s < high).length;
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

  if (!hasSupabaseEnv()) {
    return NextResponse.json({
      average: null,
      buckets: [] as StatBucket[],
      median: null,
      totalParticipants: 0,
      about: STAT_TITLES[testSlug]?.about ?? '',
      title: STAT_TITLES[testSlug]?.title ?? '',
    });
  }

  try {
    const supabase = await createClient();

    // Fetch all scores for this test slug from score_submissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('score_submissions')
      .select('score')
      .eq('test_slug', testSlug);

    const scores: number[] = (data ?? []).map((r: { score: number }) => r.score).filter(Number.isFinite);

    const avg = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null;
    const med = median(scores);
    const totalParticipants = scores.length;

    // Build buckets for histogram — bucket size depends on test slug
    const isMsBased = ['reaction-time', 'audio-reaction', 'multi-reaction'].includes(testSlug);
    const isCps = testSlug === 'mouse-cps';
    const bucketSize = isMsBased ? 50 : isCps ? 20 : 50;

    let buckets: StatBucket[] = [];
    if (testSlug.startsWith('aim-') || testSlug.startsWith('mouse-')) {
      // These are scored 0–1000
      buckets = buildBuckets(scores, 100, '');
    } else if (isMsBased) {
      // Reaction scores are in lab-score format (0–1200 range)
      buckets = buildBuckets(scores, 100, '');
    } else {
      buckets = buildBuckets(scores, bucketSize, '');
    }

    return NextResponse.json({
      average: avg,
      buckets,
      median: Math.round(med),
      totalParticipants,
      about: STAT_TITLES[testSlug]?.about ?? '',
      title: STAT_TITLES[testSlug]?.title ?? '',
    });
  } catch {
    return NextResponse.json({
      average: null,
      buckets: [] as StatBucket[],
      median: null,
      totalParticipants: 0,
      about: STAT_TITLES[testSlug]?.about ?? '',
      title: STAT_TITLES[testSlug]?.title ?? '',
    });
  }
}