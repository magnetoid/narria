import "server-only";
import { RATE_LIMITS } from "@/lib/constants";

/**
 * Throttle in front of the paid model API. Enforced in the `ai` facade
 * (lib/ai/index.ts), the one choke point every AI call already flows through.
 *
 * A limiter is only worth its key. A caller who can choose the key it is metered
 * under is not metered at all: every fresh key is a fresh budget, so the counter
 * below would deny nothing. Demo identity is exactly that — an unsigned cookie the
 * visitor sends (lib/auth/session.ts) — which is why demo callers are additionally
 * held to the RATE_LIMITS.demo* ceilings, keyed on a name the server chose and so
 * beyond the caller's reach. Anything that becomes a key here must be a key the
 * server issued, or it is decoration.
 *
 * State is backed on globalThis for the same reason the memory store's maps are
 * (lib/db/memory-store.ts): a Next production build can hand each route bundle its
 * own module instance, which would split these counters between the streaming route,
 * the server actions and the pages — and each surface would then get a full budget
 * of its own.
 *
 * That is only correct for the single-container Coolify deploy this ships on. Swap
 * to Upstash/Postgres before scaling horizontally: per-process counters silently
 * multiply the effective limit by the replica count, and nothing fails loudly when
 * they do.
 */

const WINDOW_MS = 60_000; // The window RATE_LIMITS.aiCallsPerMinute is counted over.

// A stream ends when it ends, so there is no deadline to compute for a concurrency
// denial — this is "try again shortly", not a promise.
const STREAM_RETRY_AFTER_SECONDS = 5;

/** A hard cap on tracked callers, not a hint: past it the oldest entries are dropped
 *  even while live. Exported so the test that proves the cap holds can name it. */
export const MAX_TRACKED_USERS = 10_000;

/** Server-chosen key for the ceiling shared by every demo caller. Kept in its own map
 *  so that a visitor who sets their cookie to this string still lands in their own
 *  per-caller bucket and cannot spend, or read, the shared one twice. */
const DEMO_BUCKET = "demo";

export type RateLimitVerdict = { ok: true } | { ok: false; retryAfterSeconds: number };

export type StreamSlotVerdict =
  | { ok: true; release: () => void }
  | { ok: false; retryAfterSeconds: number };

interface RateLimitState {
  /** userId → epoch ms of each allowed call, oldest first. */
  calls: Map<string, number[]>;
  /** userId → streams currently open. */
  streams: Map<string, number>;
  /** Server-chosen aggregate windows (currently only DEMO_BUCKET). */
  shared: Map<string, number[]>;
  /** Streams open across all demo callers at once. */
  demoStreams: number;
}

const g = globalThis as unknown as { __narriaRateLimit?: RateLimitState };
const state: RateLimitState =
  g.__narriaRateLimit ??
  (g.__narriaRateLimit = {
    calls: new Map(),
    streams: new Map(),
    shared: new Map(),
    demoStreams: 0,
  });
// Destructured once at module load — see the same note in lib/db/memory-store.ts:
// deleting globalThis.__narriaRateLimit detaches the global but leaves these Maps
// untouched, so it is not a reset. Use __resetRateLimits(). demoStreams is a number,
// so it has no identity to hold onto and is always read through `state`.
const { calls, streams, shared } = state;

/** The denial a full window earns, or null when there is still room. Reads only —
 *  budget is spent by the caller once every window it must pass has room. */
function denialFor(times: number[], limit: number, now: number): RateLimitVerdict | null {
  if (times.length < limit) return null;
  // Rounded up, and never 0 — a Retry-After of 0 reads as "retry now".
  const waitMs = times[0] + WINDOW_MS - now;
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)) };
}

/** Sliding window keyed by user id, plus the shared demo ceiling for callers whose id
 *  they chose themselves. Spends budget only when it allows the call, so a denied
 *  caller cannot push its own retry further out by hammering. */
export function checkRateLimit(userId: string, isDemo: boolean): RateLimitVerdict {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const own = (calls.get(userId) ?? []).filter((t) => t > cutoff);
  const ownDenial = denialFor(own, RATE_LIMITS.aiCallsPerMinute, now);
  // Returning before any `calls.set` is what keeps an unknown id from costing memory:
  // a rotated cookie that gets denied below must not leave an entry behind, or the
  // limiter becomes the OOM it exists to prevent.
  if (ownDenial) return ownDenial;

  const demo = isDemo ? (shared.get(DEMO_BUCKET) ?? []).filter((t) => t > cutoff) : null;
  if (demo) {
    const demoDenial = denialFor(demo, RATE_LIMITS.demoCallsPerMinute, now);
    if (demoDenial) return demoDenial;
  }

  own.push(now);
  calls.set(userId, own);
  if (demo) {
    demo.push(now);
    shared.set(DEMO_BUCKET, demo);
  }
  evictIfCrowded();
  return { ok: true };
}

/** Caps how many streams one user may hold open at once — the per-minute counter
 *  cannot see a handful of long-lived streams each burning tokens for minutes. */
export function acquireStreamSlot(userId: string, isDemo: boolean): StreamSlotVerdict {
  const open = streams.get(userId) ?? 0;
  if (open >= RATE_LIMITS.concurrentStreams) {
    return { ok: false, retryAfterSeconds: STREAM_RETRY_AFTER_SECONDS };
  }
  // A rotated cookie buys a fresh per-caller slot count, so this shared ceiling is
  // the one that holds on a public demo.
  if (isDemo && state.demoStreams >= RATE_LIMITS.demoConcurrentStreams) {
    return { ok: false, retryAfterSeconds: STREAM_RETRY_AFTER_SECONDS };
  }
  streams.set(userId, open + 1);
  if (isDemo) state.demoStreams += 1;

  let released = false;
  return {
    ok: true,
    // Idempotent: release runs in a `finally` that a second path (a cancelled
    // stream closing the same generator) can re-enter, and a double decrement would
    // hand out a slot that is still in use.
    release() {
      if (released) return;
      released = true;
      const remaining = (streams.get(userId) ?? 1) - 1;
      if (remaining > 0) streams.set(userId, remaining);
      else streams.delete(userId);
      if (isDemo) state.demoStreams = Math.max(0, state.demoStreams - 1);
    },
  };
}

/** Enforces MAX_TRACKED_USERS as a cap rather than a sweep trigger. Dropping entries
 *  by age alone frees nothing under the load that grows this map — every entry is
 *  younger than the window precisely when ids are being minted in a loop — so past
 *  the cap the oldest go regardless of age. Evicting a live entry only re-grants a
 *  budget that key could already mint by rotating its cookie; the demo ceiling is
 *  what bounds that. An unbounded map, by contrast, is an OOM. */
function evictIfCrowded(): void {
  if (calls.size <= MAX_TRACKED_USERS) return;
  // A Map iterates in insertion order, so the longest-tracked keys come first.
  for (const userId of calls.keys()) {
    if (calls.size <= MAX_TRACKED_USERS) break;
    // An open stream still needs its budget accounted; it is bounded by the slot caps.
    if (!streams.has(userId)) calls.delete(userId);
  }
}

/** Test-only: how many callers currently hold a budget entry. Exists so the cap above
 *  can be asserted rather than assumed. */
export function __trackedCallers(): number {
  return calls.size;
}

/** Test-only: empties the shared counters in place (see the destructuring note above
 *  for why deleting globalThis.__narriaRateLimit would not). */
export function __resetRateLimits(): void {
  calls.clear();
  streams.clear();
  shared.clear();
  state.demoStreams = 0;
}
