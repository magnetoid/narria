import "server-only";
import { ai } from "@/lib/ai";
import { buildBrainSynthesis, buildOutline } from "@/lib/ai/prompts";
import { BrainSynthesisSchema, OutlineSchema, type BrainSynthesis } from "@/lib/ai/schemas";
import type { Book, BookBrain, ChapterPlan } from "@/lib/db/types";

/** Turn interview answers into a structured Book Brain. */
export async function synthesizeBrain(
  book: Book,
  qa: { question: string; answer: string }[],
): Promise<BrainSynthesis> {
  const { system, prompt } = buildBrainSynthesis(book, qa);
  const { data } = await ai.structured({
    system,
    prompt,
    schema: BrainSynthesisSchema,
    schemaName: "BookBrain",
    effort: "high",
    meta: { agent: "bookPlanner", kind: "brain-synthesis", bookId: book.id, input: { book, qa } },
  });
  return data;
}

/** Generate a complete chapter outline from the Book Brain. */
export async function generateOutline(
  book: Book,
  brain: BookBrain | null,
): Promise<ChapterPlan[]> {
  const { system, prompt } = buildOutline(book, brain);
  const { data } = await ai.structured({
    system,
    prompt,
    schema: OutlineSchema,
    schemaName: "Outline",
    effort: "high",
    maxTokens: 12000,
    meta: { agent: "bookPlanner", kind: "outline", bookId: book.id, input: { book, brain } },
  });
  return data.chapters;
}
