import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { getSupabaseEnv } from '@/lib/supabase/config';
import type { Database } from '@/lib/supabase/types';

export function hasSupabaseServiceRoleEnv() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Set it in the server environment for privileged multiplayer operations.',
    );
  }

  return serviceRoleKey;
}

export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
