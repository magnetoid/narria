import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
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

  // See app/auth/confirm/route.ts: the response is built first so the session
  // cookies and their no-store headers ride back on it, and its Location is
  // relative rather than derived from the request's host.
  const response = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  const supabase = await createAuthClient(response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Always internal — never redirect to a URL from the query string.
  return response;
}
