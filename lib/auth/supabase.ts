import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Request-scoped Supabase Auth client (anon key — subject to RLS, unlike getDb()).
 *
 *  Callers must check isAuthConfigured() first; this asserts the env is present.
 *  Never cache the result across requests — it is bound to one request's cookies.
 *
 *  Route Handlers that write auth cookies MUST pass their response: the library
 *  hands `setAll` no-store headers that have to travel with those cookies, or a CDN
 *  could cache the response and serve one user's tokens to another. Only a response
 *  object can carry a header — the cookies() store cannot. */
export async function createAuthClient(response?: NextResponse): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet, headers) => {
          if (response) {
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
            for (const [key, value] of Object.entries(headers)) {
              response.headers.set(key, value);
            }
            return;
          }
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
            // `headers` is deliberately not applied on this path, rather than
            // forgotten: it is reachable only from a Server Component (where the
            // set above throws, so no cookie is written either) or a Server Action,
            // whose POST response no CDN caches. Cookie-writing routes pass a
            // response and get the headers.
          } catch {
            // Server Components can't write cookies. Token refresh is the proxy's
            // job, so dropping the write here is correct rather than an error.
          }
        },
      },
    },
  );
}
