import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** True when Supabase env is present. When false, the app still boots and reads
 *  degrade to empty — only persistence (creating/saving) requires configuration. */
export function isDbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

/** Server-side Supabase client (service role; bypasses RLS). Null if unconfigured. */
export function getDb(): SupabaseClient | null {
  if (!isDbConfigured()) return null;
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Get the client or throw a friendly error — use for mutations that require DB. */
export function requireDb(): SupabaseClient {
  const db = getDb();
  if (!db) {
    throw new Error(
      "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to save your work.",
    );
  }
  return db;
}
