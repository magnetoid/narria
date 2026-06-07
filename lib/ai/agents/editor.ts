import "server-only";
import { ai } from "@/lib/ai";
import { buildEdit } from "@/lib/ai/prompts";
import type { Book, BookBrain, Chapter } from "@/lib/db/types";

/** Run one of the transform actions (rewrite/expand/shorten/…) on a passage. */
export async function transform(
  actionId: string,
  book: Book,
  brain: BookBrain | null,
  chapter: Chapter,
  selection: string,
): Promise<string> {
  const { system, prompt } = buildEdit(actionId, book, brain, chapter, selection);
  const { text } = await ai.text({
    system,
    prompt,
    maxTokens: 2000,
    effort: "high",
    meta: {
      agent: "editor",
      kind: `edit:${actionId}`,
      action: actionId,
      bookId: book.id,
      chapterId: chapter.id,
      input: { actionId, book, brain, chapter, selection },
    },
  });
  return text;
}
