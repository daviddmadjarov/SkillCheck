import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

function buildRedirect(requestUrl: URL, profile: string, reason?: string) {
  const url = new URL('/', requestUrl.origin);
  url.searchParams.set('profile', profile);

  if (reason) {
    url.searchParams.set('reason', reason);
  }

  return url;
}

function normalizeUsername(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function validateUsername(username: string) {
  if (username.length < 3) {
    return 'too-short';
  }

  if (username.length > 24) {
    return 'too-long';
  }

  if (!/^[A-Za-z0-9 _-]+$/.test(username)) {
    return 'invalid-characters';
  }

  return null;
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const formData = await request.formData();
  const username = normalizeUsername(String(formData.get('username') ?? ''));

  const validationError = validateUsername(username);

  if (validationError) {
    return NextResponse.redirect(buildRedirect(requestUrl, 'username-error', validationError));
  }

  const supabase = await createClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.redirect(buildRedirect(requestUrl, 'username-error', 'not-signed-in'));
  }

  const { error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', user.id);

  if (error) {
    const reason = error.code === '23505' ? 'username-taken' : 'request-failed';
    return NextResponse.redirect(buildRedirect(requestUrl, 'username-error', reason));
  }

  return NextResponse.redirect(buildRedirect(requestUrl, 'username-updated'));
}