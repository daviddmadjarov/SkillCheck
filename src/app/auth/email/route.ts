export const dynamic = 'force-static';
import { NextResponse } from 'next/server';

import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

function buildRedirect(requestUrl: URL, auth: string, reason?: string) {
  const url = new URL('/', requestUrl.origin);
  url.searchParams.set('auth', auth);

  if (reason) {
    url.searchParams.set('reason', reason);
  }

  return url;
}

function mapEmailAuthError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('invalid')) {
    return 'invalid-email';
  }

  if (normalizedMessage.includes('rate limit')) {
    return 'rate-limited';
  }

  if (normalizedMessage.includes('email provider')) {
    return 'provider-disabled';
  }

  return 'request-failed';
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);

  if (!hasSupabaseEnv()) {
    return NextResponse.redirect(new URL('/?setup=supabase', requestUrl.origin));
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    return NextResponse.redirect(buildRedirect(requestUrl, 'email-error', 'missing-email'));
  }

  if (!email.includes('@')) {
    return NextResponse.redirect(buildRedirect(requestUrl, 'email-error', 'invalid-email'));
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: new URL('/auth/callback', requestUrl.origin).toString(),
    },
  });

  if (error) {
    return NextResponse.redirect(
      buildRedirect(requestUrl, 'email-error', mapEmailAuthError(error.message)),
    );
  }

  return NextResponse.redirect(buildRedirect(requestUrl, 'email-sent'));
}