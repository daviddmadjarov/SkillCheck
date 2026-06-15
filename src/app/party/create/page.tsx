'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, PartyPopper, Settings2, Users2 } from 'lucide-react';

import { MULTIPLAYER_GAME_POOL } from '@/lib/multiplayer/catalog';

const INITIAL_SELECTION = MULTIPLAYER_GAME_POOL.slice(0, 4).map((game) => game.slug);

type GameOptionChoice = {
  label: string;
  value: string;
};

type GameOptionDefinition = {
  choices: GameOptionChoice[];
  defaultValue: string;
  key: string;
  label: string;
};

const GAME_OPTIONS: Record<string, GameOptionDefinition[]> = {
  'mouse-cps': [
    {
      choices: [
        { label: '5s', value: '5' },
        { label: '10s', value: '10' },
        { label: '15s', value: '15' },
      ],
      defaultValue: '10',
      key: 'duration',
      label: 'Duration',
    },
  ],
  'mouse-symbol-tracing': [
    {
      choices: [
        { label: 'Trace Assist', value: 'assist' },
        { label: 'Memory Trace', value: 'memory' },
      ],
      defaultValue: 'assist',
      key: 'traceMode',
      label: 'Trace Mode',
    },
  ],
  'typing-speed': [
    {
      choices: [
        { label: '30s', value: '30' },
        { label: '60s', value: '60' },
      ],
      defaultValue: '30',
      key: 'duration',
      label: 'Duration',
    },
    {
      choices: [
        { label: 'English', value: 'english' },
        { label: 'Deutsch', value: 'german' },
        { label: 'Espanol', value: 'spanish' },
      ],
      defaultValue: 'english',
      key: 'language',
      label: 'Language',
    },
  ],
};

const INITIAL_GAME_CONFIGS = Object.fromEntries(
  Object.entries(GAME_OPTIONS).map(([slug, definitions]) => [
    slug,
    Object.fromEntries(definitions.map((definition) => [definition.key, definition.defaultValue])),
  ]),
) as Record<string, Record<string, string>>;

