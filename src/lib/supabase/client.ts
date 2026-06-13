'use client';

import { createBrowserClient } from '@supabase/ssr';

import { getSupabaseEnv } from '@/lib/supabase/config';
import type { Database } from '@/lib/supabase/types';

export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();

  return createBrowserClient<Database>(url, publishableKey);
}