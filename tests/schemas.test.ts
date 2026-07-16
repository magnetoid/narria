import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/ai/providers/mock";
import {
  BrainSynthesisSchema,
  ListSchema,
  OutlineSchema,
  ProseSchema,
} from "@/lib/ai/schemas";
import type { Book } from "@/lib/db/types";
import type { GenStructuredRequest } from "@/lib/ai/provider";

const book: Book = {
  id: "book_1",
  user_id: "user_1",
  title: "The Long Way Home",
  subtitle: null,
  book_type: "memoir",
  status: "draft",
  cover_emoji: "📖",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

// The mock provider already parses its own output against `req.schema` before
// returning (see providers/mock.ts) — resolving without throwing IS the assertion
// that the mock's shape can never drift from the real structured-output contract.
describe("MockProvider().generateStructured against lib/ai/schemas.ts", () => {
  it("brain synthesis parses against BrainSynthesisSchema", async () => {
    const req: GenStructuredRequest<unknown> = {
      system: "",
      prompt: "",
      schema: BrainSynthesisSchema,
      schemaName: "BookBrain",
      meta: {
        agent: "bookPlanner",
        kind: "brain-synthesis",
        input: { book, qa: [{ question: "What is your book about?", answer: "A memoir about resilience." }] },
      },
    };
    const { data } = await new MockProvider().generateStructured(req);
    expect(BrainSynthesisSchema.parse(data)).toEqual(data);
  });

  it("outline parses against OutlineSchema", async () => {
    const req: GenStructuredRequest<unknown> = {
      system: "",
      prompt: "",
      schema: OutlineSchema,
      schemaName: "Outline",
      meta: {
        agent: "bookPlanner",
        kind: "outline",
        input: { book, brain: null },
      },
    };
    const { data } = await new MockProvider().generateStructured(req);
    expect(OutlineSchema.parse(data)).toEqual(data);
  });

  it("publish prose metadata parses against ProseSchema", async () => {
    const req: GenStructuredRequest<unknown> = {
      system: "",
      prompt: "",
      schema: ProseSchema,
      schemaName: "Prose",
      meta: {
        agent: "metadata",
        kind: "metadata:description",
        input: { kind: "description", book },
      },
    };
    const { data } = await new MockProvider().generateStructured(req);
    expect(ProseSchema.parse(data)).toEqual(data);
  });

  it("publish list metadata parses against ListSchema", async () => {
    const req: GenStructuredRequest<unknown> = {
      system: "",
      prompt: "",
      schema: ListSchema,
      schemaName: "List",
      meta: {
        agent: "metadata",
        kind: "metadata:subtitle_ideas",
        input: { kind: "subtitle_ideas", book },
      },
    };
    const { data } = await new MockProvider().generateStructured(req);
    expect(ListSchema.parse(data)).toEqual(data);
  });
});