function formatGameConfigSummary(slug: string, config: Record<string, string>) {
  const definitions = GAME_OPTIONS[slug] ?? [];
  if (definitions.length === 0) {
    return null;
  }

  const parts = definitions
    .map((definition) => {
      const selected = definition.choices.find((choice) => choice.value === config[definition.key]);
      return selected ? `${definition.label}: ${selected.label}` : null;
    })
    .filter((value): value is string => value !== null);

  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function CreatePartyPage() {
  const router = useRouter();
  const [selectedGames, setSelectedGames] = useState<string[]>(INITIAL_SELECTION);
  const [gameConfigs, setGameConfigs] = useState<Record<string, Record<string, string>>>(INITIAL_GAME_CONFIGS);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const selectedCount = selectedGames.length;
  const selectedGameDetails = useMemo(
    () => MULTIPLAYER_GAME_POOL.filter((game) => selectedGames.includes(game.slug)),
    [selectedGames],
  );

  function toggleGame(slug: string) {
    setSelectedGames((current) =>
      current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug],
    );
  }

  function updateGameOption(slug: string, key: string, value: string) {
    setGameConfigs((current) => ({
      ...current,
      [slug]: {
        ...(current[slug] ?? {}),
        [key]: value,
      },
    }));
  }

  async function handleCreateParty() {
    setIsCreating(true);
    setError(null);

    const activeGameConfigs = Object.fromEntries(
      selectedGames.map((slug) => [slug, gameConfigs[slug] ?? {}]),
    );

    try {
      const response = await fetch('/api/multiplayer/party', {
        body: JSON.stringify({ gameConfigs: activeGameConfigs, maxPlayers, selectedGames }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;

      if (!response.ok || !payload?.url) {
        setError(payload?.error ?? 'Could not create a party lobby.');
        return;
      }

      router.push(payload.url);
    } catch {
      setError('Could not create a party lobby.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-[2rem] border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-6 shadow-[0_8px_0_rgba(165,243,252,1)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl space-y-4">
              <p className="status-pill">Create Party</p>
              <h1 className="force-dark-black text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">
                Build a private room.
              </h1>
              <p className="max-w-xl text-base font-medium leading-7 text-slate-600">
                Pick the games you want, choose the room size, then create a code-based lobby that friends can join.
              </p>
            </div>

            <a
              className="rounded-2xl border-2 border-slate-800 bg-slate-800 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(15,23,42,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-slate-700 hover:shadow-[0_8px_0_rgba(15,23,42,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(15,23,42,1)]"
              href="/"
            >
              Return to Lab
            </a>

            <div className="grid w-full gap-3 sm:min-w-[16rem] sm:w-auto">
              <div className="rounded-[1.4rem] border-2 border-white bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <PartyPopper className="h-4 w-4 text-cyan-500" />
                  <span className="text-sm font-bold">Lobby type</span>
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Custom party with selectable games and a shareable code.</p>
              </div>
              <div className="rounded-[1.4rem] border-2 border-white bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <Users2 className="h-4 w-4 text-rose-500" />
                  <span className="text-sm font-bold">Capacity</span>
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Set anywhere from 2 to 10 players.</p>
              </div>
              <div className="rounded-[1.4rem] border-2 border-white bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <Settings2 className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-bold">Selection</span>
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">You currently have {selectedCount} games picked.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-3 rounded-full border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
              Max players
              <select
                className="bg-transparent text-base font-black outline-none"
                value={maxPlayers}
                onChange={(event) => setMaxPlayers(Number(event.target.value))}
              >
                {[2, 3, 4, 5, 6, 8, 10].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-2xl border-2 border-cyan-700 bg-cyan-500 px-6 py-3 font-bold text-white shadow-[0_4px_0_rgba(14,116,144,1)] transition-all duration-150 hover:-translate-y-1 hover:bg-cyan-400 hover:shadow-[0_8px_0_rgba(14,116,144,1)] active:translate-y-1 active:shadow-[0_0px_0_rgba(14,116,144,1)]"
              disabled={isCreating}
              onClick={handleCreateParty}
              type="button"
            >
              {isCreating ? 'Creating lobby…' : 'Create Party'}
            </button>
            <a className="lab-button-secondary w-full text-center sm:w-auto" href="/duell">
              Go to Duel
            </a>
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {MULTIPLAYER_GAME_POOL.map((game) => {
            const active = selectedGames.includes(game.slug);

            return (
              <button
                key={game.slug}
                type="button"
                onClick={() => toggleGame(game.slug)}
                className={`rounded-[1.6rem] border-2 p-4 text-left shadow-[0_6px_0_rgba(226,232,240,1)] transition hover:-translate-y-0.5 ${
                  active
                    ? 'border-cyan-200 bg-cyan-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{game.category}</p>
                    <h2 className="mt-2 text-xl font-black text-slate-800">{game.label}</h2>
                  </div>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${active ? 'border-cyan-200 bg-cyan-100 text-cyan-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                    <Check className={`h-4 w-4 ${active ? 'opacity-100' : 'opacity-0'}`} />
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-500">{game.description}</p>

                {active && (GAME_OPTIONS[game.slug]?.length ?? 0) > 0 ? (
                  <div className="mt-4 grid gap-2">
                    {GAME_OPTIONS[game.slug].map((option) => (
                      <label
                        key={`${game.slug}-${option.key}`}
                        className="flex items-center justify-between gap-3 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                        onPointerDown={(e) => {
                          // Stop propagation on pointerdown (fires before click) to
                          // prevent the parent button's toggleGame from toggling selection
                          // when interacting with configuration controls
                          e.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>{option.label}</span>
                        <select
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700"
                          value={gameConfigs[game.slug]?.[option.key] ?? option.defaultValue}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(event) => updateGameOption(game.slug, option.key, event.target.value)}
                        >
                          {option.choices.map((choice) => (
                            <option key={choice.value} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </section>

        <section className="rounded-[1.6rem] border-2 border-slate-200 bg-white p-5 shadow-[0_6px_0_rgba(226,232,240,1)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Selected Games</p>
          <div className="mt-2 space-y-1 text-sm font-medium leading-6 text-slate-500">
            {selectedGameDetails.length > 0 ? (
              selectedGameDetails.map((game) => {
                const configSummary = formatGameConfigSummary(game.slug, gameConfigs[game.slug] ?? {});

                return (
                  <p key={`summary-${game.slug}`}>
                    {game.label}{configSummary ? ` - ${configSummary}` : ''}
                  </p>
                );
              })
            ) : (
              <p>No games selected yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
