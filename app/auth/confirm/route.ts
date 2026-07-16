import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { isAuthConfigured } from "@/lib/auth/config";
import { createAuthClient } from "@/lib/auth/supabase";

// Landing point for magic links (see emailRedirectTo in lib/auth/actions.ts).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthConfigured()) redirect("/");

  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!token_hash || !type) {
    redirect(`/login?error=${encodeURIComponent("That sign-in link is incomplete.")}`);
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Always internal — never redirect to a URL from the query string.
  redirect("/");
}
