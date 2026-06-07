import "server-only";
import { ai } from "@/lib/ai";
import { buildConsistency, buildSummary } from "@/lib/ai/prompts";
import type { Book, BookBrain, Chapter } from "@/lib/db/types";

/** Flag drift from the Book Brain. */
export async function checkConsistency(
  book: Book,
  brain: BookBrain | null,
  chapter: Chapter,
): Promise<string> {
  const { system, prompt } = buildConsistency(book, brain, chapter);
  const { text } = await ai.text({
    system,
    prompt,
    maxTokens: 1500,
    effort: "high",
    meta: { agent: "critic", kind: "critic:consistency", bookId: book.id, chapterId: chapter.id, input: { book, brain, chapter } },
  });
  return text;
}

/** Tight recap of a chapter. */
export async function summarizeChapter(
  book: Book,
  brain: BookBrain | null,
  chapter: Chapter,
): Promise<string> {
  const { system, prompt } = buildSummary(book, brain, chapter);
  const { text } = await ai.text({
    system,
    prompt,
    maxTokens: 600,
    effort: "medium",
    meta: { agent: "critic", kind: "critic:summary", bookId: book.id, chapterId: chapter.id, input: { book, brain, chapter } },
  });
  return text;
}
