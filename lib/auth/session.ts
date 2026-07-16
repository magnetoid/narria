import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_UID_COOKIE, isAuthConfigured } from "@/lib/auth/config";
import { createAuthClient } from "@/lib/auth/supabase";
import { DEV_USER_ID } from "@/lib/constants";

export interface SessionUser {
  id: string;
  email: string | null;
  /** True when the app runs unconfigured: an ephemeral workspace, not an account. */
  isDemo: boolean;
}

/**
 * THE identity seam. This is the only place in the app that knows whether real
 * auth is configured — everything else just asks who the user is. Keeping the
 * branch here is what lets the zero-setup demo and a real SaaS share one codebase.
 *
 * Returns null only in real mode when signed out. Demo mode always resolves, so
 * an unconfigured deployment never sees a login.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isAuthConfigured()) {
    const store = await cookies();
    // The proxy mints this per visitor. It is absent during build-time prerender,
    // where DEV_USER_ID keeps the shared workspace readable.
    const id = store.get(DEMO_UID_COOKIE)?.value || DEV_USER_ID;
    return { id, email: null, isDemo: true };
  }

  const supabase = await createAuthClient();
  // getUser() revalidates the JWT with Supabase. getSession() only decodes the
  // cookie, which the client controls, so it must never gate access on its own.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null, isDemo: false };
});

/** Page-level guard: resolves in demo mode, redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Owner for a write. Throws rather than redirecting: server actions catch errors
 *  into `{ error }`, and a redirect thrown here would be swallowed by that catch.
 *  A write must never fall back to a shared id, so there is no default. */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Sign in to save your work.");
  return user.id;
}
