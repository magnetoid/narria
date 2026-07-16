import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Request-scoped Supabase Auth client (anon key — subject to RLS, unlike getDb()).
 *
 *  Callers must check isAuthConfigured() first; this asserts the env is present.
 *  Never cache the result across requests — it is bound to one request's cookies. */
export async function createAuthClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
          } catch {
            // Server Components can't write cookies. Token refresh is the proxy's
            // job, so dropping the write here is correct rather than an error.
          }
        },
      },
    },
  );
}
