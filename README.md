# SkillBench

SkillBench is a playful human-performance laboratory built with Next.js, TypeScript, Tailwind CSS and Supabase. The current slice focuses on two backend concerns first: authentication and a shared leaderboard.

## Local Setup

1. Install dependencies.
2. Copy .env.example to .env.local.
3. Add your Supabase project URL and publishable key.
4. Run the SQL in supabase/leaderboard-schema.sql inside the Supabase SQL editor.
5. Enable Google and Discord providers in Supabase Auth.
6. Add http://localhost:3000/auth/callback to the allowed redirect URLs.
7. Start the app with npm run dev.

## Supabase Integration

- Cookie-based SSR auth is configured through @supabase/ssr.
- proxy.ts refreshes auth state for App Router requests.
- OAuth login routes are available at /auth/login?provider=google and /auth/login?provider=discord.
- Magic-link login posts to /auth/email.
- OAuth and email callbacks resolve through /auth/callback.
- Logout posts to /auth/signout.

## Database Surface

The first database slice adds:

- public.profiles for public player identity
- public.score_submissions for stored test results
- public.leaderboard_profiles as a ranking view for the homepage leaderboard

## Current Status

The homepage now reads auth state and attempts to load the leaderboard server-side. If Supabase is not configured yet, the UI falls back to setup instructions instead of crashing.
