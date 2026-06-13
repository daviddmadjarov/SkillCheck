import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

function toLeaderboardScore(reactionMs: number) {
  return Math.max(1, 1200 - reactionMs);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.json({ error: 'not-signed-in' }, { status: 401 });
  }

  const body = (await request.json()) as { reactionMs?: number };
  const reactionMs = Math.round(Number(body.reactionMs));

  if (!Number.isFinite(reactionMs) || reactionMs < 50 || reactionMs > 5000) {
    return NextResponse.json({ error: 'invalid-reaction' }, { status: 400 });
  }

  const score = toLeaderboardScore(reactionMs);

  const { error } = await supabase.from('score_submissions').insert({
    attempts: 1,
    category: 'reaction',
    percentile: null,
    score,
    test_slug: 'reaction-time',
    user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: 'save-failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reactionMs, score });
}