import "server-only";
import { RATE_LIMITS } from "@/lib/constants";

/**
 * Per-user throttle in front of the paid model API. Enforced in the `ai` facade
 * (lib/ai/index.ts), the one choke point every AI call already flows through.
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

// The demo identity is an unsigned cookie the caller carries (lib/auth/session.ts),
// so the key space is caller-controlled: without eviction, a loop of fresh ids grows
// these maps until the process runs out of memory. Sweeping only past the threshold
// keeps the common path O(1).
const MAX_TRACKED_USERS = 10_000;

export type RateLimitVerdict = { ok: true } | { ok: false; retryAfterSeconds: number };

export type StreamSlotVerdict =
  | { ok: true; release: () => void }
  | { ok: false; retryAfterSeconds: number };

interface RateLimitState {
  /** userId → epoch ms of each allowed call, oldest first. */
  calls: Map<string, number[]>;
  /** userId → streams currently open. */
  streams: Map<string, number>;
}

const g = globalThis as unknown as { __narriaRateLimit?: RateLimitState };
const state: RateLimitState =
  g.__narriaRateLimit ?? (g.__narriaRateLimit = { calls: new Map(), streams: new Map() });
// Destructured once at module load — see the same note in lib/db/memory-store.ts:
// deleting globalThis.__narriaRateLimit detaches the global but leaves these Maps
// untouched, so it is not a reset. Use __resetRateLimits().
const { calls, streams } = state;

/** Sliding window keyed by user id. Spends budget only when it allows the call, so
 *  a denied caller cannot push its own retry further out by hammering. */
export function checkRateLimit(userId: string): RateLimitVerdict {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const recent = (calls.get(userId) ?? []).filter((t) => t > cutoff);
  calls.set(userId, recent);

  if (recent.length >= RATE_LIMITS.aiCallsPerMinute) {
    // Rounded up, and never 0 — a Retry-After of 0 reads as "retry now".
    const waitMs = recent[0] + WINDOW_MS - now;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)) };
  }

  recent.push(now);
  sweepIfCrowded(now);
  return { ok: true };
}

/** Caps how many streams one user may hold open at once — the per-minute counter
 *  cannot see a handful of long-lived streams each burning tokens for minutes. */
export function acquireStreamSlot(userId: string): StreamSlotVerdict {
  const open = streams.get(userId) ?? 0;
  if (open >= RATE_LIMITS.concurrentStreams) {
    return { ok: false, retryAfterSeconds: STREAM_RETRY_AFTER_SECONDS };
  }
  streams.set(userId, open + 1);

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
    },
  };
}

function sweepIfCrowded(now: number): void {
  if (calls.size <= MAX_TRACKED_USERS) return;
  const cutoff = now - WINDOW_MS;
  for (const [userId, times] of calls) {
    // Timestamps are appended in order, so the last one is the newest.
    const idle = times.length === 0 || times[times.length - 1] <= cutoff;
    if (idle && !streams.has(userId)) calls.delete(userId);
  }
}

/** Test-only: empties the shared counters in place (see the destructuring note above
 *  for why deleting globalThis.__narriaRateLimit would not). */
export function __resetRateLimits(): void {
  calls.clear();
  streams.clear();
}
