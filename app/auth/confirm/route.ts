import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
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

  // Built before the client so that verifyOtp's session cookies — and the no-store
  // headers that must travel with them — land on the response we return. Always
  // internal, never a URL from the query string. The Location stays relative on
  // purpose: an absolute one could only come from the request's own host header,
  // which is not ours to trust (see getOrigin in lib/auth/actions.ts).
  const response = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  const supabase = await createAuthClient(response);
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  return response;
}
