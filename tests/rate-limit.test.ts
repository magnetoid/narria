import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@/lib/constants";
import {
  MAX_TRACKED_USERS,
  __resetRateLimits,
  __trackedCallers,
  acquireStreamSlot,
  checkRateLimit,
  type RateLimitVerdict,
} from "@/lib/rate-limit";
import { RateLimitError, errorCode, isRateLimitError } from "@/lib/errors";
import type { GenTextRequest } from "@/lib/ai/provider";

// Loading @/lib/ai pulls in the whole provider graph, and paying that transform
// inside whichever test happens to run first put it within a few hundred ms of the
// default timeout — a flake that had nothing to do with what the test asserts.
let ai: typeof import("@/lib/ai").ai;
beforeAll(async () => {
  ({ ai } = await import("@/lib/ai"));
});

const USER = "user-a";
const OTHER = "user-b";

// The facade resolves the caller through the identity seam; nothing here exercises
// auth itself (tests/auth-session.test.ts owns that), so one fixed user is enough.
let sessionUser: { id: string; email: null; isDemo: boolean } | null = {
  id: USER,
  email: null,
  isDemo: true,
};
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => sessionUser,
}));

// Swapped in per test so a stream can succeed, throw mid-flight, or hang.
let providerStream: () => AsyncIterable<string>;
vi.mock("@/lib/ai/providers/mock", () => ({
  MockProvider: class {
    readonly name = "mock";
    streamText() {
      return providerStream();
    }
    async generateText() {
      return { text: "text", model: "mock", tokens: 1 };
    }
    async generateStructured() {
      return { data: {}, model: "mock", tokens: 1 };
    }
  },
}));

const request = (): GenTextRequest => ({
  system: "s",
  prompt: "p",
  meta: { agent: "chapterWriter", kind: "chapter-continue" },
});

async function drain(stream: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

/** Returns the thrown value, so a test can assert on its shape rather than only
 *  on its message. */
async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("expected a rejection, got a resolution");
}

/** Asserts every stream slot is free by taking them all, then releases them. */
function expectAllStreamSlotsFree(userId = USER): void {
  const taken: { release: () => void }[] = [];
  for (let i = 0; i < RATE_LIMITS.concurrentStreams; i++) {
    const slot = acquireStreamSlot(userId, false);
    expect(slot.ok).toBe(true);
    if (slot.ok) taken.push(slot);
  }
  expect(acquireStreamSlot(userId, false).ok).toBe(false);
  for (const slot of taken) slot.release();
}

function spendCallBudget(userId: string): void {
  for (let i = 0; i < RATE_LIMITS.aiCallsPerMinute; i++) {
    expect(checkRateLimit(userId, false)).toEqual({ ok: true });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  // globalThis-backed state outlives the module graph — without this, one test's
  // spent budget would deny the next.
  __resetRateLimits();
  sessionUser = { id: USER, email: null, isDemo: true };
  providerStream = async function* () {
    yield "chunk";
  };
  vi.stubEnv("NARRIA_AI_PROVIDER", "mock");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  __resetRateLimits();
});

