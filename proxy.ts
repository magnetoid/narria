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

  const id = crypto.randomUUID();
  // Onto the request as well as the response: the render downstream reads cookies()
  // from the request, so response-only would leave the visitor's *first* page on a
  // different workspace than every page after it.
  request.cookies.set(DEMO_UID_COOKIE, id);
  const response = NextResponse.next({ request });
  response.cookies.set(DEMO_UID_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    // No `secure` flag, by design — not an oversight: this id carries no
    // credential, only a random workspace address into the ephemeral in-memory
    // store (a durable store with no way to sign in refuses to boot, per
    // getSessionUser(), and real-auth mode never mints this cookie at all — see
    // isAuthConfigured()). `.next/standalone/server.js` hardcodes
    // NODE_ENV=production, so gating on it made every plain-http demo reached
    // by hostname/IP instead of `localhost` (e.g. `docker compose up` viewed
    // from another machine on the LAN, no TLS) have its cookie rejected by the
    // client — the proxy would re-mint a workspace on every request and the
    // visitor would silently lose their books. That's a real dent in the
    // zero-setup invariant for a flag that, here, buys no confidentiality.
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
