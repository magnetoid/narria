"use server";

import { getBook } from "@/lib/db/repositories/books";
import { getBrain } from "@/lib/db/repositories/brain";
import { getChapter } from "@/lib/db/repositories/chapters";
import { transform } from "@/lib/ai/agents/editor";
import { checkConsistency, summarizeChapter } from "@/lib/ai/agents/critic";
import { errorCode, type ActionError } from "@/lib/errors";
import { chapterEditInput, chapterReviewInput } from "@/lib/validation";

/** Run a transform action (rewrite/expand/…) on a passage; returns the new text. */
export async function runChapterEdit(
  actionId: string,
  bookId: string,
  chapterId: string,
  selection: string,
): Promise<{ text: string } | ActionError> {
  const parsed = chapterEditInput.safeParse({ actionId, bookId, chapterId, selection });
  if (!parsed.success) return { error: "Invalid edit request." };
  // idSchema trims — use the parsed ids everywhere so reads and writes share one key.
  ({ bookId, chapterId } = parsed.data);
  const book = await getBook(bookId);
  const chapter = await getChapter(chapterId);
  if (!book || !chapter) return { error: "Chapter not found." };
  const brain = await getBrain(bookId);
  try {
    const text = await transform(parsed.data.actionId, book, brain, chapter, parsed.data.selection);
    return { text };
  } catch (e) {
    // `code` lets the UI tell a throttle apart from a provider failure; the ai facade
    // throws RateLimitError from here.
    return { error: (e as Error).message, code: errorCode(e) };
  }
}

/** Run a review action (consistency/summary) over the current content. */
export async function runChapterReview(
  actionId: string,
  bookId: string,
  chapterId: string,
  content: string,
): Promise<{ text: string } | ActionError> {
  const parsed = chapterReviewInput.safeParse({ actionId, bookId, chapterId, content });
  if (!parsed.success) return { error: "Invalid review request." };
  // idSchema trims — use the parsed ids everywhere so reads and writes share one key.
  ({ bookId, chapterId } = parsed.data);
  const book = await getBook(bookId);
  const chapter = await getChapter(chapterId);
  if (!book || !chapter) return { error: "Chapter not found." };
  const brain = await getBrain(bookId);
  const withContent = { ...chapter, content: parsed.data.content };
  try {
    const text =
      actionId === "summarize"
        ? await summarizeChapter(book, brain, withContent)
        : await checkConsistency(book, brain, withContent);
    return { text };
  } catch (e) {
    return { error: (e as Error).message, code: errorCode(e) };
  }
}
