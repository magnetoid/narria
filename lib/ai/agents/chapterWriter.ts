import "server-only";
import { ai } from "@/lib/ai";
import { buildContinue } from "@/lib/ai/prompts";
import type { Book, BookBrain, Chapter } from "@/lib/db/types";

/** Stream a continuation of the chapter manuscript in the author's voice. */
export async function* continueChapter(
  book: Book,
  brain: BookBrain | null,
  chapter: Chapter,
  currentText: string,
): AsyncIterable<string> {
  const { system, prompt } = buildContinue(book, brain, chapter, currentText);
  yield* ai.stream({
    system,
    prompt,
    maxTokens: 3000,
    effort: "high",
    meta: {
      agent: "chapterWriter",
      kind: "chapter-continue",
      bookId: book.id,
      chapterId: chapter.id,
      input: { book, brain, chapter, currentText },
    },
  });
}
