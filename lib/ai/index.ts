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

/** Per-agent model resolution (env-overridable). */
export function modelFor(agent: AgentName): string {
  const fallback = process.env.NARRIA_MODEL_DEFAULT || "claude-opus-4-8";
  if (agent === "chapterWriter") return process.env.NARRIA_MODEL_WRITER || fallback;
  if (agent === "metadata") return process.env.NARRIA_MODEL_METADATA || fallback;
  return fallback;
}

const approxTokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

/** The facade every agent uses. Resolves model + provider and writes the audit log. */
export const ai = {
  async text(req: GenTextRequest): Promise<GenResult> {
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

  async *stream(req: GenTextRequest): AsyncIterable<string> {
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
  },
};
