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
