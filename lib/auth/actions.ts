"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthConfigured } from "@/lib/auth/config";
import { createAuthClient } from "@/lib/auth/supabase";
import { emailSchema, oauthProviderSchema } from "@/lib/validation";
import { SITE } from "@/lib/constants";

const NOT_CONFIGURED =
  "Sign-in isn't configured on this deployment — it runs as a demo workspace.";

/** Where Supabase should send the user back to. Derived from the request so magic
 *  links work on localhost and previews, not just the canonical site URL. */
async function getOrigin(): Promise<string> {
  return (await headers()).get("origin") ?? SITE.url;
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
