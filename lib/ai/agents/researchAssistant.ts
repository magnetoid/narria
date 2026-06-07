import "server-only";
import { ai } from "@/lib/ai";
import { buildResearch } from "@/lib/ai/prompts";
import type { Book, BookBrain } from "@/lib/db/types";

/** Concise background notes the author can weave into the book. */
export async function research(
  book: Book,
  brain: BookBrain | null,
  topic: string,
): Promise<string> {
  const { system, prompt } = buildResearch(book, brain, topic);
  const { text } = await ai.text({
    system,
    prompt,
    maxTokens: 1200,
    effort: "medium",
    meta: { agent: "researchAssistant", kind: "research", bookId: book.id, input: { topic, book, brain } },
  });
  return text;
}
