import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isAuthConfigured } from "@/lib/auth/config";
import { createAuthClient } from "@/lib/auth/supabase";

// Landing point for the OAuth providers (see redirectTo in lib/auth/actions.ts).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthConfigured()) redirect("/");

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // Providers report a denied consent screen here rather than sending a code.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    redirect(`/login?error=${encodeURIComponent(providerError)}`);
  }

  if (!code) {
    redirect(`/login?error=${encodeURIComponent("That sign-in link is incomplete.")}`);
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Always internal — never redirect to a URL from the query string.
  redirect("/");
}
