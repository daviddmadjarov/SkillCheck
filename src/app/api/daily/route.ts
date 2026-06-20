import { NextResponse } from 'next/server';

import { MULTIPLAYER_GAME_POOL } from '@/lib/multiplayer/catalog';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

/**
 * Returns a deterministic game slug for today's challenge based on the UTC date.
 */
function getDailyGameSlug(): string {
  const now = new Date();
  const utcDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
  const hash = Array.from(utcDate).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  const pool = MULTIPLAYER_GAME_POOL;
  const index = ((hash % pool.length) + pool.length) % pool.length;
  return pool[index].slug;
}

function getUtcDateString(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

export async function GET() {
  const gameSlug = getDailyGameSlug();
  const game = MULTIPLAYER_GAME_POOL.find((g) => g.slug === gameSlug);

  if (!game) {
    return NextResponse.json({ error: 'No game available for today.' }, { status: 500 });
  }

  const challengeDate = getUtcDateString();

  // Check if the current user has already submitted a score for today
  let userEntry: { score: number } | null = null;

  if (hasSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const { data: userResult } = await supabase.auth.getUser();
      const user = userResult?.user;

      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase.from('daily_challenge_log' as any) as any)
          .select('score')
          .eq('user_id', user.id)
          .eq('challenge_date', challengeDate)
          .maybeSingle() as { data: { score: number } | null };

        userEntry = data;
      }
    } catch {
      // Silently handle — guest users can still see the daily challenge
    }
  }

  return NextResponse.json({
    date: challengeDate,
    gameSlug: game.slug,
    gameLabel: game.label,
    gameDescription: game.description,
    gameCategory: game.category,
    gameHref: game.href,
    completed: userEntry !== null,
    userScore: userEntry?.score ?? null,
  });
}