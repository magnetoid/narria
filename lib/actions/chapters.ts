"use server";

import { revalidatePath } from "next/cache";
import { getBook, updateBook } from "@/lib/db/repositories/books";
import { getBrain } from "@/lib/db/repositories/brain";
import {
  createChapter,
  deleteChapter,
  replaceChapters,
  reorderChapters,
  updateChapter,
} from "@/lib/db/repositories/chapters";
import { generateOutline } from "@/lib/ai/agents/bookPlanner";
import type { Chapter } from "@/lib/db/types";

/** Generate (or regenerate) the whole table of contents from the Book Brain. */
export async function generateOutlineAction(
  bookId: string,
): Promise<{ ok: true } | { error: string }> {
  const book = await getBook(bookId);
  if (!book) return { error: "Book not found." };
  const brain = await getBrain(bookId);
  try {
    const plans = await generateOutline(book, brain);
    await replaceChapters(bookId, plans);
    await updateBook(bookId, { status: "writing" });
    revalidatePath(`/books/${bookId}/outline`);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function addChapterAction(
  bookId: string,
): Promise<{ chapter: Chapter } | { error: string }> {
  try {
    const chapter = await createChapter(bookId, { title: "New chapter" });
    return { chapter };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateChapterAction(
  id: string,
  patch: Partial<
    Pick<
      Chapter,
      "title" | "goal" | "summary" | "key_points" | "estimated_word_count" | "content" | "status"
    >
  >,
): Promise<{ ok: true } | { error: string }> {
  try {
    await updateChapter(id, patch);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteChapterAction(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await deleteChapter(id);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function reorderChaptersAction(
  orderedIds: string[],
): Promise<{ ok: true } | { error: string }> {
  try {
    await reorderChapters(orderedIds);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
