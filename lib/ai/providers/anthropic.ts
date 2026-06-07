import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type {
  AIProvider,
  GenResult,
  GenStructuredRequest,
  GenTextRequest,
  StructuredResult,
} from "@/lib/ai/provider";

const DEFAULT_MODEL = process.env.NARRIA_MODEL_DEFAULT || "claude-opus-4-8";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

function firstText(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function totalTokens(msg: Anthropic.Message): number {
  return (msg.usage?.input_tokens ?? 0) + (msg.usage?.output_tokens ?? 0);
}

/** Anthropic's structured outputs require additionalProperties:false and all keys
 *  required on every object. Convert the Zod schema and enforce that recursively. */
function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = strictify(v);
    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties as Record<string, unknown>);
    }
    return out;
  }
  return node;
}

function toJsonSchema<T>(schema: z.ZodType<T>): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return strictify(json) as Record<string, unknown>;
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  async generateText(req: GenTextRequest): Promise<GenResult> {
    const model = req.model || DEFAULT_MODEL;
    const msg = await getClient().messages.create({
      model,
      max_tokens: req.maxTokens ?? 4000,
      system: req.system,
      thinking: { type: "adaptive" },
      output_config: { effort: req.effort ?? "high" },
      messages: [{ role: "user", content: req.prompt }],
    });
    return { text: firstText(msg), model, tokens: totalTokens(msg) };
  }

  async *streamText(req: GenTextRequest): AsyncIterable<string> {
    const model = req.model || DEFAULT_MODEL;
    const stream = getClient().messages.stream({
      model,
      max_tokens: req.maxTokens ?? 4000,
      system: req.system,
      thinking: { type: "adaptive" },
      output_config: { effort: req.effort ?? "high" },
      messages: [{ role: "user", content: req.prompt }],
    });
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  async generateStructured<T>(
    req: GenStructuredRequest<T>,
  ): Promise<StructuredResult<T>> {
    const model = req.model || DEFAULT_MODEL;
    const msg = await getClient().messages.create({
      model,
      max_tokens: req.maxTokens ?? 8000,
      system: req.system,
      output_config: {
        effort: req.effort ?? "medium",
        format: { type: "json_schema", schema: toJsonSchema(req.schema) },
      },
      messages: [{ role: "user", content: req.prompt }],
    });
    const raw = firstText(msg);
    const data = req.schema.parse(JSON.parse(raw));
    return { data, model, tokens: totalTokens(msg) };
  }
}
