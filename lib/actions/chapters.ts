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
import { errorCode, type ActionError } from "@/lib/errors";
import { chapterPatch as chapterPatchSchema, idSchema, reorderChaptersInput } from "@/lib/validation";

/** Generate (or regenerate) the whole table of contents from the Book Brain. */
export async function generateOutlineAction(
  bookId: string,
): Promise<{ ok: true } | ActionError> {
  const parsedId = idSchema.safeParse(bookId);
  if (!parsedId.success) return { error: "Invalid book id." };
  // idSchema trims — use the parsed id everywhere so reads and writes share one key.
  bookId = parsedId.data;
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
    return { error: (e as Error).message, code: errorCode(e) };
  }
}

export async function addChapterAction(
  bookId: string,
): Promise<{ chapter: Chapter } | { error: string }> {
  const parsedId = idSchema.safeParse(bookId);
  if (!parsedId.success) return { error: "Invalid book id." };
  try {
    const chapter = await createChapter(parsedId.data, { title: "New chapter" });
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
  const parsedId = idSchema.safeParse(id);
  const parsedPatch = chapterPatchSchema.safeParse(patch);
  if (!parsedId.success || !parsedPatch.success) return { error: "Invalid chapter update." };
  try {
    await updateChapter(parsedId.data, parsedPatch.data);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteChapterAction(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Invalid chapter id." };
  try {
    await deleteChapter(parsedId.data);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function reorderChaptersAction(
  orderedIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const parsed = reorderChaptersInput.safeParse(orderedIds);
  if (!parsed.success) return { error: "Invalid chapter order." };
  try {
    await reorderChapters(parsed.data);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
