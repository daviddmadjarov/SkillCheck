import { NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

type OAuthProvider = 'google' | 'discord';

function isOAuthProvider(value: string | null): value is OAuthProvider {
  return value === 'google' || value === 'discord';
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const provider = requestUrl.searchParams.get('provider');

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL('/?setup=supabase', requestUrl.origin));
  }

  if (!isOAuthProvider(provider)) {
    return NextResponse.redirect(new URL('/', requestUrl.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: new URL('/auth/callback', requestUrl.origin).toString(),
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL('/', requestUrl.origin));
  }

  return NextResponse.redirect(data.url);
}