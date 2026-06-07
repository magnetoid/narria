"use server";

import { revalidatePath } from "next/cache";
import { getBook } from "@/lib/db/repositories/books";
import { getBrain, upsertBrain, type BrainPatch } from "@/lib/db/repositories/brain";
import { synthesizeBrain } from "@/lib/ai/agents/bookPlanner";
import { interviewQuestions } from "@/lib/interview";

export async function saveBrain(
  bookId: string,
  patch: BrainPatch,
): Promise<{ ok: true } | { error: string }> {
  try {
    await upsertBrain(bookId, patch);
    revalidatePath(`/books/${bookId}`, "layout");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Re-run the Book Planner on the saved interview answers, overwriting the
 *  synthesized fields (interview answers are preserved). */
export async function regenerateBrain(
  bookId: string,
): Promise<{ ok: true } | { error: string }> {
  const book = await getBook(bookId);
  if (!book) return { error: "Book not found." };

  const brain = await getBrain(bookId);
  const interview = (brain?.interview ?? {}) as Record<string, string>;
  const qa = interviewQuestions(book.book_type).map((q) => ({
    question: q.question,
    answer: interview[q.id] ?? "",
  }));

  try {
    const synth = await synthesizeBrain(book, qa);
    await upsertBrain(bookId, synth);
    revalidatePath(`/books/${bookId}`, "layout");
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
