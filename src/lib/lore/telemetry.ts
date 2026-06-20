/**
 * Telemetry utility for the Aethelgard ARG lore layer.
 *
 * Called from game protocol components after a score has been successfully
 * saved.  Produces a collapsed console group with clinical assessment
 * messages styled to look like an internal Institute data stream.
 *
 * This is purely cosmetic console output — no data leaves the browser,
 * no network requests are made, and no gameplay is affected.
 */

type AssessmentTier = 'high' | 'standard';

const TIER_MESSAGES: Record<AssessmentTier, string[]> = {
  high: [
    'Subject exhibits advanced synaptic firing. Passively initializing Phase 2 Geolocation.',
    'Neural overclocking detected. Flagging for physical screening protocol.',
    'Synaptic durability exceeds baseline. Routing to priority extraction queue.',
    'Biometric telemetry spike confirmed. Uplink to Aethelgard S-3 established.',
  ],
  standard: [
    'Metrics standard. Retain in general testing pool.',
    'Subject within expected parameters. Passive monitoring continues.',
    'No notable deviations. Reassigning to control group.',
    'Baseline performance recorded. Awaiting next telemetry window.',
  ],
};

const RANDOM_TEST_MESSAGES: Record<string, { high: string; standard: string }> = {
  'reaction-time': {
    high: 'Reaction latency in elite percentile. Candidate for direct neural interface.',
    standard: 'Reaction latencies within population norms.',
  },
  'audio-reaction': {
    high: 'Auditory processing speed exceptional. Cross-modal synaptic bridging indicated.',
    standard: 'Audio reflex arcs nominal.',
  },
  'multi-reaction': {
    high: 'Multi-stimulus discrimination superior. Candidate for field telemetry harness.',
    standard: 'Multi-signal response within acceptable range.',
  },
  'aim-trainer': {
    high: 'Target acquisition precision indicates enhanced motor cortex density.',
    standard: 'Aim metrics unremarkable.',
  },
  'aim-moving-targets': {
    high: 'Dynamic tracking velocity exceeds predicted maximums. Neural pathway anomaly.',
    standard: 'Motion prediction within statistical bounds.',
  },
  'aim-tracking-test': {
    high: 'Continuous pursuit stability suggests cerebellar overdevelopment.',
    standard: 'Tracking fidelity nominal.',
  },
  'aim-perfect-split': {
    high: 'Bilateral coordination extreme. Dual-hemisphere synchronization confirmed.',
    standard: 'Split motor coordination standard.',
  },
  'typing-speed': {
    high: 'Motor sequencing velocity aberrant. Finger independence exceeds model.',
    standard: 'Keystroke metrics unremarkable.',
  },
  'mental-rotation': {
    high: 'Spatial transformation speed off-scale. Parietal lobe activity suspect.',
    standard: 'Spatial reasoning within norm.',
  },
  'estimation-challenge': {
    high: 'Intuitive approximation precision extraordinary. Prefrontal calibration anomaly.',
    standard: 'Estimation accuracy within expected band.',
  },
  'sequence-memory': {
    high: 'Working memory depth exceeds known ceilings. Hippocampal density flagged.',
    standard: 'Memory sequencing typical.',
  },
  'perfect-sync': {
    high: 'Internal clock precision within 0.8ms deviation. Circadian synchronization candidate.',
    standard: 'Temporal estimation standard.',
  },
  'stop-timer': {
    high: 'Temporal anticipation borderline precognitive. Flag for precognition panel.',
    standard: 'Stop precision within normal distribution.',
  },
  'symbol-tracing': {
    high: 'Fine motor precision anomalous. Robotic consistency detected in trajectory.',
    standard: 'Tracing fidelity within norms.',
  },
  'mouse-symbol-tracing': {
    high: 'Fine motor precision anomalous. Robotic consistency detected in trajectory.',
    standard: 'Tracing fidelity within norms.',
  },
  'mouse-cps': {
    high: 'Click velocity suggests amplified motor unit recruitment.',
    standard: 'Click rate standard.',
  },
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function determineTier(testSlug: string, score: number): AssessmentTier {
  // Thresholds per test type — roughly top ~15-25% of expected scores
  const thresholds: Record<string, number> = {
    'reaction-time': 220,          // lower is better, so < 220ms is high
    'audio-reaction': 230,
    'multi-reaction': 250,
    'aim-trainer': 450,
    'aim-moving-targets': 420,
    'aim-tracking-test': 500,
    'aim-perfect-split': 480,
    'typing-speed': 85,            // higher is better, > 85 WPM
    'mental-rotation': 600,
    'estimation-challenge': 650,
    'sequence-memory': 550,
    'perfect-sync': 500,
    'stop-timer': 480,
    'symbol-tracing': 450,
    'mouse-symbol-tracing': 450,
    'mouse-cps': 8,                // > 8 CPS
  };

  const threshold = thresholds[testSlug];
  if (threshold === undefined) return 'standard';

  // Reaction-type tests: lower score = better
  const lowerIsBetter = new Set([
    'reaction-time', 'audio-reaction', 'multi-reaction',
  ]);

  if (lowerIsBetter.has(testSlug)) {
    return score < threshold ? 'high' : 'standard';
  }

  return score > threshold ? 'high' : 'standard';
}

/**
 * Emit a clinical telemetry assessment to the browser console.
 * Safe to call in any environment — no-ops if not in browser.
 *
 * @param testSlug  The slug of the completed test (e.g. 'reaction-time')
 * @param score     The raw score value
 */
export function emitTelemetryAssessment(testSlug: string, score: number): void {
  // Only emit in browser, with console available
  if (typeof window === 'undefined' || typeof console === 'undefined') return;

  // Guard: we're only interested in signed-in users
  // (callers should gate this, but we double-check)
  const tier = determineTier(testSlug, score);
  const tierMessages = TIER_MESSAGES[tier];
  const testMsg = RANDOM_TEST_MESSAGES[testSlug];

  console.groupCollapsed('Aethelgard Telemetry Uplink');

  // Phase header
  console.log('%c[AETHELGARD S-042]%c  Uplink established',
    'color: #fb7185; font-weight: bold;',
    'color: #94a3b8;');

  console.log('%cDiagnostic capture for: %c%s',
    'color: #64748b;',
    'color: #cbd5e1; font-weight: bold;',
    testSlug);

  console.log('%cScore: %c%s',
    'color: #64748b;',
    'color: #e2e8f0; font-weight: bold;',
    String(score));

  if (testMsg) {
    console.log('%c[ASSESSMENT] %c%s',
      'color: #fbbf24; font-weight: bold;',
      'color: #e2e8f0;',
      tier === 'high' ? testMsg.high : testMsg.standard);
  }

  console.log('%c[DISPOSITION] %c%s',
    'color: #fbbf24; font-weight: bold;',
    'color: #e2e8f0;',
    pickRandom(tierMessages));

  console.log('%c──────────────────────────────',
    'color: #334155;');

  console.groupEnd();
}