export const dynamic = 'force-static';
import { NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin));
}