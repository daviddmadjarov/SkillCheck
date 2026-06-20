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
      'This protocol measures simple visual reaction time — the interval between the onset of a visual stimulus and your motor response. In human neurophysiology, the typical simple visual reaction time for young adults ranges from 150–300 ms, with a strong dependency on stimulus intensity, contrast, and retinal eccentricity (the further from the fovea a stimulus appears, the slower the response). Studies on speed-of-information processing distinguish between simple reaction time (one stimulus, one response) and choice reaction time (multiple stimuli with conditional responses), a paradigm first systematically studied by Franciscus Donders in 1868. Performance is also influenced by display latency: a typical 60 Hz LCD introduces 8–16 ms of input lag, while high-refresh-rate monitors (240 Hz+) can reduce this to under 4 ms. Data collected across SkillCheck users are shown below.\n\n'
      + 'Further reading: Wikipedia — Mental chronometry (https://en.wikipedia.org/wiki/Mental_chronometry) and Hick\'s law (https://en.wikipedia.org/wiki/Hick%27s_law).',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg reaction',
    precision: 0,
  },
  'audio-reaction': {
    title: 'Audio Reaction — Auditory Cue',
    about:
      'This variant measures auditory reaction time — responding to a pure tone (880 Hz sine wave) instead of a visual flash. Meta-analyses consistently show auditory reaction times are approximately 20–50 ms faster than visual ones, attributed to the shorter transduction cascade in the cochlea and the absence of phototransduction delay in the retina. The auditory brainstem response (ABR) occurs within 10 ms of stimulus onset, whereas the visual counterpart (the P100 wave) peaks around 100–130 ms. Wireless audio peripherals can add 30–200 ms of Bluetooth codec latency (Qualcomm, 2022), which is especially relevant for this test.\n\n'
      + 'Further reading: Wikipedia — Brainstem auditory evoked potential (https://en.wikipedia.org/wiki/Brainstem_auditory_evoked_potential) and Psychoacoustics (https://en.wikipedia.org/wiki/Psychoacoustics).',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg reaction',
    precision: 0,
  },
  'multi-reaction': {
    title: 'Multi-Reaction — Choice Response',
    about:
      'This protocol measures choice reaction time (CRT): the interval required to detect which of four possible stimuli appeared and execute the corresponding motor response. According to Hick\'s law (1952), CRT increases logarithmically with the number of stimulus-response alternatives: CRT = a + b × log₂(n), where n is the number of equally probable choices. For n = 4, the information load is 2 bits, adding roughly 50–100 ms compared to simple reaction time. This paradigm traces back to Donders\' subtraction method (1868), one of the earliest experimental frameworks in cognitive psychology. Choice reaction tasks are widely used in clinical assessments of processing speed, especially in multiple sclerosis and traumatic brain injury research.\n\n'
      + 'Further reading: Wikipedia — Hick\'s law (https://en.wikipedia.org/wiki/Hick%27s_law) and Donders\' subtraction method (https://en.wikipedia.org/wiki/Franciscus_Donders).',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg reaction',
    precision: 0,
  },
  'aim-trainer': {
    title: 'Aim Trainer — Static Precision',
    about:
      'In this test you click a stationary circular target as quickly as possible, combining visual reaction time with a ballistic pointing movement. Fitts\'s law (1954) models the movement time as MT = a + b × log₂(2A/W), where A is the distance to the target and W is its width. The ratio 2A/W is the index of difficulty. Unlike simple reaction tests, this task incorporates movement planning and execution, which recruit the contralateral motor cortex and cerebellum. The angular displacement required to reach each new target varies randomly, preventing trajectory learning. The lab score reflects the time per target averaged across 25 hits.\n\n'
      + 'Further reading: Wikipedia — Fitts\'s law (https://en.wikipedia.org/wiki/Fitts%27s_law) and Aim trainer (https://en.wikipedia.org/wiki/Aim_trainer).',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg time',
    precision: 0,
  },
  'aim-moving-targets': {
    title: 'Moving Targets — Dynamic Tracking',
    about:
      'Targets drift across the screen with random velocities and bounce off arena boundaries. This adds a motion extrapolation component to the basic aiming task, requiring the participant to predict future target position and coordinate an intercepting movement — a skill known as coincidence anticipation. In sports science, this capacity is measured with the Bassin Anticipation Timer and correlates with batting and catching performance. The brain\'s middle temporal (MT/V5) visual area is specialised for processing motion, and predictive saccades are generated by the frontal eye fields. The drift speed and bounce timing are randomised across trials to prevent rhythm-based compensation.\n\n'
      + 'Further reading: Wikipedia — Motion perception (https://en.wikipedia.org/wiki/Motion_perception) and Middle temporal gyrus (https://en.wikipedia.org/wiki/Middle_temporal_gyrus).',
    convertScore: (s) => Math.max(0, 1200 - s),
    unit: 'ms',
    label: 'Avg time',
    precision: 0,
  },
  'aim-perfect-split': {
    title: 'Perfect Split — Geometric Precision',
    about:
      'Drag two control points along the perimeter of an irregular convex polygon to partition it into two regions of equal area. The score is a monotonic function of the absolute deviation from 50:50 (inverse exponential mapping). This task probes spatial estimation and fine-grained motor calibration, domains in which proprioceptive feedback from slow-adapting mechanoreceptors (Merkel discs and Ruffini endings) plays a critical role. The polygon shapes are randomly drawn from a procedural generation system, with fill and stroke colours assigned to maximise edge contrast. Each round uses a distinct shape from the same generator family to prevent visual memorisation.\n\n'
      + 'Further reading: Wikipedia — Proprioception (https://en.wikipedia.org/wiki/Proprioception) and Computational geometry (https://en.wikipedia.org/wiki/Computational_geometry).',
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
      'A randomly drifting target must be kept under the cursor for 20 consecutive seconds. The score is the ratio of time-on-target to total duration, expressed as a percentage. This paradigm is a digital adaptation of the pursuit rotor task, first introduced by Koerth in 1922 as a measure of fine motor skill acquisition. Pursuit tracking performance improves with practice through cerebellar plasticity and is impaired by fatigue, alcohol, and sleep deprivation. The target trajectory uses pseudo-random acceleration with wall-bounce boundary conditions, ensuring an Ergodically rich motion profile that does not repeat between trials.\n\n'
      + 'Further reading: Wikipedia — Pursuit rotor (https://en.wikipedia.org/wiki/Pursuit_rotor) and Eye-hand coordination (https://en.wikipedia.org/wiki/Eye%E2%80%93hand_coordination).',
    convertScore: (s) => Math.round((s / 10) * 10) / 10,
    unit: '% on target',
    label: 'Avg accuracy',
    precision: 1,
  },
  'mouse-symbol-tracing': {
    title: 'Symbol Tracing — Path Accuracy',
    about:
      'Trace the contour of a target symbol as precisely as possible. The accuracy score is a composite of deviation from the ideal path, spatial coverage of the template, stray click percentage, and movement smoothness — each weighted according to its contribution to overall tracing quality. Tracing tasks activate the premotor cortex and the anterior cingulate gyrus, regions involved in visually guided action and error monitoring. The symbol set spans 24 distinct shapes (star, arrow, heart, spiral, hexagon, etc.), designed to cover a range of curvature profiles and directional transitions. Memory mode (available in party and duel sessions) adds a delay between exposure and recall, engaging working memory.\n\n'
      + 'Further reading: Wikipedia — Visuospatial sketchpad (https://en.wikipedia.org/wiki/Visuospatial_sketchpad) and Motor skill (https://en.wikipedia.org/wiki/Motor_skill).',
    convertScore: (s) => Math.round(s / 10),
    unit: '% accuracy',
    label: 'Avg accuracy',
    precision: 0,
  },
  'mouse-cps': {
    title: 'Click Speed — CPS Test',
    about:
      'Maximum voluntary click rate over a 10-second window. The lab score is a weighted combination of sustained CPS (75 %) and peak 1-second burst rate (25 %). Human maximal finger-tapping frequency is constrained by the refractory period of motor units and the corticospinal pathway; the population mean for index finger tapping is approximately 5–7 Hz according to normative data (Aoki et al., 2017). Professional gamers using specialised techniques such as jitter-clicking (vibrating the entire forearm) can transiently exceed 10–12 CPS, though this carries a risk of repetitive strain injury. The test duration of 10 seconds was chosen as a compromise between measuring sustainable rate and avoiding muscular fatigue confounds.\n\n'
      + 'Further reading: Wikipedia — Finger tapping (https://en.wikipedia.org/wiki/Finger_tapping) and Repetitive strain injury (https://en.wikipedia.org/wiki/Repetitive_strain_injury).',
    // labScore ≈ ((CPS * 0.75 + peakCPS * 0.25) / 20) * 1000 → roughly CPS ≈ score / 1000 * 20 / 0.75
    convertScore: (s) => Math.round(((s / 1000) * 20 / 0.75) * 100) / 100,
    unit: 'CPS',
    label: 'Avg CPS',
    precision: 2,
  },
  'typing-speed': {
    title: 'Typing Speed — WPM & Accuracy',
    about:
      'A timed typing sprint using randomly generated words from a curated dictionary in English, German, or Spanish. The composite lab score combines words per minute and character-level accuracy into a single metric on a 0–1000 scale. Skilled touch typists achieve 60–80 WPM on average, with the world record for 30-second sprints exceeding 200 WPM (Sean Wrona, 2014). Typing draws on procedural memory consolidated in the basal ganglia and cerebellum; interference paradigms suggest that typing is largely feedforward — once a word is initiated, individual keystrokes are executed from a stored motor plan rather than controlled online. The word bank includes over 50 entries per language spanning 5–18 characters, providing lexical diversity without exposing the full dictionary between runs.\n\n'
      + 'Further reading: Wikipedia — Words per minute (https://en.wikipedia.org/wiki/Words_per_minute) and Touch typing (https://en.wikipedia.org/wiki/Touch_typing).',
    // labScore = speedFactor * accuracyFactor * 1000, speedFactor = wpm / 120
    convertScore: (s) => Math.round(((s / 1000) * 120 / 0.85)),
    unit: 'WPM',
    label: 'Approx WPM',
    precision: 0,
  },
  'perfect-sync': {
    title: 'Sync Test — BPM Estimation',
    about:
      'Listen to an 8-beat rhythmic groove and estimate its tempo in beats per minute (BPM). The lab score is a linear function of the mean absolute error across four rounds of increasing tempo diversity (range: 40–200 BPM). The audio engine generates synthetic percussion using a bank of oscillators — downbeats are emphasised with a 72 Hz triangle wave, backbeats with a 220 Hz square wave, and off-beat subdivisions with a shorter 950 Hz impulse. Human beat perception is mediated by the basal ganglia and the supplementary motor area (SMA), which entrain to periodic stimuli even in the absence of overt movement. Groove patterns are identified by randomly selected names (Prism Groove, Neon Bounce, etc.) for aesthetic reference.\n\n'
      + 'Further reading: Wikipedia — Beat perception (https://en.wikipedia.org/wiki/Beat_perception) and Entrainment (biomusicology) (https://en.wikipedia.org/wiki/Entrainment_%28biomusicology%29).',
    // liveScore = clamp(1000 - avgError * 8, 0, 1000) → error ≈ (1000 - score) / 8
    convertScore: (s) => Math.round(((1000 - s) / 8) * 10) / 10,
    unit: 'BPM error',
    label: 'Avg error',
    precision: 1,
  },
  'stop-timer': {
    title: 'Stop the Timer — Internal Clock',
    about:
      'A target duration between 3 and 20 seconds is shown, the timer runs visibly for 1.5 seconds, then the display fades. You must stop the timer as close to the target as possible using only your internal sense of elapsed time. This measures interval timing, a cognitive function that depends on the cortico-striato-thalamic loop and dopaminergic modulation within the basal ganglia (Matell & Meck, 2004, "Cortico-striatal circuits and interval timing"). The scalar expectancy theory (SET) posits that variability in time estimation scales proportionally with the target duration (Weber\'s law for time). The lab score applies a threshold non-linearity such that errors below 50 ms are not penalised, reflecting the intrinsic temporal uncertainty of human motor execution.\n\n'
      + 'Further reading: Wikipedia — Time perception (https://en.wikipedia.org/wiki/Time_perception) and Scalar expectancy theory (https://en.wikipedia.org/wiki/Scalar_expectancy_theory).',
    // finalScore = clamp(1000 - max(0, avg - 50) * 0.25, 0, 1000) → avg ≈ (1000 - score) / 0.25 + 50
    convertScore: (s) => Math.round(Math.max(0, (1000 - s) / 0.25 + 50)),
    unit: 'ms error',
    label: 'Avg error',
    precision: 0,
  },
  'mental-rotation': {
    title: 'Mental Rotation — Spatial Reasoning',
    about:
      'A reference shape is shown alongside four options, three of which are distractor variants from the same shape family. The participant must identify the single option that is a rotated version of the reference. Mental rotation was systematically quantified by Shepard and Metzler (1971) in their landmark paper "Mental rotation of three-dimensional objects", which demonstrated that reaction time increases linearly with angular disparity — implying that humans mentally rotate an internal representation at a constant angular velocity (about 50–60 degrees per second in most subjects). The shape families used here are two-dimensional projections of the original Shepard–Metzler-style block figures, with distractors differing by subtle variant features (notch position, arm width, etc.) rather than by rotation alone.\n\n'
      + 'Further reading: Wikipedia — Mental rotation (https://en.wikipedia.org/wiki/Mental_rotation) and Shepard and Metzler (https://en.wikipedia.org/wiki/Mental_rotation#Shepard_and_Metzler).',
    convertScore: (s) => Math.round(s / 10),
    unit: '% correct',
    label: 'Avg accuracy',
    precision: 0,
  },
  'estimation-challenge': {
    title: 'Estimation Challenge — Perceptual Precision',
    about:
      'Each round draws a random task type from five perceptual categories: line length estimation (with a scale bar reference), fill percentage, angle estimation, dot count (2-second exposure then hidden), and a firefly-count simulation (moving luminous dots inside a jar). Each round is scored on a 0–250 point scale for a maximum lab score of 1,000 across four rounds. Estimation of length and angle recruits the intraparietal sulcus (IPS), a region central to numerical and spatial cognition. The dot-count condition with rapid occlusion is a variant of subitising — the ability to enumerate small quantities without counting — which is limited to about four items before serial counting takes over (the subitising range, Kaufman et al., 1949).\n\n'
      + 'Further reading: Wikipedia — Subitizing (https://en.wikipedia.org/wiki/Subitizing) and Approximate number system (https://en.wikipedia.org/wiki/Approximate_number_system).',
    // labScore = sum of 4 round scores (each 0–250) → avgRound = score / 4
    convertScore: (s) => Math.round((s / 4) * 10) / 10,
    unit: '/250 per round',
    label: 'Avg round',
    precision: 1,
  },
  'sequence-memory': {
    title: 'Sequence Memory — Working Memory',
    about:
      'A 3 × 3 grid of colour-coded tiles lights up in sequence. After observing the sequence, you must reproduce it by tapping the tiles in the same order. One new step is added each successful round. The maximum sequence length achieved before the first error reflects the capacity of visuospatial working memory (Baddeley\'s visuospatial sketchpad). The average adult can hold 7 ± 2 items in verbal working memory (Miller, 1956), but visuospatial span is typically lower — about 4–6 items depending on the complexity of each position encoding. Tiles are colour-coded with 9 distinct hues (red through violet), and each tile press triggers a corresponding MIDI note (C4–D6), providing a concurrent auditory encoding channel that may assist performance via cross-modal binding.\n\n'
      + 'Further reading: Wikipedia — Working memory (https://en.wikipedia.org/wiki/Working_memory) and Miller\'s law (https://en.wikipedia.org/wiki/Miller%27s_law).',
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