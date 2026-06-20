export type MultiplayerGame = {
  category: 'reaction' | 'aim' | 'typing' | 'mouse' | 'rhythm' | 'thinking';
  description: string;
  href: string;
  label: string;
  slug: string;
};

export type MultiplayerGameConfig = Record<string, string>;

export type MultiplayerGameSelection = {
  config: MultiplayerGameConfig;
  slug: string;
};

export const MULTIPLAYER_GAME_POOL: MultiplayerGame[] = [
  {
    category: 'reaction',
    description: 'Single stimulus reaction time.',
    href: '/category/reaction?mode=time',
    label: 'Reaction Time',
    slug: 'reaction-time',
  },
  {
    category: 'reaction',
    description: 'Reaction after audio cue.',
    href: '/category/reaction?mode=audio',
    label: 'Audio Reaction',
    slug: 'audio-reaction',
  },
  {
    category: 'reaction',
    description: 'Hit the matching reaction button.',
    href: '/category/reaction?mode=multi',
    label: 'Multi-Reaction',
    slug: 'multi-reaction',
  },
  {
    category: 'aim',
    description: 'Static target precision drill.',
    href: '/category/aim?mode=trainer',
    label: 'Aim Trainer',
    slug: 'aim-trainer',
  },
  {
    category: 'aim',
    description: 'Moving target tracking challenge.',
    href: '/category/aim?mode=moving',
    label: 'Moving Targets',
    slug: 'aim-moving-targets',
  },
  {
    category: 'mouse',
    description: 'High-control tracking test.',
    href: '/category/mouse?mode=tracking',
    label: 'Tracking Test',
    slug: 'aim-tracking-test',
  },
  {
    category: 'aim',
    description: 'Balance the split shape precisely.',
    href: '/category/aim?mode=split',
    label: 'Perfect Split',
    slug: 'aim-perfect-split',
  },
  {
    category: 'typing',
    description: 'Timed typing sprint.',
    href: '/category/typing',
    label: 'Typing Speed',
    slug: 'typing-speed',
  },
  {
    category: 'mouse',
    description: 'Symbol tracing accuracy.',
    href: '/category/mouse?mode=symbol',
    label: 'Symbol Tracing',
    slug: 'mouse-symbol-tracing',
  },
  {
    category: 'mouse',
    description: 'Click throughput sprint.',
    href: '/category/mouse?mode=cps',
    label: 'Click Speed',
    slug: 'mouse-cps',
  },
  {
    category: 'rhythm',
    description: 'Reflex ring-tracking game with escalating speed.',
    href: '/category/rhythm?mode=overclock',
    label: 'Overclock',
    slug: 'overclock',
  },
  // ── Rhythm ──
  {
    category: 'rhythm',
    description: 'Listen and guess the BPM of a short groove.',
    href: '/category/rhythm?mode=sync',
    label: 'Sync Test',
    slug: 'perfect-sync',
  },
  {
    category: 'rhythm',
    description: 'Stop the timer exactly on a hidden target.',
    href: '/category/rhythm?mode=timer',
    label: 'Stop the Timer',
    slug: 'stop-timer',
  },
  // ── Thinking / Cognitive ──
  {
    category: 'thinking',
    description: 'Identify the correctly rotated shape.',
    href: '/category/thinking?mode=rotation',
    label: 'Mental Rotation',
    slug: 'mental-rotation',
  },
  {
    category: 'thinking',
    description: 'Estimate length, angle, percentage, or count.',
    href: '/category/thinking?mode=estimation',
    label: 'Estimation Challenge',
    slug: 'estimation-challenge',
  },
  {
    category: 'thinking',
    description: 'Remember the 3×3 grid sequence.',
    href: '/category/thinking?mode=sequence',
    label: 'Sequence Memory',
    slug: 'sequence-memory',
  },
];

/**
 * Duel-specific game pool — excludes "Sequence Memory".
 */
export const DUEL_GAME_POOL: MultiplayerGame[] = MULTIPLAYER_GAME_POOL.filter(
  (game) => game.slug !== 'sequence-memory',
);

const SLUG_TO_INDEX = new Map(MULTIPLAYER_GAME_POOL.map((game, index) => [game.slug, index] as const));

export function getMultiplayerGame(slug: string) {
  return MULTIPLAYER_GAME_POOL.find((game) => game.slug === slug) ?? null;
}

export function getMultiplayerGamesBySlug(slugs: string[]) {
  return slugs
    .map((slug) => getMultiplayerGame(slug))
    .filter((game): game is MultiplayerGame => game !== null);
}

export function getRandomMultiplayerGames(count: number) {
  const indices = MULTIPLAYER_GAME_POOL.map((_, index) => index);

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.slice(0, Math.min(count, indices.length)).map((index) => MULTIPLAYER_GAME_POOL[index]);
}

/**
 * Picks random games from the duel-specific pool (no Sequence Memory).
 */
export function getRandomDuelGames(count: number) {
  const indices = DUEL_GAME_POOL.map((_, index) => index);

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.slice(0, Math.min(count, indices.length)).map((index) => DUEL_GAME_POOL[index]);
}

export function shuffleMultiplayerGames(games: MultiplayerGame[]) {
  const next = [...games];

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

export function getMultiplayerGameIndex(slug: string) {
  return SLUG_TO_INDEX.get(slug) ?? -1;
}

export function createLobbyCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

export function serializeMultiplayerSelection(slug: string, config?: MultiplayerGameConfig) {
  if (!config) {
    return slug;
  }

  const filteredEntries = Object.entries(config).filter(([, value]) => typeof value === 'string' && value.trim().length > 0);
  if (filteredEntries.length === 0) {
    return slug;
  }

  const params = new URLSearchParams();
  filteredEntries.forEach(([key, value]) => {
    params.set(key, value);
  });

  const query = params.toString();
  return query.length > 0 ? `${slug}?${query}` : slug;
}

export function parseMultiplayerSelectionToken(token: string): MultiplayerGameSelection {
  const [slugPart, queryPart] = token.split('?');
  const slug = slugPart ?? token;

  if (!queryPart) {
    return { config: {}, slug };
  }

  const params = new URLSearchParams(queryPart);
  const config: MultiplayerGameConfig = {};
  for (const [key, value] of params.entries()) {
    config[key] = value;
  }

  return { config, slug };
}

export function buildMultiplayerSessionHref(
  selection: MultiplayerGameSelection,
  options: {
    lobbyCode: string;
    playerId: string;
    round: number;
    /** 'duel' or 'party' — adds a mode query param for client-side disambiguation */
    mode?: string;
  },
) {
  const game = getMultiplayerGame(selection.slug);
  if (!game) {
    return null;
  }

  const url = new URL(game.href, 'http://localhost');

  Object.entries(selection.config).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      url.searchParams.set(key, value);
    }
  });

  url.searchParams.set('game', selection.slug);
  url.searchParams.set('lobby', options.lobbyCode);
  url.searchParams.set('player', options.playerId);
  url.searchParams.set('round', String(Math.max(0, options.round)));

  if (options.mode) {
    url.searchParams.set('mp_mode', options.mode);
  }

  return `${url.pathname}${url.search}`;
}