describe("checkRateLimit", () => {
  it("allows RATE_LIMITS.aiCallsPerMinute calls inside one window", () => {
    spendCallBudget(USER);
  });

  it("denies the next call with a wait no longer than the window", () => {
    spendCallBudget(USER);
    const verdict = checkRateLimit(USER, false);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.retryAfterSeconds).toBeGreaterThan(0);
    expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("reports the wait until the oldest call ages out", () => {
    spendCallBudget(USER);
    vi.advanceTimersByTime(45_000);
    expect(checkRateLimit(USER, false)).toEqual({ ok: false, retryAfterSeconds: 15 });
  });

  it("never reports a wait of zero, which would read as 'retry now'", () => {
    spendCallBudget(USER);
    vi.advanceTimersByTime(59_999);
    expect(checkRateLimit(USER, false)).toEqual({ ok: false, retryAfterSeconds: 1 });
  });

  it("rolls the window: the budget returns once the calls age out", () => {
    spendCallBudget(USER);
    expect(checkRateLimit(USER, false).ok).toBe(false);
    vi.advanceTimersByTime(60_000);
    spendCallBudget(USER);
  });

  it("slides rather than resetting on a fixed boundary", () => {
    checkRateLimit(USER, false);
    vi.advanceTimersByTime(30_000);
    for (let i = 1; i < RATE_LIMITS.aiCallsPerMinute; i++) checkRateLimit(USER, false);
    expect(checkRateLimit(USER, false).ok).toBe(false);
    // Only the first call has aged out, so exactly one call comes back — a fixed
    // window would hand back the whole budget here.
    vi.advanceTimersByTime(30_001);
    expect(checkRateLimit(USER, false)).toEqual({ ok: true });
    expect(checkRateLimit(USER, false).ok).toBe(false);
  });

  it("does not spend budget on a denied call, so hammering cannot push the retry out", () => {
    spendCallBudget(USER);
    for (let i = 0; i < 20; i++) expect(checkRateLimit(USER, false).ok).toBe(false);
    vi.advanceTimersByTime(60_000);
    spendCallBudget(USER);
  });

  it("keeps a separate budget per user", () => {
    spendCallBudget(USER);
    expect(checkRateLimit(USER, false).ok).toBe(false);
    expect(checkRateLimit(OTHER, false)).toEqual({ ok: true });
  });
});

describe("acquireStreamSlot", () => {
  it("hands out RATE_LIMITS.concurrentStreams slots and then denies", () => {
    expectAllStreamSlotsFree(USER);
  });

  it("denies with a positive wait rather than a deadline it cannot know", () => {
    for (let i = 0; i < RATE_LIMITS.concurrentStreams; i++) acquireStreamSlot(USER, false);
    const verdict = acquireStreamSlot(USER, false);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("frees the slot on release", () => {
    const slots: { release: () => void }[] = [];
    for (let i = 0; i < RATE_LIMITS.concurrentStreams; i++) {
      const slot = acquireStreamSlot(USER, false);
      if (slot.ok) slots.push(slot);
    }
    expect(acquireStreamSlot(USER, false).ok).toBe(false);
    slots[0].release();
    expect(acquireStreamSlot(USER, false).ok).toBe(true);
  });

  it("ignores a repeated release, so a slot in use cannot be handed out twice", () => {
    const first = acquireStreamSlot(USER, false);
    if (!first.ok) throw new Error("unreachable");
    first.release();
    first.release();
    first.release();
    // A double decrement here would leave room for concurrentStreams + 2.
    expectAllStreamSlotsFree(USER);
  });

  it("keeps slots per user", () => {
    for (let i = 0; i < RATE_LIMITS.concurrentStreams; i++) acquireStreamSlot(USER, false);
    expect(acquireStreamSlot(USER, false).ok).toBe(false);
    expect(acquireStreamSlot(OTHER, false).ok).toBe(true);
  });
});

// A demo id is an unsigned cookie the visitor sends, and the proxy mints a fresh one
// for anyone who arrives without it. So the per-caller windows above are decoration
// against an abuser: what they get metered by has to be a key they cannot choose.
describe("the shared demo ceiling", () => {
  const mintDemoCalls = (n: number, from = 0): RateLimitVerdict[] =>
    Array.from({ length: n }, (_, i) => checkRateLimit(`minted-${from + i}`, true));

  it("denies a caller that mints a fresh id for every call", () => {
    // Each of these would pass its own per-caller window forever: it is always the
    // id's first call. Only the shared ceiling can see them as one abuser.
    expect(mintDemoCalls(RATE_LIMITS.demoCallsPerMinute).every((v) => v.ok)).toBe(true);
    const verdict = checkRateLimit("minted-fresh", true);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("unreachable");
    expect(verdict.retryAfterSeconds).toBeGreaterThan(0);
    expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("leaves no entry behind for a minted id it denied, so rotation cannot grow the map", () => {
    mintDemoCalls(RATE_LIMITS.demoCallsPerMinute);
    const tracked = __trackedCallers();
    mintDemoCalls(2_000, 1_000_000);
    // Every one of those was denied by the ceiling before it could be recorded. An
    // entry per rotation is how the limiter would become the OOM it exists to stop.
    expect(__trackedCallers()).toBe(tracked);
  });

  it("rolls with the window rather than locking the demo out for good", () => {
    mintDemoCalls(RATE_LIMITS.demoCallsPerMinute);
    expect(checkRateLimit("minted-fresh", true).ok).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(checkRateLimit("minted-fresh", true)).toEqual({ ok: true });
  });

  it("does not hold a real-auth caller to the demo ceiling", () => {
    mintDemoCalls(RATE_LIMITS.demoCallsPerMinute);
    expect(checkRateLimit("minted-fresh", true).ok).toBe(false);
    // A real id is issued by Supabase and verified per request, so it cannot be
    // rotated for a fresh budget and needs no shared ceiling.
    expect(checkRateLimit("real-user", false)).toEqual({ ok: true });
  });

  it("caps concurrent streams across all demo callers, not just per id", () => {
    const slots: { release: () => void }[] = [];
    for (let i = 0; i < RATE_LIMITS.demoConcurrentStreams; i++) {
      const slot = acquireStreamSlot(`minted-${i}`, true);
      expect(slot.ok).toBe(true);
      if (slot.ok) slots.push(slot);
    }
    expect(acquireStreamSlot("minted-fresh", true).ok).toBe(false);
    expect(acquireStreamSlot("real-user", false).ok).toBe(true);
    slots[0].release();
    expect(acquireStreamSlot("minted-fresh", true).ok).toBe(true);
  });
});

describe("tracked callers stay bounded", () => {
  it("holds MAX_TRACKED_USERS as a cap even when every entry is younger than the window", () => {
    // Ids that cannot be denied by a shared ceiling, all inside one window — the case
    // where dropping entries by age alone frees nothing, because none are idle yet.
    for (let i = 0; i < MAX_TRACKED_USERS + 500; i++) {
      expect(checkRateLimit(`caller-${i}`, false)).toEqual({ ok: true });
    }
    expect(__trackedCallers()).toBeLessThanOrEqual(MAX_TRACKED_USERS);
  });

  it("keeps the budget of a caller with a stream open", () => {
    const slot = acquireStreamSlot("streamer", false);
    expect(slot.ok).toBe(true);
    spendCallBudget("streamer");
    for (let i = 0; i < MAX_TRACKED_USERS + 500; i++) checkRateLimit(`caller-${i}`, false);
    // Evicting this one would hand back a budget it is actively spending.
    expect(checkRateLimit("streamer", false).ok).toBe(false);
  });
});

describe("error codes", () => {
  it("tags a RateLimitError with the code a surface reacts to", () => {
    const err = new RateLimitError(30);
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfterSeconds).toBe(30);
    expect(errorCode(err)).toBe("rate_limited");
    expect(isRateLimitError(err)).toBe(true);
  });

  it("recognises a structurally identical error from another module instance", () => {
    // A Next production build can give each route bundle its own copy of the class,
    // so instanceof would miss this one.
    expect(isRateLimitError({ code: "rate_limited", retryAfterSeconds: 5 })).toBe(true);
  });

  it("does not pass a foreign code off as part of the contract", () => {
    expect(errorCode(Object.assign(new Error("connect"), { code: "ECONNREFUSED" }))).toBeUndefined();
    expect(errorCode(Object.assign(new Error("duplicate"), { code: "23505" }))).toBeUndefined();
    expect(errorCode(new Error("plain"))).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
    expect(errorCode(undefined)).toBeUndefined();
    // `code in obj` walks the prototype chain, so Object.prototype members must not
    // read as codes.
    expect(errorCode({ code: "toString" })).toBeUndefined();
    expect(isRateLimitError(new Error("plain"))).toBe(false);
  });
});

// The facade is the choke point every agent already flows through, so the throttle
// lives there rather than in each route: a new AI surface cannot forget it.
describe("the ai facade meters every call", () => {
  it("throws RateLimitError from text() once the budget is spent", async () => {
    spendCallBudget(USER);
    const err = await rejection(ai.text(request()));
    expect(isRateLimitError(err)).toBe(true);
  });

  it("throws RateLimitError from structured() once the budget is spent", async () => {
    spendCallBudget(USER);
    const err = await rejection(
      ai.structured({ ...request(), schema: {} as never, schemaName: "x" }),
    );
    expect(isRateLimitError(err)).toBe(true);
  });

  it("throws RateLimitError from stream() once the budget is spent", async () => {
    spendCallBudget(USER);
    const err = await rejection(drain(ai.stream(request())));
    expect(isRateLimitError(err)).toBe(true);
    expect((err as RateLimitError).retryAfterSeconds).toBeGreaterThan(0);
  });

  it("holds a caller that mints a fresh demo id per call to the shared ceiling", async () => {
    // The whole attack, at the choke point: a demo id is a cookie the visitor sends,
    // so an abuser presents a new one for every call and no per-caller window ever
    // fills. Only a key the server chose can see these as one caller.
    for (let i = 0; i < RATE_LIMITS.demoCallsPerMinute; i++) {
      sessionUser = { id: `minted-${i}`, email: null, isDemo: true };
      await ai.text(request());
    }
    sessionUser = { id: "minted-fresh", email: null, isDemo: true };
    expect(isRateLimitError(await rejection(ai.text(request())))).toBe(true);
  });

  it("spends budget per call, so text() alone exhausts the window", async () => {
    for (let i = 0; i < RATE_LIMITS.aiCallsPerMinute; i++) await ai.text(request());
    expect(isRateLimitError(await rejection(ai.text(request())))).toBe(true);
  });
});

describe("the ai facade never strands a stream slot", () => {
  it("releases the slot when the stream runs to completion", async () => {
    expect(await drain(ai.stream(request()))).toEqual(["chunk"]);
    expectAllStreamSlotsFree();
  });

  it("releases the slot when the provider throws mid-stream", async () => {
    providerStream = async function* () {
      yield "chunk";
      throw new Error("provider exploded");
    };
    const err = await rejection(drain(ai.stream(request())));
    expect((err as Error).message).toBe("provider exploded");
    // Without the finally the slot would be held for the life of the process and
    // the user would be locked out of streaming with no way back but a restart.
    expectAllStreamSlotsFree();
  });

  it("releases the slot when the consumer abandons the stream", async () => {
    providerStream = async function* () {
      yield "one";
      yield "two";
    };
    const iterator = ai.stream(request())[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ done: false, value: "one" });
    // What the route does when the client disconnects mid-stream.
    await iterator.return?.(undefined);
    expectAllStreamSlotsFree();
  });

  it("denies a stream past concurrentStreams while the earlier ones are open", async () => {
    providerStream = async function* () {
      yield "one";
      yield "two";
    };
    const open: AsyncIterator<string>[] = [];
    for (let i = 0; i < RATE_LIMITS.concurrentStreams; i++) {
      const iterator = ai.stream(request())[Symbol.asyncIterator]();
      await iterator.next();
      open.push(iterator);
    }
    expect(isRateLimitError(await rejection(drain(ai.stream(request()))))).toBe(true);
    for (const iterator of open) await iterator.return?.(undefined);
    expectAllStreamSlotsFree();
  });

  it("does not spend call budget on a stream denied for concurrency", async () => {
    providerStream = async function* () {
      yield "one";
      yield "two";
    };
    const open: AsyncIterator<string>[] = [];
    for (let i = 0; i < RATE_LIMITS.concurrentStreams; i++) {
      const iterator = ai.stream(request())[Symbol.asyncIterator]();
      await iterator.next();
      open.push(iterator);
    }
    await rejection(drain(ai.stream(request())));
    for (const iterator of open) await iterator.return?.(undefined);
    // The four open streams spent four calls; the denied one must not have spent a fifth.
    for (let i = 0; i < RATE_LIMITS.aiCallsPerMinute - RATE_LIMITS.concurrentStreams; i++) {
      expect(checkRateLimit(USER, false)).toEqual({ ok: true });
    }
    expect(checkRateLimit(USER, false).ok).toBe(false);
  });
});
