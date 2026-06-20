-- Daily Challenge System
-- Tracks one attempt per user per day for the daily challenge.

create table if not exists public.daily_challenge_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_slug text not null,
  score numeric not null,
  challenge_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_date)
);

alter table public.daily_challenge_log enable row level security;

drop policy if exists "daily challenge log is readable by everyone" on public.daily_challenge_log;
create policy "daily challenge log is readable by everyone"
  on public.daily_challenge_log
  for select
  using (true);

drop policy if exists "users can insert their own daily challenge entry" on public.daily_challenge_log;
create policy "users can insert their own daily challenge entry"
  on public.daily_challenge_log
  for insert
  with check (auth.uid() = user_id);

notify pgrst, 'reload schema';