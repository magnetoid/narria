"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/lib/auth/config";
import { createAuthClient } from "@/lib/auth/supabase";
import { emailSchema, oauthProviderSchema } from "@/lib/validation";
import { SITE } from "@/lib/constants";

const NOT_CONFIGURED =
  "Sign-in isn't configured on this deployment — it runs as a demo workspace.";

/** Hosts this deployment answers on. `SITE.url` follows NEXT_PUBLIC_SITE_URL, so a
 *  preview deployment declares itself there rather than by trusting a header. */
function isAllowedOriginHost(host: string, hostname: string): boolean {
  if (host === new URL(SITE.url).host) return true;
  // Dev only: the local port varies, and outside development a request claiming to
  // be localhost is a forgery, not a developer.
  return (
    process.env.NODE_ENV !== "production" &&
    (hostname === "localhost" || hostname === "127.0.0.1")
  );
}

/** Where Supabase should send the user back to — i.e. where a sign-in token gets
 *  delivered. The `origin` header is attacker-controlled: a forged one would mail
 *  the victim a genuine link pointing at the attacker's host, who then redeems the
 *  token. So the header is honoured only for a host we own; anything else falls
 *  back to the canonical URL. The Supabase redirect allow-list is a second line of
 *  defence, not this one — wildcard preview entries make it porous. */
async function getOrigin(): Promise<string> {
  const origin = (await headers()).get("origin");
  if (!origin) return SITE.url;
  try {
    const url = new URL(origin);
    const httpScheme = url.protocol === "http:" || url.protocol === "https:";
    if (httpScheme && isAllowedOriginHost(url.host, url.hostname)) return url.origin;
  } catch {
    // Unparseable header — treat exactly like a hostile one.
  }
  return SITE.url;
}

export async function signInWithMagicLink(
  email: string,
): Promise<{ error: string } | { ok: true }> {
  if (!isAuthConfigured()) return { error: NOT_CONFIGURED };

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: "Enter a valid email address." };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${await getOrigin()}/auth/confirm` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function signInWithOAuth(
  provider: "google" | "github",
): Promise<{ error: string } | void> {
  if (!isAuthConfigured()) return { error: NOT_CONFIGURED };

  const parsed = oauthProviderSchema.safeParse(provider);
  if (!parsed.success) return { error: "Unsupported sign-in provider." };

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsed.data,
    options: { redirectTo: `${await getOrigin()}/auth/callback` },
  });
  if (error) return { error: error.message };
  if (!data.url) return { error: "Couldn't start sign-in with that provider." };

  // Outside the checks above: redirect() signals by throwing.
  redirect(data.url);
}

export async function signOut(): Promise<{ error: string } | void> {
  if (!isAuthConfigured()) return { error: NOT_CONFIGURED };

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { error: error.message };
  redirect("/login");
}
