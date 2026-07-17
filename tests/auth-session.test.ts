import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEV_USER_ID } from "@/lib/constants";
import { DEMO_UID_COOKIE } from "@/lib/auth/config";

// One mutable cookie jar the mocked next/headers reads from, so each test can
// describe the request it wants without re-mocking the module.
let jar: Record<string, string> = {};

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name in jar ? { name, value: jar[name] } : undefined,
    getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
    set: () => {},
  }),
}));

// No Supabase env is set in this suite, so isAuthConfigured() is false and the
// seam must resolve to a demo user on every path.
beforeEach(() => {
  jar = {};
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

// getSessionUser is wrapped in React cache(); outside a request context that is a
// pass-through, but a fresh module per test keeps the tests honest either way.
async function getSessionUser() {
  const mod = await import("@/lib/auth/session");
  return mod.getSessionUser();
}

describe("getSessionUser (demo mode)", () => {
  it("uses the narria_demo_uid cookie when the proxy has minted one", async () => {
    jar[DEMO_UID_COOKIE] = "demo-uid-from-cookie";
    expect(await getSessionUser()).toEqual({
      id: "demo-uid-from-cookie",
      email: null,
      isDemo: true,
    });
  });

  it("falls back to DEV_USER_ID when the cookie is absent (build-time prerender)", async () => {
    const user = await getSessionUser();
    expect(user).toEqual({ id: DEV_USER_ID, email: null, isDemo: true });
  });

  it("falls back to DEV_USER_ID when the cookie is present but empty", async () => {
    jar[DEMO_UID_COOKIE] = "";
    expect((await getSessionUser())?.id).toBe(DEV_USER_ID);
  });

  it("never returns null in demo mode, so requireUser() resolves without a login", async () => {
    const mod = await import("@/lib/auth/session");
    await expect(mod.requireUser()).resolves.toMatchObject({ isDemo: true });
  });
});

// URL + service role but no anon key: getDb() would hand out the service-role
// client (durable, RLS-bypassing rows) while sign-in stays impossible. Demo mode
// there would make the unsigned demo cookie the only tenancy check on multi-tenant
// data — worse than not starting at all.
describe("getSessionUser (durable store configured, sign-in not)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  });

  it("refuses to serve rather than falling back to demo mode", async () => {
    await expect(getSessionUser()).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("refuses even when the caller presents a demo cookie", async () => {
    jar[DEMO_UID_COOKIE] = DEV_USER_ID;
    await expect(getSessionUser()).rejects.toThrow();
  });

  it("refuses for writes too, so no row is attributed to a demo uid", async () => {
    const mod = await import("@/lib/auth/session");
    await expect(mod.requireUserId()).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });
});

// Auth configured (URL + anon key) but no service-role key: logGeneration() can
// only insert ai_generations through the service-role client (RLS grants a user
// SELECT only there), so without the key usage/billing silently stops being
// metered. Refuse rather than let that degrade quietly.
describe("getSessionUser (auth configured, service-role key missing)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  });

  it("refuses to serve rather than silently no-op billing", async () => {
    await expect(getSessionUser()).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("refuses for writes too, so no generation goes unmetered", async () => {
    const mod = await import("@/lib/auth/session");
    await expect(mod.requireUserId()).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

// The zero-setup invariant: with no env at all every predicate above is false, so
// neither guard fires — demo mode is unconfigured auth's only outcome.
describe("getSessionUser (no env at all)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  });

  it("still resolves to a demo user with the memory store behind it", async () => {
    await expect(getSessionUser()).resolves.toMatchObject({ isDemo: true });
  });

  it("still resolves a demo user id for writes, so nothing throws at boot", async () => {
    const mod = await import("@/lib/auth/session");
    await expect(mod.requireUserId()).resolves.toEqual(expect.any(String));
  });
});
