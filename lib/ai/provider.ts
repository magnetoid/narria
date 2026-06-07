import type { ZodType } from "zod";
import type { AgentName } from "@/lib/constants";

export type Effort = "low" | "medium" | "high" | "max";

/** Metadata travels with every request. The real provider uses `system`/`prompt`;
 *  the mock provider uses `kind` + `input` to produce tailored, schema-valid output. */
export interface AiMeta {
  agent: AgentName;
  kind: string; // e.g. "outline", "edit:expand", "metadata:description"
  bookId?: string | null;
  chapterId?: string | null;
  action?: string | null;
  input?: Record<string, unknown>;
}

export interface GenTextRequest {
  system: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  effort?: Effort;
  meta: AiMeta;
}

export interface GenStructuredRequest<T> {
  system: string;
  prompt: string;
  schema: ZodType<T>;
  schemaName: string;
  model?: string;
  maxTokens?: number;
  effort?: Effort;
  meta: AiMeta;
}

export interface GenResult {
  text: string;
  model: string;
  tokens: number;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  tokens: number;
}

/** The single seam every model provider implements. Swap Anthropic for any
 *  OpenAI-compatible backend by writing one more implementation. */
export interface AIProvider {
  readonly name: string;
  generateText(req: GenTextRequest): Promise<GenResult>;
  streamText(req: GenTextRequest): AsyncIterable<string>;
  generateStructured<T>(req: GenStructuredRequest<T>): Promise<StructuredResult<T>>;
}

export type { AgentName };
