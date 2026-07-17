import "server-only";
import type {
  AIProvider,
  GenStructuredRequest,
  GenTextRequest,
  GenResult,
  StructuredResult,
} from "./provider";
import type { AgentName } from "@/lib/constants";
import { MockProvider } from "./providers/mock";
import { AnthropicProvider } from "./providers/anthropic";
import { logGeneration } from "@/lib/db/repositories/generations";
import { getSessionUser } from "@/lib/auth/session";
import { RateLimitError } from "@/lib/errors";
import { acquireStreamSlot, checkRateLimit } from "@/lib/rate-limit";

let provider: AIProvider | null = null;

/** Selects the provider from env: Anthropic when a key is present (or forced),
 *  otherwise the deterministic mock. Cached for the process. */
export function getProvider(): AIProvider {
  if (provider) return provider;
  const forced = process.env.NARRIA_AI_PROVIDER;
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  provider =
    forced === "anthropic" || (forced !== "mock" && hasKey)
      ? new AnthropicProvider()
      : new MockProvider();
  return provider;
}

export function activeProviderName(): string {
  return getProvider().name;
}

/** Test-only: clears the cached provider so a test can change
 *  NARRIA_AI_PROVIDER/ANTHROPIC_API_KEY and force a fresh resolution. Mirrors
 *  __resetRateLimits and __resetMemoryStore, which exist for the same
 *  cached-for-the-process reason. */
export function __resetProvider(): void {
  provider = null;
}

/** Per-agent model resolution (env-overridable). */
export function modelFor(agent: AgentName): string {
  const fallback = process.env.NARRIA_MODEL_DEFAULT || "claude-opus-4-8";
  if (agent === "chapterWriter") return process.env.NARRIA_MODEL_WRITER || fallback;
  if (agent === "metadata") return process.env.NARRIA_MODEL_METADATA || fallback;
  return fallback;
}

const approxTokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

/** `isDemo` travels with the id because it says whether the caller could have minted
 *  that id itself: a demo id is an unsigned cookie, so its per-caller budget is only
 *  a fairness control and the shared demo ceiling is the real bound. */
interface Caller {
  id: string;
  isDemo: boolean;
}

/** Whom the throttle is keyed on. Demo mode always resolves a user, so the throw only
 *  fires in real-auth mode when signed out — where the route already answered 401 and
 *  no action reaches an AI call without a book it could load. */
async function caller(): Promise<Caller> {
  const user = await getSessionUser();
  if (!user) throw new Error("Sign in to use AI features.");
  return { id: user.id, isDemo: user.isDemo };
}

/** The throttle lives in this facade because it is the one choke point every AI call
 *  already flows through: no agent, action or route can reach a paid model without
 *  passing here, so no future AI surface can forget to meter.
 *
 *  It is skipped when the resolved provider is the mock. RATE_LIMITS documents
 *  itself as a cost guard, not a product rule, and the mock is the zero-setup, $0
 *  path: with no ANTHROPIC_API_KEY there is no bill and so no rationale to throttle,
 *  yet the ceiling still fired — capping the whole zero-auth demo at a handful of
 *  concurrent visitors and mis-reading the mock's instant replies as click-spam on a
 *  10-calls-per-minute budget sized for a model that takes 10-20s per call. Reading
 *  the provider through getProvider() (rather than re-deriving it from env here) means
 *  this can never drift from what a call would have actually billed. */
function enforceCallBudget(who: Caller): void {
  if (activeProviderName() === "mock") return;
  const verdict = checkRateLimit(who.id, who.isDemo);
  if (!verdict.ok) throw new RateLimitError(verdict.retryAfterSeconds);
}

/** The facade every agent uses. Resolves model + provider and writes the audit log. */
export const ai = {
  async text(req: GenTextRequest): Promise<GenResult> {
    enforceCallBudget(await caller());
    const model = req.model ?? modelFor(req.meta.agent);
    const res = await getProvider().generateText({ ...req, model });
    await logGeneration({
      book_id: req.meta.bookId,
      chapter_id: req.meta.chapterId,
      agent: req.meta.agent,
      action: req.meta.action ?? req.meta.kind,
      model: res.model,
      input: { kind: req.meta.kind },
      output: res.text,
      tokens: res.tokens,
    });
    return res;
  },

  async structured<T>(req: GenStructuredRequest<T>): Promise<StructuredResult<T>> {
    enforceCallBudget(await caller());
    const model = req.model ?? modelFor(req.meta.agent);
    const res = await getProvider().generateStructured({ ...req, model });
    await logGeneration({
      book_id: req.meta.bookId,
      chapter_id: req.meta.chapterId,
      agent: req.meta.agent,
      action: req.meta.action ?? req.meta.kind,
      model: res.model,
      input: { kind: req.meta.kind },
      output: JSON.stringify(res.data).slice(0, 4000),
      tokens: res.tokens,
    });
    return res;
  },

  // Nothing before the first `yield` runs until the consumer pulls, so a caller that
  // must map RateLimitError to a status has to pull one chunk before it commits to a
  // response — see app/api/ai/continue/route.ts.
  async *stream(req: GenTextRequest): AsyncIterable<string> {
    const who = await caller();
    // Taken before the budget check so a stream denied for concurrency does not also
    // spend a call the caller never got.
    const slot = acquireStreamSlot(who.id, who.isDemo);
    if (!slot.ok) throw new RateLimitError(slot.retryAfterSeconds);
    try {
      enforceCallBudget(who);
      const model = req.model ?? modelFor(req.meta.agent);
      let acc = "";
      for await (const chunk of getProvider().streamText({ ...req, model })) {
        acc += chunk;
        yield chunk;
      }
      await logGeneration({
        book_id: req.meta.bookId,
        chapter_id: req.meta.chapterId,
        agent: req.meta.agent,
        action: req.meta.action ?? req.meta.kind,
        model,
        input: { kind: req.meta.kind },
        output: acc,
        tokens: approxTokens(acc),
      });
    } finally {
      // A throw or an abandoned generator that skipped this would hold the slot for
      // the life of the process, locking the user out of streaming with no way back
      // but a restart. A consumer that stops pulling must close the generator (call
      // `.return()`) or this never runs.
      slot.release();
    }
  },
};
