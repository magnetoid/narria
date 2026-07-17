import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE } from "@/lib/constants";

// The `origin` header decides where Supabase mails a sign-in token, and any client
// can forge it. These tests pin the allow-list: a header we don't recognise must
// never reach emailRedirectTo/redirectTo, or a forged one would deliver the
// victim's token to the attacker's host.

let originHeader: string | null = null;

interface OtpArgs {
  email: string;
  options?: { emailRedirectTo?: string };
}
interface OAuthArgs {
  provider: string;
  options?: { redirectTo?: string };
}

const signInWithOtp = vi.fn<(args: OtpArgs) => Promise<{ error: null }>>(async () => ({
  error: null,
}));
const signInWithOAuth = vi.fn<
  (args: OAuthArgs) => Promise<{ data: { url: string | null }; error: null }>
>(async () => ({ data: { url: null }, error: null }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(originHeader ? { origin: originHeader } : {}),
}));

vi.mock("@/lib/auth/supabase", () => ({
  createAuthClient: async () => ({ auth: { signInWithOtp, signInWithOAuth } }),
}));

beforeEach(() => {
  originHeader = null;
  signInWithOtp.mockClear();
  signInWithOAuth.mockClear();
  // The actions no-op unless auth is configured; these values are never dialled.
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function sendMagicLink(): Promise<string | undefined> {
  const { signInWithMagicLink } = await import("@/lib/auth/actions");
  await signInWithMagicLink("writer@example.com");
  return signInWithOtp.mock.calls[0]?.[0]?.options?.emailRedirectTo;
}

describe("magic link redirect origin", () => {
  it("ignores an origin header pointing at a host we don't own", async () => {
    originHeader = "https://narria-evil.vercel.app";
    expect(await sendMagicLink()).toBe(`${SITE.url}/auth/confirm`);
  });

  it("ignores an origin that merely embeds our host in its own", async () => {
    originHeader = `https://${new URL(SITE.url).host}.evil.example`;
    expect(await sendMagicLink()).toBe(`${SITE.url}/auth/confirm`);
  });

  it("ignores a malformed origin header", async () => {
    originHeader = "not a url";
    expect(await sendMagicLink()).toBe(`${SITE.url}/auth/confirm`);
  });

  it("falls back to the canonical url when there is no origin header", async () => {
    expect(await sendMagicLink()).toBe(`${SITE.url}/auth/confirm`);
  });

  it("honours the origin header when it is our own host", async () => {
    originHeader = SITE.url;
    expect(await sendMagicLink()).toBe(`${SITE.url}/auth/confirm`);
  });

  it("honours localhost outside production, so dev sign-in works", async () => {
    vi.stubEnv("NODE_ENV", "development");
    originHeader = "http://localhost:3000";
    expect(await sendMagicLink()).toBe("http://localhost:3000/auth/confirm");
  });

  it("refuses a localhost origin in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    originHeader = "http://localhost:3000";
    expect(await sendMagicLink()).toBe(`${SITE.url}/auth/confirm`);
  });
});

describe("oauth redirect origin", () => {
  it("ignores a hostile origin header", async () => {
    originHeader = "https://narria-evil.vercel.app";
    const { signInWithOAuth: action } = await import("@/lib/auth/actions");
    await action("google");
    expect(signInWithOAuth.mock.calls[0]?.[0]?.options?.redirectTo).toBe(
      `${SITE.url}/auth/callback`,
    );
  });
});
