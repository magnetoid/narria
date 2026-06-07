import "server-only";
import { ai } from "@/lib/ai";
import { buildFactCheck } from "@/lib/ai/prompts";
import type { Book, BookBrain } from "@/lib/db/types";

/** Surface claims in a passage that should be verified. */
export async function factCheck(
  book: Book,
  brain: BookBrain | null,
  text: string,
): Promise<string> {
  const built = buildFactCheck(book, brain, text);
  const { text: out } = await ai.text({
    system: built.system,
    prompt: built.prompt,
    maxTokens: 1200,
    effort: "medium",
    meta: { agent: "factCheck", kind: "factcheck", bookId: book.id, input: { book, brain } },
  });
  return out;
}
