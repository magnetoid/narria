import "server-only";
import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isAuthConfigured } from "@/lib/auth/config";
import { createAuthClient } from "@/lib/auth/supabase";

let cachedAdmin: SupabaseClient | null = null;

/** True when Supabase env is present. When false, the app still boots and reads
 *  degrade to empty — only persistence (creating/saving) requires configuration. */
export function isDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

/** cache() and not a module variable: this client carries one user's JWT, so a
 *  module-level cache would hand the first request's identity to every later one.
 *  cache() is per-request, which is exactly the client's lifetime. */
const getUserDb = cache(async (): Promise<SupabaseClient> => createAuthClient());

/** The client for anything a user asked for. Null if unconfigured (memory-store path).
 *
 *  When auth is configured this is the anon key plus the caller's JWT, so Postgres
 *  enforces the RLS policies in 0003 — the repositories' .eq("user_id", …) filters
 *  become the second lock rather than the only one. Must be awaited per request;
 *  never hoisted into a module variable. */
export async function getDb(): Promise<SupabaseClient | null> {
  if (isAuthConfigured()) return getUserDb();
  // No anon key ⇒ no sign-in. getSessionUser() already refuses the one config
  // where that would be ambiguous (URL + service-role, no anon key) before any
  // repository can reach this function — every repository resolves identity
  // through getSessionUser() first, so a call that would want the service-role
  // client here has already thrown. Nothing configured is the only way to arrive,
  // and that means the memory store.
  return null;
}

/** Service-role client: bypasses RLS, belongs to no user, module-cached because it
 *  is identical for every request. Reserved for writes that must not depend on a
 *  user's token — see logGeneration(). Never use it to serve a user's request. */
export function getAdminDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // No anon-key fallback: a client without the service role cannot write the rows
  // this client exists to write, and would fail at the policy instead of here.
  if (!url || !key) return null;
  if (cachedAdmin) return cachedAdmin;
  cachedAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAdmin;
}

/** Get the client or throw a friendly error — use for mutations that require DB. */
export async function requireDb(): Promise<SupabaseClient> {
  const db = await getDb();
  if (!db) {
    // The anon key is named because URL + SUPABASE_SERVICE_ROLE_KEY is no longer a
    // working pair: it stores rows durably while leaving no way to sign in, so
    // getSessionUser() refuses it outright. Sending an operator back with only the
    // two keys this message used to name would strand them on that config.
    throw new Error(
      "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (and SUPABASE_SERVICE_ROLE_KEY) to save your work.",
    );
  }
  return db;
}
