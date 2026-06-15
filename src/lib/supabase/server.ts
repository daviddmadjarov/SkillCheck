import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getSupabaseEnv } from '@/lib/supabase/config';
import type { Database } from '@/lib/supabase/types';

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In Route Handlers / API routes, cookies can be set directly.
        // In Server Components during render, this may throw — we catch
        // and let the middleware handle cookie refresh instead.
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Cookie write not possible during render.
            // The middleware will handle cookie refresh on the next request.
          }
        }
      },
    },
  });
}
