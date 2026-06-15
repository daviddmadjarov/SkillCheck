create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 24),
  avatar_url text,
  skill_level text not null default 'Candidate',
  created_at timestamptz not null default now()
);

create table if not exists public.score_submissions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  test_slug text not null,
  score numeric not null,
  percentile numeric,
  attempts integer not null default 1,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace view public.leaderboard_profiles
with (security_invoker=true) as
with best_per_bucket as (
  select
    s.user_id,
    case
      when s.test_slug like 'typing-speed%' then 'typing-speed'
      when s.test_slug like 'mouse-symbol-tracing%' then 'mouse-symbol-tracing'
      when s.test_slug like 'symbol-tracing%' then 'mouse-symbol-tracing'
      else s.test_slug
    end as score_bucket,
    max(s.score)::int as best_score
  from public.score_submissions s
  where
    s.test_slug in (
      'reaction-time',
      'audio-reaction',
      'multi-reaction',
      'aim-trainer',
      'aim-moving-targets',
      'aim-tracking-test',
      'aim-perfect-split',
      'mental-rotation',
      'estimation-challenge',
      'sequence-memory',
      'perfect-sync',
      'stop-timer',
      'symbol-tracing',
      'mouse-cps'
    )
    or s.test_slug like 'typing-speed%'
    or s.test_slug like 'mouse-symbol-tracing%'
    or s.test_slug like 'symbol-tracing%'
  group by
    s.user_id,
    case
      when s.test_slug like 'typing-speed%' then 'typing-speed'
      when s.test_slug like 'mouse-symbol-tracing%' then 'mouse-symbol-tracing'
      when s.test_slug like 'symbol-tracing%' then 'mouse-symbol-tracing'
      else s.test_slug
    end
),
aggregated as (
  select
    user_id,
    coalesce(sum(best_score), 0)::int as overall_score,
    count(*)::int as tests_completed
  from best_per_bucket
  group by user_id
)
select
  p.id as user_id,
  p.username,
  p.avatar_url,
  coalesce(a.overall_score, 0) as overall_score,
  coalesce(a.tests_completed, 0) as tests_completed,
  dense_rank() over (
    order by coalesce(a.overall_score, 0) desc, p.created_at asc
  )::int as rank
from public.profiles p
left join aggregated a on a.user_id = p.id;

alter table public.profiles enable row level security;
alter table public.score_submissions enable row level security;

drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles
  for select
  using (true);

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "scores are readable by everyone" on public.score_submissions;
create policy "scores are readable by everyone"
  on public.score_submissions
  for select
  using (true);

drop policy if exists "users can insert their own scores" on public.score_submissions;
create policy "users can insert their own scores"
  on public.score_submissions
  for insert
  with check (auth.uid() = user_id);

create table if not exists public.multiplayer_lobbies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('duel', 'party')),
  status text not null default 'lobby' check (status in ('waiting', 'lobby', 'live', 'finished')),
  max_players integer not null default 10 check (max_players between 2 and 10),
  selected_games text[] not null default '{}'::text[],
  game_order text[] not null default '{}'::text[],
  current_game_index integer not null default 0,
  winner_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.multiplayer_lobby_players (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.multiplayer_lobbies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  seat_index integer,
  is_ready boolean not null default false,
  score_total integer not null default 0,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (lobby_id, user_id)
);

create table if not exists public.multiplayer_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  queue_type text not null default 'duel' check (queue_type = 'duel'),
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled')),
  matched_code text,
  requested_at timestamptz not null default now()
);

create table if not exists public.multiplayer_duel_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.multiplayer_game_results (
  id uuid primary key default gen_random_uuid(),
  lobby_code text not null references public.multiplayer_lobbies (code) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  player_id uuid references public.multiplayer_lobby_players (id) on delete set null,
  game_slug text not null,
  score integer not null,
  position integer,
  submitted_at timestamptz not null default now()
);

alter table public.multiplayer_lobbies enable row level security;
alter table public.multiplayer_lobby_players enable row level security;
alter table public.multiplayer_queue enable row level security;
alter table public.multiplayer_duel_queue enable row level security;
alter table public.multiplayer_game_results enable row level security;

drop policy if exists "multiplayer lobbies are readable by everyone" on public.multiplayer_lobbies;
create policy "multiplayer lobbies are readable by everyone"
  on public.multiplayer_lobbies
  for select
  using (true);

drop policy if exists "hosts can create multiplayer lobbies" on public.multiplayer_lobbies;
create policy "hosts can create multiplayer lobbies"
  on public.multiplayer_lobbies
  for insert
  with check (auth.uid() = host_id);

drop policy if exists "hosts can update multiplayer lobbies" on public.multiplayer_lobbies;
create policy "hosts can update multiplayer lobbies"
  on public.multiplayer_lobbies
  for update
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

drop policy if exists "multiplayer lobby players are readable by everyone" on public.multiplayer_lobby_players;
create policy "multiplayer lobby players are readable by everyone"
  on public.multiplayer_lobby_players
  for select
  using (true);

drop policy if exists "users can join multiplayer lobbies" on public.multiplayer_lobby_players;
create policy "users can join multiplayer lobbies"
  on public.multiplayer_lobby_players
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update their multiplayer lobby row" on public.multiplayer_lobby_players;
create policy "users can update their multiplayer lobby row"
  on public.multiplayer_lobby_players
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "hosts can seat players" on public.multiplayer_lobby_players;
create policy "hosts can seat players"
  on public.multiplayer_lobby_players
  for insert
  with check (
    exists (
      select 1
      from public.multiplayer_lobbies l
      where l.id = lobby_id and l.host_id = auth.uid()
    )
  );

drop policy if exists "duel queue is readable by authenticated users" on public.multiplayer_queue;
create policy "duel queue is readable by authenticated users"
  on public.multiplayer_queue
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can queue themselves" on public.multiplayer_queue;
create policy "users can queue themselves"
  on public.multiplayer_queue
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update their queue row" on public.multiplayer_queue;
create policy "users can update their queue row"
  on public.multiplayer_queue
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "duel queue is readable by authenticated users" on public.multiplayer_duel_queue;
create policy "duel queue is readable by authenticated users"
  on public.multiplayer_duel_queue
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can queue themselves for duels" on public.multiplayer_duel_queue;
create policy "users can queue themselves for duels"
  on public.multiplayer_duel_queue
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update their duel queue row" on public.multiplayer_duel_queue;
create policy "users can update their duel queue row"
  on public.multiplayer_duel_queue
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "authenticated users can clear duel queue rows" on public.multiplayer_duel_queue;
create policy "authenticated users can clear duel queue rows"
  on public.multiplayer_duel_queue
  for delete
  using (auth.role() = 'authenticated');

drop policy if exists "multiplayer results are readable by everyone" on public.multiplayer_game_results;
create policy "multiplayer results are readable by everyone"
  on public.multiplayer_game_results
  for select
  using (true);

drop policy if exists "users can submit multiplayer results" on public.multiplayer_game_results;
create policy "users can submit multiplayer results"
  on public.multiplayer_game_results
  for insert
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';