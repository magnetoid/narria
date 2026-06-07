"use server";

import { getBook } from "@/lib/db/repositories/books";
import { getBrain } from "@/lib/db/repositories/brain";
import { getChapter } from "@/lib/db/repositories/chapters";
import { transform } from "@/lib/ai/agents/editor";
import { checkConsistency, summarizeChapter } from "@/lib/ai/agents/critic";

/** Run a transform action (rewrite/expand/…) on a passage; returns the new text. */
export async function runChapterEdit(
  actionId: string,
  bookId: string,
  chapterId: string,
  selection: string,
): Promise<{ text: string } | { error: string }> {
  const book = await getBook(bookId);
  const chapter = await getChapter(chapterId);
  if (!book || !chapter) return { error: "Chapter not found." };
  const brain = await getBrain(bookId);
  try {
    const text = await transform(actionId, book, brain, chapter, selection);
    return { text };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Run a review action (consistency/summary) over the current content. */
export async function runChapterReview(
  actionId: string,
  bookId: string,
  chapterId: string,
  content: string,
): Promise<{ text: string } | { error: string }> {
  const book = await getBook(bookId);
  const chapter = await getChapter(chapterId);
  if (!book || !chapter) return { error: "Chapter not found." };
  const brain = await getBrain(bookId);
  const withContent = { ...chapter, content };
  try {
    const text =
      actionId === "summarize"
        ? await summarizeChapter(book, brain, withContent)
        : await checkConsistency(book, brain, withContent);
    return { text };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
