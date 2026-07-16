import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEMO_UID_COOKIE, isAuthConfigured } from "@/lib/auth/config";

// Next 16 renamed the `middleware` file convention to `proxy` (middleware.ts still
// works but warns, and having both is a build error). Runs before every render.

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Reachable while signed out. Everything else needs a session in configured mode. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/health" ||
    pathname.startsWith("/auth/")
  );
}

/** Unconfigured: no accounts, so give each visitor their own workspace id and let
 *  every request through. This is what keeps the app usable with zero setup. */
function demoProxy(request: NextRequest): NextResponse {
  if (request.cookies.has(DEMO_UID_COOKIE)) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set(DEMO_UID_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    // Deliberately not `secure`: a demo served over plain http would otherwise
    // fail to store the cookie and mint a new workspace on every request. The
    // value is a random id, not a credential.
  });
  return response;
}

/** Configured: refresh the Supabase session and gate private routes. */
async function authProxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Responses that set auth cookies must never be cached by a CDN, or one
          // user's tokens could be served to another.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Must run before the response is returned so a refreshed token is written back.
  // getUser() revalidates the JWT — getSession() alone would trust the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  return isAuthConfigured() ? authProxy(request) : demoProxy(request);
}

export const config = {
  // Skip static assets and image optimization: auth logic must never block CSS,
  // JS or images, and minting a demo cookie on those requests is pointless.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
